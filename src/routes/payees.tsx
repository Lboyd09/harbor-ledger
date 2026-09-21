import { createFileRoute } from "@tanstack/react-router";
import { PayeeView } from "@/components/payee-view";

export const Route = createFileRoute("/payees")({ component: PayeeView });
