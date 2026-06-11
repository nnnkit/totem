import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sitemapArg = args.find((arg) => !arg.startsWith("--"));
const sitemapPath = resolve(process.cwd(), sitemapArg ?? "dist-website/sitemap-0.xml");
const siteUrl = new URL(process.env.INDEXNOW_SITE_URL ?? "https://usetotem.xyz/");
const host = siteUrl.host;
const key = process.env.INDEXNOW_KEY;
const keyLocation =
  process.env.INDEXNOW_KEY_LOCATION ?? (key ? new URL(`/${key}.txt`, siteUrl).href : null);

function readUrlsFromSitemap(path) {
  const xml = readFileSync(path, "utf8");
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]).filter(
    (url) => new URL(url).host === host,
  );
}

async function submitChunk(urlList) {
  if (!key || !keyLocation) {
    console.error(
      "Set INDEXNOW_KEY and host a matching key file, usually apps/site/public/$INDEXNOW_KEY.txt.",
    );
    process.exit(1);
  }

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`IndexNow returned ${response.status}: ${body}`);
  }
}

const urls = readUrlsFromSitemap(sitemapPath);

if (urls.length === 0) {
  console.error(`No URLs found in ${sitemapPath}. Run pnpm build:website first.`);
  process.exit(1);
}

if (dryRun) {
  console.log(`Would submit ${urls.length} URL(s) for ${host} from ${sitemapPath}.`);
  urls.forEach((url) => console.log(url));
  process.exit(0);
}

for (let index = 0; index < urls.length; index += 10000) {
  await submitChunk(urls.slice(index, index + 10000));
}

console.log(`Submitted ${urls.length} URL(s) to IndexNow for ${host}.`);
