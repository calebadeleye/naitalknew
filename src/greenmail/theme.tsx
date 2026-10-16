import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * Light or dark Green Mail, chosen in Settings and remembered on this device.
 * "system" follows the phone or computer's own setting. Dark mode is a set of
 * colour overrides under .gm-dark (see index.css), so components keep their
 * normal light classes.
 */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "greenmail_theme";

function stored(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

const ThemeContext = createContext<{ choice: ThemeChoice; dark: boolean; setChoice: (choice: ThemeChoice) => void }>({ choice: "light", dark: false, setChoice: () => undefined });

export const useGreenmailTheme = () => useContext(ThemeContext);

export function GreenmailThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(stored);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const update = () => setSystemDark(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const dark = choice === "dark" || (choice === "system" && systemDark);

  // The phone's status bar / browser chrome matches.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = dark ? "#0b1117" : previous;
    return () => {
      meta.content = previous;
    };
  }, [dark]);

  const setChoice = (next: ThemeChoice) => {
    setChoiceState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, but still applied for now.
    }
  };

  return (
    <ThemeContext.Provider value={{ choice, dark, setChoice }}>
      <div className={dark ? "gm-dark" : undefined}>{children}</div>
    </ThemeContext.Provider>
  );
}

/**
 * The part of the screen not covered by the keyboard. iPhone Safari doesn't
 * shrink the page when the keyboard opens — it slides it up instead, which
 * pushed the composer's Send buttons out of sight. Sizing the app to the
 * visible area keeps the top bar and the bottom bar on screen while typing.
 */
export function useVisibleViewport(): { height: number; top: number } | null {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      // Leave it alone while someone pinch-zooms.
      if (Math.abs(viewport.scale - 1) > 0.01) return;
      setBox({ height: Math.round(viewport.height), top: Math.round(viewport.offsetTop) });
      // Safari may still scroll the page itself; keep it pinned at the top.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return box;
}
