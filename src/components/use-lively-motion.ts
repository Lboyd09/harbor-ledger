import { useEffect, useState } from "react";
import { useBudgetStore } from "@/store/budget-store";

export function useLivelyMotion() {
  const motion = useBudgetStore((s) => s.profile.motion ?? "lively");
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return motion === "lively" && !reduce;
}
