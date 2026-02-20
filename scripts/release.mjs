import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const USAGE =
  "Usage: pnpm release [patch|minor|major|x.y.z] [--dry-run] [--no-build] [--allow-dirty]";

function runOrFail(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function ensureCleanGitState() {
  const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();

  if (status.length > 0) {
    console.error("Working tree is not clean. Commit or stash your changes first.");
    process.exit(1);
  }
}

function ensureOnMainBranch() {
  const branch = execSync("git branch --show-current", { encoding: "utf8" }).trim();

  if (branch !== "main") {
    console.error(`Release must run from main branch. Current branch: ${branch}`);
    process.exit(1);
  }
}

function readVersionInfo() {
  const rootDir = process.cwd();
  const packageJsonPath = resolve(rootDir, "package.json");
  const manifestPath = resolve(rootDir, "public/manifest.json");

  const packageVersion = JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
  const manifestVersion = JSON.parse(readFileSync(manifestPath, "utf8")).version;

  if (!packageVersion || !manifestVersion || packageVersion !== manifestVersion) {
    console.error("package.json and public/manifest.json versions are not in sync.");
    process.exit(1);
  }

  return packageVersion;
}

function ensureTagDoesNotExist(tag) {
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tag}`, { stdio: "ignore" });
    console.error(`Local tag ${tag} already exists. Use a new version.`);
    process.exit(1);
  } catch {
    // local tag does not exist
  }

  const remoteCheck = spawnSync(
    "git",
    ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`],
    { encoding: "utf8" }
  );

  if (remoteCheck.status === 0) {
    console.error(`Remote tag ${tag} already exists. Use a new version.`);
    process.exit(1);
  }

  // Exit code 2 means no matching refs. Any other failure is unexpected.
  if (remoteCheck.status !== 2) {
    console.error(
      remoteCheck.stderr?.trim() || "Failed checking remote tags from origin."
    );
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
  const releaseArg = positionalArgs[0] ?? "patch";
  const dryRun = args.includes("--dry-run");
  const noBuild = args.includes("--no-build");
  const allowDirty = args.includes("--allow-dirty");

  if (positionalArgs.length > 1) {
    console.error(USAGE);
    process.exit(1);
  }

  ensureOnMainBranch();
  if (!allowDirty) {
    ensureCleanGitState();
  }

  const prepareArgs = ["release:prepare", releaseArg];

  if (dryRun) {
    prepareArgs.push("--dry-run");
  }

  if (noBuild) {
    prepareArgs.push("--no-build");
  }

  if (allowDirty) {
    prepareArgs.push("--allow-dirty");
  }

  runOrFail("pnpm", prepareArgs);

  if (dryRun) {
    console.log("");
    console.log("Dry run only. No commit, tag, or push was performed.");
    return;
  }

  const version = readVersionInfo();
  const tag = `v${version}`;
  ensureTagDoesNotExist(tag);

  runOrFail("git", [
    "add",
    "CHANGELOG.md",
    "package.json",
    "public/manifest.json",
  ]);

  const hasStagedChanges = spawnSync("git", ["diff", "--cached", "--quiet"]).status !== 0;

  if (!hasStagedChanges) {
    console.error("No staged release changes found.");
    process.exit(1);
  }

  runOrFail("git", ["commit", "-m", `chore(release): ${tag}`]);
  runOrFail("git", ["push", "origin", "main"]);
  runOrFail("git", ["tag", tag]);
  runOrFail("git", ["push", "origin", tag]);

  console.log("");
  console.log(`Release ${tag} published.`);
}

main();
