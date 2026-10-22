// Renders the email template's images (PNG @2x) into public/email/.
// Run: node scripts/make-email-assets.mjs — the Laravel mail template
// (backend/resources/views/vendor/mail/html) loads them from config('mail.brand.asset_url').
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "public/email");
fs.mkdirSync(out, { recursive: true });
const iconDir = path.join(root, "node_modules/lucide-react/dist/esm/icons");

// Pull the element list out of a lucide-react icon module.
function lucide(name) {
  const src = fs.readFileSync(path.join(iconDir, `${name}.js`), "utf8");
  const body = src.slice(src.indexOf("const __iconNode = ") + "const __iconNode = ".length, src.indexOf(";\nconst "));
  const nodes = Function(`return (${body})`)();
  return nodes.map(([tag, attrs]) => {
    const { key, ...rest } = attrs;
    return `<${tag} ${Object.entries(rest).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}="${v}"`).join(" ")}/>`;
  }).join("");
}

const GREEN = "#3f8f1c", GREEN_DARK = "#2f7d15", MINT = "#e8f6df";

// Round icon badge: mint circle, green line icon.
async function badge(file, icon, { bg = MINT, fg = GREEN_DARK, size = 112, stroke = 1.9 } = {}) {
  const s = size, inner = s * 0.46, off = (s - inner) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="${bg}"/>
    <g transform="translate(${off} ${off}) scale(${inner / 24})" fill="none" stroke="${fg}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${lucide(icon)}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, file));
}

// Social icon: white outline circle with white glyph, for the dark footer.
async function social(file, icon) {
  const s = 72, inner = 30, off = (s - inner) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 2}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
    <g transform="translate(${off} ${off}) scale(${inner / 24})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${lucide(icon)}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, file));
}

// X (Twitter) glyph drawn directly (lucide only has the old bird).
async function socialX(file) {
  const s = 72;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <circle cx="36" cy="36" r="34" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
    <path d="M25 24h7.2l6.1 8.4 7-8.4h3.3l-8.8 10.4L50 48h-7.2l-6.6-9-7.6 9h-3.3l9.4-11.1z" fill="#ffffff"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, file));
}

// Logo for light backgrounds = the site logo; light variant for the dark footer: grey text -> white.
async function logos() {
  const src = path.join(root, "public/logo.png");
  fs.copyFileSync(src, path.join(out, "logo.png"));
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a === 0) continue;
    const isGreen = g > r + 25 && g > b + 25;
    if (!isGreen) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; }
  }
  await sharp(data, { raw: info }).png().toFile(path.join(out, "logo-light.png"));
}

await logos();
await badge("icon-lock.png", "lock");
await badge("icon-shield.png", "shield-check");
await badge("icon-support.png", "headphones");
await badge("icon-gear.png", "settings");
await badge("icon-chat.png", "message-circle", { bg: "#2f8f1f", fg: "#ffffff", size: 128 });
await social("social-facebook.png", "facebook");
await social("social-linkedin.png", "linkedin");
await socialX("social-x.png");
for (const f of fs.readdirSync(out)) console.log(f, fs.statSync(path.join(out, f)).size, "bytes");
