"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "system" | "light" | "dark";
const STORAGE_KEY = "srcflow:theme-preview-mode";
const ORDER: ThemeMode[] = ["system", "light", "dark"];

type ThemeModeControl = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  cycle: () => void;
};
const ThemeModeContext = createContext<ThemeModeControl>({
  mode: "system",
  setMode: () => {},
  cycle: () => {},
});
export const useThemeMode = () => useContext(ThemeModeContext);

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      setMode(saved);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (mode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = mode;
    }
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, loaded]);

  const cycle = () => setMode((m) => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, cycle }}>
      {children}
    </ThemeModeContext.Provider>
  );
}
