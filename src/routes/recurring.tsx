import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/recurring")({
  component: function RecurringRedirect() {
    return <Navigate to="/categories" replace />;
  },
});
