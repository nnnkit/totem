#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const WALLPAPERS_DIR = join(ROOT, "public", "wallpapers");
const WALLPAPERS_JSON = join(WALLPAPERS_DIR, "wallpapers.json");

function loadEnv() {
  try {
    const content = readFileSync(join(ROOT, ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  } catch {
    // .env.local is optional for the download script if key isn't needed
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function titleCase(str) {
  return str
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error(
      "Usage: node scripts/curate-wallpapers.mjs <curated-wallpapers.json>",
    );
    process.exit(1);
  }

  loadEnv();
  const apiKey = process.env.VITE_UNSPLASH_ACCESS_KEY;

  const photos = JSON.parse(readFileSync(resolve(inputPath), "utf-8"));

  // Replace mode: start numbering from 01
  let maxNum = 0;

  mkdirSync(WALLPAPERS_DIR, { recursive: true });

  const newEntries = [];
  const localWallpaperLines = [];

  for (const photo of photos) {
    maxNum++;
    const num = String(maxNum).padStart(2, "0");
    const slug = slugify(photo.description);
    const filename = `${num}-${slug}.webp`;
    const jpgPath = join(WALLPAPERS_DIR, `${num}-temp.jpg`);
    const webpPath = join(WALLPAPERS_DIR, filename);

    console.log(`[${num}] Downloading: ${photo.description}`);

    // Download raw image as JPEG
    const imgUrl = `${photo.rawUrl}?w=3840&q=85&fm=jpg`;
    const res = await fetch(imgUrl);
    if (!res.ok) {
      console.error(`  Failed to download: ${res.status} ${res.statusText}`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(jpgPath, buffer);

    // Convert to WebP
    try {
      execFileSync("cwebp", ["-q", "82", "-m", "6", jpgPath, "-o", webpPath], {
        stdio: "pipe",
      });
    } catch (err) {
      console.error(`  cwebp failed: ${err.message}`);
      console.error("  Make sure cwebp is installed: brew install webp");
      unlinkSync(jpgPath);
      continue;
    }
    unlinkSync(jpgPath);

    // Trigger Unsplash download tracking (API terms compliance)
    if (apiKey) {
      try {
        await fetch(photo.downloadLocation, {
          headers: { Authorization: `Client-ID ${apiKey}` },
        });
      } catch {
        // Non-critical, don't fail the whole process
      }
    }

    const entry = {
      id: photo.id,
      filename,
      category: slug,
      mood: "nature",
      description: photo.description,
      color: photo.color,
      blurHash: photo.blurHash,
      width: photo.width,
      height: photo.height,
      photographer: {
        name: photo.photographer.name,
        username: photo.photographer.username,
        profileUrl: photo.photographer.profileUrl,
        portfolioUrl: photo.photographer.portfolioUrl,
      },
      unsplashUrl: photo.unsplashUrl,
      license: "Unsplash License (free for commercial and non-commercial use)",
    };
    newEntries.push(entry);

    const title = titleCase(slug);
    localWallpaperLines.push(
      `  { id: "${num}", path: "wallpapers/${filename}", title: "${title}", photographer: "${photo.photographer.name}", photographerUrl: "${photo.photographer.profileUrl}" },`,
    );

    console.log(`  ✓ ${filename}`);
  }

  // Replace wallpapers.json with only the new entries
  writeFileSync(WALLPAPERS_JSON, JSON.stringify(newEntries, null, 2) + "\n");
  console.log(`\nReplaced wallpapers.json (${newEntries.length} total)`);

  // Print local-wallpapers.ts entries
  if (localWallpaperLines.length > 0) {
    console.log("\n// Paste into src/data/local-wallpapers.ts:");
    for (const line of localWallpaperLines) {
      console.log(line);
    }
  }

  console.log(`\nDone! Added ${newEntries.length} wallpapers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
