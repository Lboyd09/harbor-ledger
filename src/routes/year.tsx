import { createFileRoute } from "@tanstack/react-router";
import { YearHome } from "@/components/year-home";

export const Route = createFileRoute("/year")({ component: YearHome });
