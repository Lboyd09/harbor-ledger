import { createFileRoute } from "@tanstack/react-router";
import { PlanView } from "@/components/plan-view";

export const Route = createFileRoute("/plan")({ component: PlanView });
