import { useEffect, useRef, useState } from "react";
import { useLivelyMotion } from "../use-lively-motion";

/** Counts from zero once. Calm, reduced motion, and the server render show the final number. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const lively = useLivelyMotion();
  const [shown, setShown] = useState(value);
  const played = useRef(false);

  useEffect(() => {
    if (!lively || played.current) {
      setShown(value);
      return;
    }
    played.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      setShown(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, lively]);

  return <span className="tabular">{format(shown)}</span>;
}
