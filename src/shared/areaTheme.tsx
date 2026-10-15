import React, { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type AreaTheme = "dark" | "light";

const STORAGE_KEY = "naitalk_area_theme";
const CHANGE_EVENT = "naitalk:area-theme";

function readTheme(): AreaTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/**
 * Light/dark choice for the client area and the admin dashboard (the public
 * site has its own look). Remembered per browser; dark stays the default.
 * Applied as data-theme on .portal-shell / .admin-shell — see the
 * "Light theme" block at the end of index.css.
 */
export function useAreaTheme(): [AreaTheme, () => void] {
  const [theme, setTheme] = useState<AreaTheme>(readTheme);

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const next: AreaTheme = readTheme() === "light" ? "dark" : "light";
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode etc.) — still switch for this page view.
    }
    setTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [theme, toggle];
}

export function AreaThemeToggle({ theme, onToggle, className = "", withLabel = false }: { theme: AreaTheme; onToggle: () => void; className?: string; withLabel?: boolean }) {
  const next = theme === "light" ? "dark" : "light";
  const Icon = theme === "light" ? Moon : Sun;

  return (
    <button type="button" className={className} onClick={onToggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      <Icon className="h-4 w-4" />
      {withLabel && (next === "light" ? "Light mode" : "Dark mode")}
    </button>
  );
}
