import { createFileRoute } from "@tanstack/react-router";
import { MonthBoard } from "@/components/month-board";

export const Route = createFileRoute("/")({ component: MonthBoard });
