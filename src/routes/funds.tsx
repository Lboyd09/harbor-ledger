import { createFileRoute } from "@tanstack/react-router";
import { FundsView } from "@/components/funds-view";

export const Route = createFileRoute("/funds")({ component: FundsView });
