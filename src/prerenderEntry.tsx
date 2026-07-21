import { ToastProvider } from "./toast/ToastProvider";
import App from "./App";

/**
 * Dedicated entry point for scripts/prerender.mjs -- the same component
 * tree main.tsx mounts in the browser, minus StrictMode (which double
 * -invokes effects in dev and would double every network call during a
 * prerender pass) and the index.css import (irrelevant to a text-content
 * snapshot, and not something Vite's SSR module loader needs to process).
 */
export function PrerenderApp() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
