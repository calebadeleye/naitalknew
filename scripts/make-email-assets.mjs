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

// Hero illustration: open envelope with a ticked card and soft green shapes.
async function hero(file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="460" viewBox="0 0 560 460">
    <defs>
      <linearGradient id="card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef1f4"/></linearGradient>
      <linearGradient id="env" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6eaee"/></linearGradient>
      <linearGradient id="flap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#dfe4e9"/></linearGradient>
      <filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#2f5e1a" flood-opacity="0.18"/></filter>
    </defs>
    <path d="M120 140 C 150 40, 330 20, 430 90 C 520 150, 540 300, 450 370 C 360 440, 170 430, 110 350 C 60 290, 90 220, 120 140 Z" fill="#cdeebb" opacity="0.9"/>
    <path d="M330 30 C 400 10, 520 40, 540 120 C 555 175, 500 190, 470 150 C 440 110, 380 90, 330 30 Z" fill="#b8e6a0" opacity="0.55"/>
    <g stroke="${GREEN}" stroke-width="9" stroke-linecap="round"><path d="M118 168 L 148 182"/><path d="M146 108 L 168 140"/><path d="M210 76 L 216 112"/></g>
    <g filter="url(#sh)">
      <path d="M150 230 L 280 330 L 410 230 L 410 395 Q 410 410 395 410 L 165 410 Q 150 410 150 395 Z" fill="url(#env)"/>
      <rect x="190" y="110" width="180" height="230" rx="18" fill="url(#card)" stroke="#e3e7eb" stroke-width="2"/>
      <circle cx="280" cy="190" r="38" fill="${GREEN_DARK}"/>
      <path d="M263 191 l12 12 l23 -25" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="225" y="252" width="110" height="11" rx="5.5" fill="#d3d9df"/>
      <rect x="240" y="276" width="80" height="11" rx="5.5" fill="#dde2e7"/>
      <path d="M150 230 L 280 330 L 410 230 L 410 238 L 280 342 L 150 238 Z" fill="#d6dce2" opacity="0.6"/>
      <path d="M150 395 L 260 312 Q 280 298 300 312 L 410 395 Q 410 410 395 410 L 165 410 Q 150 410 150 395 Z" fill="url(#flap)"/>
    </g></svg>`;
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
await hero("hero.png");
await badge("icon-lock.png", "lock");
await badge("icon-shield.png", "shield-check");
await badge("icon-support.png", "headphones");
await badge("icon-gear.png", "settings");
await badge("icon-chat.png", "message-circle", { bg: "#2f8f1f", fg: "#ffffff", size: 128 });
await social("social-facebook.png", "facebook");
await social("social-linkedin.png", "linkedin");
await socialX("social-x.png");
for (const f of fs.readdirSync(out)) console.log(f, fs.statSync(path.join(out, f)).size, "bytes");
