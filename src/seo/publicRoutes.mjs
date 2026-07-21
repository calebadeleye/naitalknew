// Server-side (and prerender-time) source of truth for "is this URL part of
// the app at all." Mirrors the prefix-matching if-chain in src/App.tsx's
// App() component -- keep KNOWN_PREFIXES/KNOWN_EXACT_PATHS in sync with that
// chain whenever a public route is added or removed. App.tsx's per-route
// branches stay as-is (they own which component renders); this module only
// answers the yes/no "known route" question so server.js's 404 decision and
// scripts/prerender.mjs's crawl list can't silently drift from what the
// client actually renders.
import { pageSeoConfig } from "./pageSeoConfig.mjs";

// Prefix-matched, exactly like `path.startsWith(prefix)` in App.tsx.
export const KNOWN_PREFIXES = [
  "/admin",
  "/client",
  "/domains",
  "/domain-registration",
  "/domain-transfer",
  "/domain-renewal",
  "/domain-pricing",
  "/web-hosting",
  "/website-care-plans",
  "/website-design",
  "/business-email-hosting",
  "/seo-services",
  "/blog",
  "/knowledge-base",
  "/faqs",
  "/how-to-pay",
  "/service-status",
  "/about",
  "/contact",
  "/portfolio",
  "/privacy-policy",
  "/terms-of-service",
  "/refund-policy",
];

// Exact-matched only, like `path === "..."` in App.tsx.
export const KNOWN_EXACT_PATHS = ["/", "/get-a-website", "/get-a-website/thank-you"];

// Auth-gated SPA zones: always 200 (validity is client-side/auth-dependent,
// not something the server can or should judge), never prerendered, never
// indexed.
export const PRIVATE_PREFIXES = ["/admin", "/client"];

// Prefixes whose valid slugs are dynamic (blog posts, KB articles) --
// existence can only be checked by asking the Laravel API, not this table.
export const DYNAMIC_SLUG_PREFIXES = ["/blog", "/knowledge-base"];

// Known routes that intentionally aren't promoted in the sitemap/prerender
// pass -- a post-submission thank-you page has nothing for search/social to
// index and no stable content worth freezing into a snapshot.
const EXCLUDED_FROM_INDEXING = new Set(["/get-a-website/thank-you"]);

function normalize(pathname) {
  return pathname.replace(/\/$/, "") || "/";
}

export function isKnownPublicPath(pathname) {
  const normalized = normalize(pathname);
  if (KNOWN_EXACT_PATHS.includes(normalized)) return true;
  return KNOWN_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isPrivatePath(pathname) {
  const normalized = normalize(pathname);
  return PRIVATE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isDynamicSlugPath(pathname) {
  const normalized = normalize(pathname);
  return DYNAMIC_SLUG_PREFIXES.some((prefix) => normalized.startsWith(`${prefix}/`) && normalized !== prefix);
}

// Maps a URL path to the dist/prerendered/<...>.html file scripts/prerender.mjs
// would have written for it (if any) -- shared so server.js's lookup can't
// drift from how the prerender script names its output files.
export function prerenderedRelativeFilePath(pathname) {
  const normalized = normalize(pathname);
  const trimmed = normalized === "/" ? "index" : normalized.replace(/^\//, "");
  return `${trimmed}.html`;
}

// Every statically-known, publicly indexable path -- driven by
// pageSeoConfig.mjs (which already excludes /admin, /client, and dynamic
// blog/KB slugs) minus the small excluded-from-indexing set above. Used by
// the sitemap route and the prerender script as the static portion of their
// route lists; both add published blog/KB slugs from Laravel on top.
export const INDEXABLE_STATIC_PATHS = Object.keys(pageSeoConfig).filter((path) => !EXCLUDED_FROM_INDEXING.has(path));
