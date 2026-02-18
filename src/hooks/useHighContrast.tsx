import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "orbitping-high-contrast";

export function useHighContrast() {
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
    localStorage.setItem(STORAGE_KEY, String(highContrast));
  }, [highContrast]);

  const toggle = useCallback(() => setHighContrast((v) => !v), []);

  return { highContrast, toggle };
}
