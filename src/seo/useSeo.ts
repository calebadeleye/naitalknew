import { useEffect } from "react";
import { getPageSeo } from "./pageSeoConfig.mjs";

type SeoOverrides = {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  if (!href) return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

/**
 * Client-side companion to server.js's server-rendered meta tags — this
 * keeps document.title/meta in sync during in-app navigation (server.js
 * only sets the tags correctly on the initial full-page load). Real
 * crawlers/social scrapers rely on the server-rendered tags, not this hook.
 */
export function useSeo(overrides: SeoOverrides = {}) {
  useEffect(() => {
    const defaults = getPageSeo(window.location.pathname);
    const title = overrides.title || defaults.title;
    const description = overrides.description || defaults.description;
    const canonical = overrides.canonical || defaults.canonical;
    const ogImage = overrides.ogImage || defaults.ogImage;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertCanonical(canonical);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:site_name", defaults.siteName);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", ogImage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides.title, overrides.description, overrides.canonical, overrides.ogImage]);
}
