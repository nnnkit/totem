import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const rootDir = process.cwd();
const packageJsonPath = resolve(rootDir, "package.json");
const manifestPath = resolve(rootDir, "public/manifest.json");

const packageJson = readJson(packageJsonPath);
const manifest = readJson(manifestPath);

if (!packageJson.version || !manifest.version) {
  console.error("Missing version in package.json or public/manifest.json.");
  process.exit(1);
}

if (packageJson.version !== manifest.version) {
  console.error(
    `Version mismatch: package.json=${packageJson.version} manifest=${manifest.version}`
  );
  process.exit(1);
}

console.log(`Versions are in sync: ${packageJson.version}`);
