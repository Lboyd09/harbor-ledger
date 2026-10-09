import { useState } from "react";

const KEY = "harbor-budget-side";

export function useMoneySide(): ["in" | "out", (side: "in" | "out") => void] {
  const [side, setSide] = useState<"in" | "out">(() => {
    if (typeof sessionStorage === "undefined") return "out";
    return sessionStorage.getItem(KEY) === "in" ? "in" : "out";
  });
  function choose(next: "in" | "out") {
    setSide(next);
    try {
      sessionStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }
  return [side, choose];
}
