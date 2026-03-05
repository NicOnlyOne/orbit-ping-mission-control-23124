import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "orbitping-high-contrast";

export function useHighContrast() {
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("transitioning");
    if (highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
    localStorage.setItem(STORAGE_KEY, String(highContrast));
    setTimeout(() => root.classList.remove("transitioning"), 500);
  }, [highContrast]);

  const toggle = useCallback(() => setHighContrast((v) => !v), []);

  return { highContrast, toggle };
}
