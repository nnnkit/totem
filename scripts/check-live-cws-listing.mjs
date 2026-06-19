import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const manifest = JSON.parse(
  readFileSync(resolve(rootDir, "public/manifest.json"), "utf8"),
);
const listingUrl =
  "https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo";

const expected = {
  name: manifest.name,
  description: manifest.description,
  version: manifest.version,
  privacyUrl: "usetotem.xyz/privacy",
};

function normalized(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const response = await fetch(listingUrl, {
  headers: {
    "accept-language": "en-US,en;q=0.9",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome Safari/537.36",
  },
});

if (!response.ok) {
  console.error(`Could not fetch public CWS listing: HTTP ${response.status}`);
  process.exit(1);
}

const html = await response.text();
const text = normalized(html);
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(
  text.includes(expected.name),
  `Public listing does not show expected title: ${expected.name}`,
);
check(
  text.includes(expected.description),
  `Public listing does not show expected short description: ${expected.description}`,
);
check(
  text.includes(`Version ${expected.version}`) || text.includes(expected.version),
  `Public listing does not show expected version: ${expected.version}`,
);
check(
  !text.includes("KEYWORDS twitter bookmarks"),
  "Public listing still appears to include the rejected keyword block",
);
check(
  html.includes(expected.privacyUrl),
  `Public listing does not expose the privacy URL containing ${expected.privacyUrl}`,
);
check(
  text.includes("Support") && text.includes("support site"),
  "Public listing does not appear to expose the support site section",
);

if (text.includes("Featured")) {
  console.log("Public CWS listing already appears to mention Featured.");
}

if (failures.length > 0) {
  console.error("Live CWS listing is not ready for Featured nomination:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error(`Checked: ${listingUrl}`);
  process.exit(1);
}

console.log("Live CWS listing is ready for Featured nomination.");
console.log(`Checked: ${listingUrl}`);
