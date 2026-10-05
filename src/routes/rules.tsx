import { createFileRoute } from "@tanstack/react-router";
import { SortingView } from "@/components/sorting-view";

export const Route = createFileRoute("/rules")({ component: SortingView });
