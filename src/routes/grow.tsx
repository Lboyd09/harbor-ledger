import { createFileRoute } from "@tanstack/react-router";
import { GrowView } from "@/components/grow-view";

export const Route = createFileRoute("/grow")({ component: GrowView });
