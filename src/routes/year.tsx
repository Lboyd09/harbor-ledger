import { createFileRoute } from "@tanstack/react-router";
import { YearSheet } from "@/components/year-sheet";

export const Route = createFileRoute("/year")({ component: YearSheet });
