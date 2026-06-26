import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";

const rootDir = process.cwd();

const expected = {
  name: "Twitter & X Bookmarks on New Tab — Totem",
  description:
    "Your Twitter & X bookmarks, waiting on every new tab — finally read what you saved. Search, highlight, export. Local-first.",
  extensionId: "acpkgdfhoaalmnhjifhneghcgfnjkglo",
  homepageUrl: "https://usetotem.xyz/",
  screenshots: [
    "01-twitter-bookmarks-on-every-new-tab.png",
    "02-read-twitter-threads-without-the-feed.png",
    "03-search-saved-posts-authors-links-threads.png",
    "04-export-twitter-bookmarks-markdown-csv-notion.png",
    "05-local-first-no-account-no-server.png",
  ],
  promoTiles: {
    "marquee-promo-tile.png": { width: 1400, height: 560 },
    "small-promo-tile.png": { width: 440, height: 280 },
  },
};

const failures = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(rootDir, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(rootDir, relativePath), "utf8");
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function sameArray(actual, want) {
  return actual.length === want.length && actual.every((value, index) => value === want[index]);
}

function pngSize(filePath) {
  const bytes = readFileSync(filePath);
  const isPng =
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (!isPng) {
    throw new Error(`${filePath} is not a PNG file`);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function checkPngDimensions(filePath, width, height) {
  try {
    const size = pngSize(filePath);
    check(
      size.width === width && size.height === height,
      `${filePath} is ${size.width}x${size.height}; expected ${width}x${height}`,
    );
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

function checkManifest(manifest, label) {
  check(manifest.manifest_version === 3, `${label}: manifest_version must be 3`);
  check(manifest.name === expected.name, `${label}: name must be "${expected.name}"`);
  check(
    manifest.description === expected.description,
    `${label}: description must match CWS listing plan`,
  );
  check(
    typeof manifest.name === "string" && manifest.name.length <= 75,
    `${label}: name must be 75 characters or fewer`,
  );
  check(
    typeof manifest.description === "string" && manifest.description.length <= 132,
    `${label}: description must be 132 characters or fewer`,
  );
  check(
    manifest.homepage_url === expected.homepageUrl,
    `${label}: homepage_url must be ${expected.homepageUrl}`,
  );
  check(
    manifest.offline_enabled === true,
    `${label}: offline_enabled must be true for local reading`,
  );

  const permissions = new Set(manifest.permissions || []);
  for (const permission of ["storage", "webRequest", "declarativeNetRequest", "scripting", "cookies"]) {
    check(permissions.has(permission), `${label}: missing required permission ${permission}`);
  }

  const optionalPermissions = new Set(manifest.optional_permissions || []);
  for (const permission of ["topSites", "favicon", "search"]) {
    check(
      optionalPermissions.has(permission),
      `${label}: optional permission ${permission} should stay optional`,
    );
  }

  check(
    Array.isArray(manifest.host_permissions) &&
      manifest.host_permissions.length === 1 &&
      manifest.host_permissions[0] === "https://x.com/*",
    `${label}: host_permissions must be limited to https://x.com/*`,
  );
}

function checkReleaseZip(version, sourceManifest) {
  const zipPath = resolve(rootDir, "release", `totem-v${version}.zip`);
  check(existsSync(zipPath), `Missing release ZIP: ${zipPath}`);
  if (!existsSync(zipPath)) return;

  const result = spawnSync("unzip", ["-p", zipPath, "manifest.json"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(`Could not read manifest.json from ${zipPath}`);
    return;
  }

  let zipManifest;
  try {
    zipManifest = JSON.parse(result.stdout);
  } catch {
    failures.push(`manifest.json inside ${zipPath} is not valid JSON`);
    return;
  }

  checkManifest(zipManifest, basename(zipPath));
  check(
    zipManifest.version === sourceManifest.version,
    `ZIP version ${zipManifest.version} does not match public manifest ${sourceManifest.version}`,
  );
}

function checkImages() {
  const screenshotsDir = resolve(rootDir, "images-for-promotions/chrome-web-store/screenshots");
  const actualScreenshots = readdirSync(screenshotsDir)
    .filter((name) => name.endsWith(".png"))
    .sort();

  check(
    sameArray(actualScreenshots, expected.screenshots),
    `CWS screenshots must be exactly: ${expected.screenshots.join(", ")}`,
  );

  for (const screenshot of expected.screenshots) {
    checkPngDimensions(join(screenshotsDir, screenshot), 1280, 800);
  }

  const promoDir = resolve(rootDir, "images-for-promotions/chrome-web-store");
  for (const [filename, size] of Object.entries(expected.promoTiles)) {
    checkPngDimensions(join(promoDir, filename), size.width, size.height);
  }
}

function checkListingDocs() {
  const listing = readText("plans/chrome-web-store-listing.md");
  check(
    listing.includes("title, short description, and category changes are deferred"),
    "Listing plan should note deferred metadata changes",
  );
  check(
    listing.includes("Read your saved posts from a calm new tab."),
    "Listing plan missing current promo tile copy",
  );

  for (const permission of [
    "storage",
    "webRequest",
    "declarativeNetRequest",
    "scripting",
    "cookies",
    "https://x.com/*",
    "topSites",
    "favicon",
    "search",
  ]) {
    check(
      listing.includes(`\`${permission}\``) || listing.includes(`Optional \`${permission}\``),
      `Listing plan missing permission justification for ${permission}`,
    );
  }

  const featuredPlan = readText("plans/chrome-web-store-featured-badge-plan.md");
  check(
    featuredPlan.includes(expected.extensionId),
    "Featured badge plan missing extension ID",
  );
  check(
    featuredPlan.includes("6 months"),
    "Featured badge plan should call out the 6-month nomination limit",
  );

  const publish = readText("PUBLISH.md");
  check(
    publish.includes('select "Productivity"'),
    "PUBLISH.md should keep the current Productivity category guidance",
  );

  const dashboardPacket = readText("plans/chrome-web-store-dashboard-update-packet.md");
  check(
    dashboardPacket.includes(expected.extensionId),
    "Dashboard update packet missing extension ID",
  );
  check(
    dashboardPacket.includes(expected.name),
    "Dashboard update packet missing expected extension name",
  );
  check(
    dashboardPacket.includes(expected.description),
    "Dashboard update packet missing expected short description",
  );
  check(
    dashboardPacket.includes(`release/totem-v${publicManifest.version}.zip`),
    "Dashboard update packet missing current release ZIP path",
  );
  check(
    dashboardPacket.includes(expected.homepageUrl),
    "Dashboard update packet missing homepage URL",
  );
  check(
    dashboardPacket.includes("https://usetotem.xyz/privacy/"),
    "Dashboard update packet missing privacy policy URL",
  );
  check(
    dashboardPacket.includes("pnpm cws:featured:preflight"),
    "Dashboard update packet missing local preflight command",
  );
  check(
    dashboardPacket.includes("pnpm cws:featured:live"),
    "Dashboard update packet missing live listing check command",
  );
  check(
    dashboardPacket.includes("once every 6 months"),
    "Dashboard update packet should call out the 6-month nomination limit",
  );

  for (const screenshot of expected.screenshots) {
    check(
      dashboardPacket.includes(screenshot),
      `Dashboard update packet missing screenshot ${screenshot}`,
    );
  }

  for (const tile of Object.keys(expected.promoTiles)) {
    check(
      dashboardPacket.includes(tile),
      `Dashboard update packet missing promo tile ${tile}`,
    );
  }
}

const packageJson = readJson("package.json");
const publicManifest = readJson("public/manifest.json");

check(
  packageJson.version === publicManifest.version,
  `Version mismatch: package.json=${packageJson.version}, public/manifest.json=${publicManifest.version}`,
);

checkManifest(publicManifest, "public/manifest.json");
checkReleaseZip(publicManifest.version, publicManifest);
checkImages();
checkListingDocs();

if (failures.length > 0) {
  console.error("CWS Featured preflight failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("CWS Featured preflight passed.");
