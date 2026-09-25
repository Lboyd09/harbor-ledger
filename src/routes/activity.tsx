import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/activity")({
  component: function ActivityRedirect() {
    return <Navigate to="/" replace />;
  },
});
