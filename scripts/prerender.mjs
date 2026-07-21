#!/usr/bin/env node
/**
 * Build-time prerenderer. Renders every public/indexable route (static
 * marketing pages + every published blog post + every published
 * knowledge-base article, the latter two fetched live from the Laravel API)
 * through the real client component tree -- inside jsdom, via
 * react-dom/client, waiting for effects/data fetches to settle -- and
 * writes the resulting markup into dist/prerendered/<route>.html.
 *
 * server.js serves these in place of the bare `<div id="root"></div>` shell
 * for matching routes, so crawlers/social scrapers see real H1/body content
 * on the initial response. Real users still get the exact same client app;
 * React hydrates the snapshot and takes over immediately.
 *
 * Deliberately not a headless-browser (Playwright/Puppeteer) pipeline --
 * jsdom + react-dom/client + the app's own components is the same
 * rendering path this repo's test suite already exercises successfully
 * (vitest.config.ts uses environment: 'jsdom'), so no new heavy dependency
 * or OS-level headless-Chrome requirement is needed on the deploy server.
 *
 * Usage: node scripts/prerender.mjs   (run after `npm run build`)
 */
import { createServer as createViteServer } from "vite";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import React from "react";
import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { INDEXABLE_STATIC_PATHS, prerenderedRelativeFilePath } from "../src/seo/publicRoutes.mjs";

// Run standalone by deploy.sh (not through server.js, which is the only
// other place that currently loads this file), so it needs its own .env
// load to see LARAVEL_API_URL etc.
dotenv.config();

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");
const PRERENDER_DIR = path.join(DIST_DIR, "prerendered");
const LARAVEL_API_URL = (process.env.LARAVEL_API_URL || process.env.VITE_LARAVEL_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const SITE_URL = "https://www.naitalk.com";
const SETTLE_TIMEOUT_MS = 8000;
const SETTLE_POLL_MS = 100;

function readJson(filePath, fallback) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Mirrors server.js's readSiteContent() closely enough for prerendering:
 * same three source files, same shape. Kept separate (rather than
 * importing server.js) because server.js calls startServer() as a
 * top-level side effect -- importing it would spin up a whole Express app.
 */
function readSiteContentForPrerender() {
  const fallback = {
    brand: { logo: { src: "/logo.png", alt: "NAITALK", width: null, height: null } },
    clientLogos: [],
    projects: readJson(path.join(ROOT, "public", "data", "portfolio.json"), { projects: [] }).projects || [],
    reviews: readJson(path.join(ROOT, "public", "data", "reviews.json"), { reviews: [] }).reviews || [],
  };
  return readJson(path.join(ROOT, "storage", "site-content.json"), fallback);
}

/**
 * The only relative (same-origin) fetch() call in the app is
 * PublicSite's `fetch("/api/site-content")` -- Node's native fetch can't
 * resolve a relative URL (no document.baseURI to resolve against), so it
 * throws before ever reaching that endpoint. Every other data call in the
 * app goes through shared/api.ts's laravelApi(), which always builds an
 * absolute URL, so it needs no shimming here.
 */
function installSiteContentFetchShim() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    if (url && url.startsWith("/api/site-content")) {
      return Promise.resolve(
        new Response(JSON.stringify(readSiteContentForPrerender()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return realFetch(input, init);
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

async function fetchAllBlogSlugs() {
  const slugs = [];
  let page = 1;
  for (;;) {
    const { data } = await axios.get(`${LARAVEL_API_URL}/api/v1/public/blog?page=${page}`, { timeout: 8000 });
    for (const post of data.data || []) slugs.push(post.slug);
    if (!data.meta || page >= data.meta.last_page) break;
    page += 1;
  }
  return slugs;
}

async function fetchAllKbSlugs() {
  const { data } = await axios.get(`${LARAVEL_API_URL}/api/v1/public/knowledge-base`, { timeout: 8000 });
  return (data.groups || []).flatMap((group) => (group.articles || []).map((article) => article.slug));
}

function isSettled(rootEl) {
  if (!rootEl.querySelector("h1")) return false;
  // Covers every page's "Loading ..." placeholder for its async content
  // block (plan cards, pricing table, post list, FAQ groups, ...) without
  // hardcoding each page's exact loading copy. Word-boundaried so it
  // doesn't false-positive on copy like "Uploading proof of payment".
  return !/\bloading\b/i.test(rootEl.textContent || "");
}

async function renderRoute(vite, route) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `${SITE_URL}${route}`,
    pretendToBeVisual: true,
  });
  const { window } = dom;

  const previous = {
    window: global.window,
    document: global.document,
    navigator: global.navigator,
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
  };
  // Node 21+ defines a built-in, getter-only `navigator` global -- plain
  // assignment throws ("Cannot set property navigator of #<Object> which
  // has only a getter"). defineProperty overrides it for the duration of
  // this render and is restored the same way in the `finally` block below.
  const setGlobal = (key, value) => Object.defineProperty(global, key, { value, configurable: true, writable: true });
  setGlobal("window", window);
  setGlobal("document", window.document);
  setGlobal("navigator", window.navigator);
  // Referenced as bare identifiers (`sessionStorage.getItem(...)`, not
  // `window.sessionStorage...`) in several places (routing/pendingOrder.ts,
  // lib/adAttribution.ts, lib/analytics.ts) -- bare identifiers resolve via
  // Node's global scope, not through the jsdom `window` object, so these
  // need to be set explicitly too.
  setGlobal("localStorage", window.localStorage);
  setGlobal("sessionStorage", window.sessionStorage);
  window.matchMedia =
    window.matchMedia ||
    (() => ({ matches: false, media: "", addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }));
  global.IntersectionObserver = window.IntersectionObserver =
    window.IntersectionObserver ||
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  global.ResizeObserver = window.ResizeObserver =
    window.ResizeObserver ||
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

  let root;
  try {
    const { PrerenderApp } = await vite.ssrLoadModule("/src/prerenderEntry.tsx");
    const rootEl = window.document.getElementById("root");
    root = createRoot(rootEl);
    root.render(React.createElement(PrerenderApp));

    const start = Date.now();
    while (Date.now() - start < SETTLE_TIMEOUT_MS && !isSettled(rootEl)) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
    }
    if (!isSettled(rootEl)) {
      console.warn(`[prerender] timed out waiting for content on ${route}, skipping`);
      return null;
    }
    // One more tick for trailing state updates (e.g. JSON-LD effects that
    // run just after the content-bearing state update).
    await new Promise((resolve) => setTimeout(resolve, 150));

    const jsonLdTags = Array.from(window.document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((node) => node.outerHTML)
      .join("\n");

    return { html: rootEl.innerHTML, jsonLdTags };
  } catch (error) {
    console.warn(`[prerender] failed to render ${route}: ${error.message}`);
    return null;
  } finally {
    root?.unmount();
    // React's scheduler posts pending work via Node's real setImmediate
    // (not jsdom's per-window timer queue), so it can still fire after
    // unmount() returns -- give it a couple of ticks to drain against the
    // still-valid window/document before we swap globals out from under it
    // and close the window.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    setGlobal("window", previous.window);
    setGlobal("document", previous.document);
    setGlobal("navigator", previous.navigator);
    setGlobal("localStorage", previous.localStorage);
    setGlobal("sessionStorage", previous.sessionStorage);
    window.close();
  }
}

async function main() {
  const indexHtmlPath = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    console.error("[prerender] dist/index.html not found -- run `npm run build` first.");
    process.exit(1);
  }
  const template = fs.readFileSync(indexHtmlPath, "utf-8");
  const restoreFetch = installSiteContentFetchShim();

  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "custom" });

  let blogSlugs = [];
  let kbSlugs = [];
  try {
    blogSlugs = await fetchAllBlogSlugs();
  } catch (error) {
    console.warn(`[prerender] could not fetch blog slugs, skipping blog articles: ${error.message}`);
  }
  try {
    kbSlugs = await fetchAllKbSlugs();
  } catch (error) {
    console.warn(`[prerender] could not fetch knowledge-base slugs, skipping KB articles: ${error.message}`);
  }

  const routes = [...INDEXABLE_STATIC_PATHS, ...blogSlugs.map((slug) => `/blog/${slug}`), ...kbSlugs.map((slug) => `/knowledge-base/${slug}`)];

  fs.rmSync(PRERENDER_DIR, { recursive: true, force: true });
  fs.mkdirSync(PRERENDER_DIR, { recursive: true });

  let succeeded = 0;
  for (const route of routes) {
    // eslint-disable-next-line no-await-in-loop
    const result = await renderRoute(vite, route);
    if (!result) continue;

    const outputHtml = template
      .replace('<div id="root"></div>', `<div id="root">${result.html}</div>`)
      .replace("</head>", `${result.jsonLdTags}\n</head>`);
    const outFile = path.join(PRERENDER_DIR, prerenderedRelativeFilePath(route));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, outputHtml);
    succeeded += 1;
  }

  await vite.close();
  restoreFetch();
  console.log(`[prerender] snapshotted ${succeeded}/${routes.length} routes into dist/prerendered/`);
}

main().catch((error) => {
  console.error("[prerender] fatal error:", error);
  process.exit(1);
});
