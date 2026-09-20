import { createFileRoute } from "@tanstack/react-router";
import { RecurringView } from "@/components/recurring-view";

export const Route = createFileRoute("/recurring")({ component: RecurringView });
