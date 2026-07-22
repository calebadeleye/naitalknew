#!/usr/bin/env node
/**
 * One-off/backfill image optimizer. Converts oversized project screenshots
 * and client-logo uploads to WebP without upscaling, and (for /data assets)
 * writes responsive 320/480/800/1200 variants. Re-run safely at any time --
 * anything already converted is skipped unless --force is passed.
 *
 * Usage:
 *   node scripts/optimize-images.mjs            # optimize public/data + public/uploads/admin
 *   node scripts/optimize-images.mjs --force     # re-encode even if a .webp already exists
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const FORCE = process.argv.includes("--force");
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "public", "data");
const UPLOADS_DIR = path.join(ROOT, "public", "uploads", "admin");
const SITE_CONTENT_PATH = path.join(ROOT, "storage", "site-content.json");

const RESPONSIVE_WIDTHS = [320, 480, 800, 1200];

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

/** Long screenshot-style images get top-anchored cropped before scaling down,
 * so we stop shipping 10 viewport-tall PNGs for a thumbnail that only ever
 * shows the top slice via CSS object-cover. */
async function optimizeDataImages() {
  if (!fs.existsSync(DATA_DIR)) return;
  const files = fs.readdirSync(DATA_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  console.log(`\n--- public/data (${files.length} source images) ---`);

  for (const file of files) {
    const base = file.replace(/\.(png|jpe?g)$/i, "");
    const inputPath = path.join(DATA_DIR, file);
    const mainOut = path.join(DATA_DIR, `${base}.webp`);
    if (fs.existsSync(mainOut) && !FORCE) {
      console.log(`skip  ${file} (already optimized)`);
      continue;
    }

    const before = fs.statSync(inputPath).size;
    const meta = await sharp(inputPath).metadata();
    const maxH = meta.width * 3;
    const cropH = Math.min(meta.height, maxH);
    const cropped = cropH < meta.height;

    const base_pipeline = () => {
      let p = sharp(inputPath);
      if (cropped) p = p.extract({ left: 0, top: 0, width: meta.width, height: cropH });
      return p;
    };

    const targetWidth = Math.min(meta.width, 900);
    const mainBuffer = await base_pipeline().resize({ width: targetWidth }).webp({ quality: 72 }).toBuffer();
    fs.writeFileSync(mainOut, mainBuffer);

    for (const width of RESPONSIVE_WIDTHS) {
      if (width >= targetWidth) continue; // never upscale
      const variantOut = path.join(DATA_DIR, `${base}-${width}.webp`);
      if (fs.existsSync(variantOut) && !FORCE) continue;
      const buffer = await base_pipeline().resize({ width }).webp({ quality: 68 }).toBuffer();
      fs.writeFileSync(variantOut, buffer);
    }

    console.log(
      `done  ${file.padEnd(38)} ${fmtKB(before).padStart(7)} -> ${fmtKB(mainBuffer.length).padStart(7)}${cropped ? "  [top-cropped]" : ""}`,
    );
  }
}

/** Admin-uploaded logos: convert to content-hashed WebP so the file can be
 * cached immutably, and de-duplicate identical uploads (the repo currently
 * has the same "naipay.png" saved three times under different upload
 * timestamps). storage/site-content.json + any old URL keeps working because
 * we only ever add new files -- nothing already referenced is deleted. */
// Filenames this script (or server.js's own upload-time conversion) produce:
// a bare hex content hash, no timestamp/name prefix. Real admin uploads are
// always saved as `${Date.now()}-${originalBasename}` or, once uploaded
// through the app, `${sha256Hash}.webp` -- either way this pattern only
// matches prior generated output, which must never be re-encoded
// (webp->webp re-compression changes the hash every run, cascading a new
// "generation" of files and rewrites forever).
const OWN_OUTPUT_PATTERN = /^[0-9a-f]{12,64}\.webp$/i;

async function optimizeUploads() {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  const files = fs
    .readdirSync(UPLOADS_DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !OWN_OUTPUT_PATTERN.test(f));
  console.log(`\n--- public/uploads/admin (${files.length} source images) ---`);

  const rewrites = new Map(); // old "/uploads/admin/xxx" -> new path
  const hashToNewPath = new Map();

  for (const file of files) {
    const inputPath = path.join(UPLOADS_DIR, file);
    const before = fs.statSync(inputPath).size;
    const inputBuffer = fs.readFileSync(inputPath);
    const meta = await sharp(inputBuffer).metadata();
    const targetWidth = Math.min(meta.width, 480);

    const outputBuffer = await sharp(inputBuffer)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const hash = crypto.createHash("sha256").update(outputBuffer).digest("hex").slice(0, 16);
    let newName = hashToNewPath.get(hash);
    if (!newName) {
      newName = `${hash}.webp`;
      hashToNewPath.set(hash, newName);
      const outPath = path.join(UPLOADS_DIR, newName);
      if (!fs.existsSync(outPath) || FORCE) {
        fs.writeFileSync(outPath, outputBuffer);
      }
    }

    rewrites.set(`/uploads/admin/${file}`, {
      src: `/uploads/admin/${newName}`,
      width: targetWidth,
      height: Math.round((meta.height / meta.width) * targetWidth),
    });

    console.log(`done  ${file.padEnd(38)} ${fmtKB(before).padStart(7)} -> ${fmtKB(outputBuffer.length).padStart(7)} -> ${newName}`);
  }

  if (fs.existsSync(SITE_CONTENT_PATH)) {
    const content = JSON.parse(fs.readFileSync(SITE_CONTENT_PATH, "utf-8"));
    let changed = false;

    const applyRewrite = (image) => {
      if (!image?.src) return;
      const rewrite = rewrites.get(image.src);
      if (!rewrite) return;
      image.src = rewrite.src;
      image.width = rewrite.width;
      image.height = rewrite.height;
      changed = true;
    };

    applyRewrite(content.brand?.logo);
    for (const logo of content.clientLogos || []) applyRewrite(logo);

    // Admin-saved content keeps its own independent copy of `projects` (a
    // snapshot from whenever it was last saved via the admin panel), so its
    // image references need the same rewriting as logos -- otherwise the
    // underlying files get optimized but this JSON keeps pointing at the
    // original oversized ones. Projects have no width/height field, so this
    // only ever rewrites the path, unlike applyRewrite() above.
    for (const project of content.projects || []) {
      if (!project?.img) continue;
      const uploadRewrite = rewrites.get(project.img);
      if (uploadRewrite) {
        project.img = uploadRewrite.src;
        changed = true;
        continue;
      }
      if (project.img.startsWith("/data/")) {
        const webpPath = project.img.replace(/\.(png|jpe?g)$/i, ".webp");
        if (webpPath !== project.img && fs.existsSync(path.join(ROOT, "public", webpPath))) {
          project.img = webpPath;
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(SITE_CONTENT_PATH, `${JSON.stringify(content, null, 2)}\n`);
      console.log(`\nupdated storage/site-content.json with optimized upload paths`);
    }
  }
}

await optimizeDataImages();
await optimizeUploads();
console.log("\nDone. Original files were kept in place -- nothing was deleted.");
