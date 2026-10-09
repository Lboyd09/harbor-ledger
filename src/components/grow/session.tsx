import type { ReactNode } from "react";
import { GrowContext } from "./grow-context";
import { useGrowState } from "./session-state";

export function GrowProvider({ children }: { children: ReactNode }) {
  const bag = useGrowState();
  return <GrowContext.Provider value={bag}>{children}</GrowContext.Provider>;
}
