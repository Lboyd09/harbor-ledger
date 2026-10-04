import { createFileRoute } from "@tanstack/react-router";
import { MonthPage } from "@/components/month-page";

export const Route = createFileRoute("/month")({ component: MonthPage });
