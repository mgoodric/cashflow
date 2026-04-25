"use client";

import { useEffect, useState, useSyncExternalStore, useCallback } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "cashflow-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// Use useSyncExternalStore for hydration-safe mounted detection
const subscribe = (cb: () => void) => { cb(); return () => {}; };
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const cycle = useCallback(() => {
    const next: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, [theme]);

  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" className="w-20 gap-1.5" disabled>
        <span className="text-xs">Theme</span>
      </Button>
    );
  }

  const icon = theme === "light" ? "\u2600" : theme === "dark" ? "\u263D" : "\u25D0";
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      className="w-20 gap-1.5"
      aria-label={`Theme: ${label}. Click to change.`}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-xs">{label}</span>
    </Button>
  );
}
