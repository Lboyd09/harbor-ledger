import { createContext, useContext } from "react";
import type { useGrowState } from "./session-state";

export type GrowBag = ReturnType<typeof useGrowState>;

export const GrowContext = createContext<GrowBag | null>(null);

export function useGrow() {
  const bag = useContext(GrowContext);
  if (!bag) throw new Error("Grow page used outside Grow");
  return bag;
}
