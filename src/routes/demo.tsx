import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { HomeDashboard } from "@/components/home-dashboard";
import { useBudgetStore } from "@/store/budget-store";

export const Route = createFileRoute("/demo")({ component: DemoPage });

function DemoPage() {
  const loadSample = useBudgetStore((s) => s.loadSample);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const before = localStorage.getItem("harbor-ledger-v3");
    loadSample();
    if (before != null) localStorage.setItem("harbor-ledger-v3", before);
    else localStorage.removeItem("harbor-ledger-v3");
  }, [loadSample]);
  return <HomeDashboard />;
}
