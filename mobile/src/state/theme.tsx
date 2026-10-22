import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { kvGet, kvSet } from "../lib/db";

/** Green Mail colours (the owner's mockup): green #22a04f / #15803d, white cards, navy drawer. */
const shared = {
  green: "#22a04f",
  greenDark: "#15803d",
  greenDeep: "#0b3d24",
  navy: "#0f1a2b",
  navySoft: "#1a2638",
  navyText: "#e2e8f0",
  navyMuted: "#94a3b8",
  danger: "#dc2626",
  warning: "#f59e0b",
  white: "#ffffff",
};

export const lightColors = {
  ...shared,
  background: "#f6f8f7",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  subtle: "#94a3b8",
  border: "#e5e7eb",
  input: "#f1f5f4",
  greenSoft: "#e8f6ee",
  unreadDot: "#22a04f",
  banner: "#fff7ed",
  bannerText: "#9a3412",
};

export const darkColors: typeof lightColors = {
  ...shared,
  background: "#0b1220",
  card: "#111a2b",
  text: "#e5e7eb",
  muted: "#94a3b8",
  subtle: "#64748b",
  border: "#1f2a3d",
  input: "#18233a",
  greenSoft: "#123524",
  unreadDot: "#4ade80",
  banner: "#3b2410",
  bannerText: "#fdba74",
};

export type Colors = typeof lightColors;
export type ThemePreference = "system" | "light" | "dark";

type ThemeValue = { colors: Colors; dark: boolean; preference: ThemePreference; setPreference: (p: ThemePreference) => void };

const ThemeContext = createContext<ThemeValue>({ colors: lightColors, dark: false, preference: "system", setPreference: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    kvGet<ThemePreference>("theme").then((p) => p && setPref(p)).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const dark = preference === "dark" || (preference === "system" && system === "dark");
    return {
      colors: dark ? darkColors : lightColors,
      dark,
      preference,
      setPreference: (p) => {
        setPref(p);
        kvSet("theme", p).catch(() => {});
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
