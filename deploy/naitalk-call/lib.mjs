// Shared, side-effect-free helpers for the Naitalk Call server tools
// (sync.mjs and router.mjs). Plain Node, no packages, so the tools run on
// mail.naitalk.com with nothing but the system's node.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MANAGED_BEGIN = "# BEGIN naitalk-call managed keys";
export const MANAGED_END = "# END naitalk-call managed keys";

const b64url = (input) => Buffer.from(input).toString("base64url");

/** HS256 JWT, as LiveKit uses for access tokens and webhook signatures. */
export function signJwt(claims, secret) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** Claims of a valid HS256 JWT signed with `secret`, or null. */
export function verifyJwt(token, secret, now = Math.floor(Date.now() / 1000)) {
  const parts = String(token || "").replace(/^Bearer\s+/i, "").split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  const given = Buffer.from(parts[2], "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (header.alg !== "HS256") return null;
    if (claims.exp && now > claims.exp + 60) return null;
    if (claims.nbf && now < claims.nbf - 60) return null;
    return claims;
  } catch {
    return null;
  }
}

export const bodyHash = (body) => createHash("sha256").update(body).digest("base64");

/** The Authorization value LiveKit puts on a webhook, for `body` signed as `apiKey`. */
export function signWebhook(body, apiKey, apiSecret, now = Math.floor(Date.now() / 1000)) {
  return signJwt({ iss: apiKey, nbf: now, exp: now + 300, sha256: bodyHash(body) }, apiSecret);
}

/** True when `authorization` is LiveKit's signature of exactly `body` by `apiKey`. */
export function verifyWebhook(body, authorization, apiKey, apiSecret, now) {
  const claims = verifyJwt(authorization, apiSecret, now);
  return Boolean(claims && claims.iss === apiKey && claims.sha256 === bodyHash(body));
}

/** Room the event is about (room events, egress and ingress all carry one). */
export function roomOf(event) {
  return event?.room?.name || event?.egressInfo?.roomName || event?.ingressInfo?.roomName || "";
}

/** The route whose prefix is the longest match for `room` ("acme" matches "acme-…"), or null. */
export function routeFor(room, routes) {
  return (routes || [])
    .filter((route) => route.prefix && room.startsWith(`${route.prefix}-`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0] || null;
}

// --- livekit.yaml -------------------------------------------------------------
// The file is edited line by line, never re-serialised, so comments and every
// line Naitalk does not manage (Cradle's key above all) stay byte-for-byte.

/** [start, end) line indexes of a top-level `name:` block. */
function topLevelBlock(lines, name) {
  const start = lines.findIndex((line) => new RegExp(`^${name}:\\s*(#.*)?$`).test(line));
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && (/^\s+\S/.test(lines[end]) || lines[end].trim() === "")) end++;
  // Trailing blank lines belong to the gap before the next block.
  while (end > start + 1 && lines[end - 1].trim() === "") end--;
  return [start, end];
}

/** Every `key: secret` under `keys:`, managed or not. */
export function readKeys(yaml) {
  const lines = yaml.split("\n");
  const block = topLevelBlock(lines, "keys");
  const keys = {};
  if (!block) return keys;
  for (const line of lines.slice(block[0] + 1, block[1])) {
    const match = line.match(/^\s+([A-Za-z0-9_-]+):\s*"?([^\s"#]+)"?\s*(#.*)?$/);
    if (match) keys[match[1]] = match[2];
  }
  return keys;
}

/** webhook.api_key: the key LiveKit signs every webhook with. */
export function readWebhookKey(yaml) {
  const lines = yaml.split("\n");
  const block = topLevelBlock(lines, "webhook");
  if (!block) return null;
  for (const line of lines.slice(block[0] + 1, block[1])) {
    const match = line.match(/^\s+api_key:\s*"?([^\s"#]+)"?/);
    if (match) return match[1];
  }
  return null;
}

/**
 * livekit.yaml with the managed keys replaced by `managed` and webhook.urls
 * pointed at `webhookUrl`. Keys that would clash with a key Naitalk does not
 * manage are left out and listed in `skipped`.
 */
export function renderConfig(yaml, managed, webhookUrl) {
  const lines = yaml.split("\n");

  const keysBlock = topLevelBlock(lines, "keys");
  if (!keysBlock) throw new Error("livekit.yaml has no top-level keys: block");
  const [keyStart, keyEnd] = keysBlock;
  const body = lines.slice(keyStart + 1, keyEnd);
  const begin = body.findIndex((line) => line.trim() === MANAGED_BEGIN);
  const end = body.findIndex((line) => line.trim() === MANAGED_END);
  if ((begin < 0) !== (end < 0) || end < begin) throw new Error("livekit.yaml managed key markers are unbalanced");
  const unmanaged = begin < 0 ? body : [...body.slice(0, begin), ...body.slice(end + 1)];
  const indent = (unmanaged.find((line) => line.trim() !== "" && !line.trim().startsWith("#")) || "  x").match(/^\s*/)[0];

  const taken = new Set(Object.keys(readKeys(["keys:", ...unmanaged].join("\n"))));
  const skipped = [];
  const entries = [];
  for (const [key, secret] of Object.entries(managed).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[A-Za-z0-9_-]+$/.test(key) || !/^[A-Za-z0-9_-]+$/.test(secret) || taken.has(key)) {
      skipped.push(key);
      continue;
    }
    entries.push(`${indent}${key}: ${secret}`);
  }
  const managedLines = [`${indent}${MANAGED_BEGIN}`, ...entries, `${indent}${MANAGED_END}`];
  const out = [...lines.slice(0, keyStart + 1), ...unmanaged, ...managedLines, ...lines.slice(keyEnd)];

  const hookBlock = topLevelBlock(out, "webhook");
  if (!hookBlock) throw new Error("livekit.yaml has no top-level webhook: block");
  const urlsAt = out.findIndex((line, i) => i > hookBlock[0] && i < hookBlock[1] && /^\s+urls:\s*$/.test(line));
  if (urlsAt < 0) throw new Error("livekit.yaml webhook: block has no urls: list");
  let itemsEnd = urlsAt + 1;
  while (itemsEnd < hookBlock[1] && /^\s+-\s/.test(out[itemsEnd])) itemsEnd++;
  const itemIndent = out[urlsAt + 1]?.match(/^(\s+)-\s/)?.[1] ?? `${out[urlsAt].match(/^\s*/)[0]}  `;
  out.splice(urlsAt + 1, itemsEnd - urlsAt - 1, `${itemIndent}- ${webhookUrl}`);

  return { yaml: out.join("\n"), skipped };
}
