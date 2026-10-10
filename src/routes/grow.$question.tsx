import { createFileRoute } from "@tanstack/react-router";
import { GrowView } from "@/components/grow";

export const Route = createFileRoute("/grow/$question")({ component: GrowView });
