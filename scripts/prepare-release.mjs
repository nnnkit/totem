import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const USAGE =
  "Usage: pnpm release:prepare <patch|minor|major|x.y.z> [--no-build] [--dry-run] [--allow-dirty]";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function incrementSemver(current, bumpType) {
  const [major, minor, patch] = current.split(".").map(Number);

  if (bumpType === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  if (bumpType === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (bumpType === "major") {
    return `${major + 1}.0.0`;
  }

  return null;
}

function getLatestTag() {
  try {
    return execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function ensureCleanGitState() {
  const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();

  if (status.length > 0) {
    console.error(
      "Working tree is not clean. Commit or stash current changes first, or pass --allow-dirty."
    );
    process.exit(1);
  }
}

function getCommitSubjectsSinceTag(tag) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const output = execSync(`git log ${range} --pretty=format:%s`, {
    encoding: "utf8",
  }).trim();

  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function categorizeCommits(commits) {
  const added = [];
  const fixed = [];
  const changed = [];

  for (const subject of commits) {
    if (/^feat(\(.+\))?:\s+/i.test(subject)) {
      added.push(subject);
      continue;
    }

    if (/^fix(\(.+\))?:\s+/i.test(subject)) {
      fixed.push(subject);
      continue;
    }

    changed.push(subject);
  }

  return { added, fixed, changed };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeChangelog(content) {
  if (content.trim().length > 0) {
    return content.trimEnd();
  }

  return [
    "# Changelog",
    "",
    "All notable changes to this project will be documented in this file.",
  ].join("\n");
}

function renderSection(title, lines) {
  if (lines.length === 0) {
    return "";
  }

  return [`### ${title}`, ...lines.map((line) => `- ${line}`), ""].join("\n");
}

function upsertChangelogEntry(changelogPath, version, categorized) {
  let content = "";

  try {
    content = readFileSync(changelogPath, "utf8");
  } catch {
    content = "";
  }

  content = normalizeChangelog(content);
  const date = new Date().toISOString().slice(0, 10);

  const sections = [
    renderSection("Added", categorized.added),
    renderSection("Changed", categorized.changed),
    renderSection("Fixed", categorized.fixed),
  ]
    .filter(Boolean)
    .join("\n")
    .trimEnd();

  const releaseBody =
    sections.length > 0 ? sections : ["### Changed", "- Maintenance release."].join("\n");

  const entry = [`## [${version}] - ${date}`, "", releaseBody].join("\n");

  const versionEntryRegex = new RegExp(
    `## \\[${escapeRegExp(version)}\\] - [^\\n]*\\n(?:[\\s\\S]*?)(?=\\n## \\[|$)`,
    "m"
  );
  const stripped = content.replace(versionEntryRegex, "").trimEnd();

  const firstReleaseHeaderIndex = stripped.indexOf("\n## [");

  if (firstReleaseHeaderIndex === -1) {
    return `${stripped}\n\n${entry}\n`;
  }

  const preface = stripped.slice(0, firstReleaseHeaderIndex).trimEnd();
  const rest = stripped.slice(firstReleaseHeaderIndex + 1).trimStart();
  return `${preface}\n\n${entry}\n\n${rest}\n`;
}

function runOrFail(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function main() {
  const args = process.argv.slice(2);
  const releaseArg = args[0];
  const noBuild = args.includes("--no-build");
  const dryRun = args.includes("--dry-run");
  const allowDirty = args.includes("--allow-dirty");

  if (!releaseArg) {
    console.error(USAGE);
    process.exit(1);
  }

  const rootDir = process.cwd();
  const packageJsonPath = resolve(rootDir, "package.json");
  const manifestPath = resolve(rootDir, "public/manifest.json");
  const changelogPath = resolve(rootDir, "CHANGELOG.md");

  const packageJson = readJson(packageJsonPath);
  const manifest = readJson(manifestPath);

  if (!isSemver(packageJson.version) || !isSemver(manifest.version)) {
    console.error(
      "Both package.json and public/manifest.json must have strict semver versions (x.y.z)."
    );
    process.exit(1);
  }

  if (packageJson.version !== manifest.version) {
    console.error(
      `Version mismatch before release: package.json=${packageJson.version} manifest=${manifest.version}`
    );
    process.exit(1);
  }

  if (!allowDirty) {
    ensureCleanGitState();
  }

  const nextVersion = incrementSemver(packageJson.version, releaseArg) ?? releaseArg;

  if (!isSemver(nextVersion)) {
    console.error(
      `Invalid release type "${releaseArg}". Use patch|minor|major or explicit version x.y.z.`
    );
    process.exit(1);
  }

  if (nextVersion === packageJson.version) {
    console.error(
      `Next version matches current version (${nextVersion}). Choose a different version.`
    );
    process.exit(1);
  }

  packageJson.version = nextVersion;
  manifest.version = nextVersion;

  const latestTag = getLatestTag();
  const commits = getCommitSubjectsSinceTag(latestTag);
  const categorized = categorizeCommits(commits);
  const nextChangelog = upsertChangelogEntry(changelogPath, nextVersion, categorized);

  if (!dryRun) {
    writeJson(packageJsonPath, packageJson);
    writeJson(manifestPath, manifest);
    writeFileSync(changelogPath, nextChangelog, "utf8");
  }

  if (!dryRun && !noBuild) {
    runOrFail("pnpm", ["release:check"]);
  }

  console.log("");
  if (dryRun) {
    console.log(`Dry run complete for v${nextVersion}`);
  } else {
    console.log(`Prepared release v${nextVersion}`);
  }
  console.log("");
  console.log(`Commits included in changelog entry: ${commits.length}`);
  console.log("");
  console.log("Next commands:");
  console.log("git add CHANGELOG.md package.json public/manifest.json");
  console.log(`git commit -m "chore(release): v${nextVersion}"`);
  console.log("git push origin main");
  console.log(`git tag v${nextVersion}`);
  console.log(`git push origin v${nextVersion}`);
}

main();
