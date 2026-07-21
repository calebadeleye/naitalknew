import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> tag keyed by `id`, replacing any previous
 * content for that id and removing the tag on unmount/id change. Shared by
 * every page that needs structured data (homepage ProfessionalService,
 * BreadcrumbList, BlogPosting, ...) so there's one inject/cleanup
 * implementation instead of one per call site. A build-time prerender pass
 * (scripts/prerender.mjs) waits for the app to mount and settle, so these
 * tags end up captured in the static HTML crawlers see, not just the
 * client-rendered DOM.
 *
 * Pass a `useMemo`-stable `data` object -- a new object identity every
 * render would re-run the effect (and rewrite the DOM) on every render.
 */
export function useJsonLd(id: string, data: Record<string, unknown> | null) {
  useEffect(() => {
    if (!data) return undefined;

    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);

    return () => {
      script?.remove();
    };
  }, [id, data]);
}
