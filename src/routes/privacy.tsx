import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-5 py-8">
      <h1 className="font-display text-3xl font-semibold">Privacy</h1>
      <p className="text-sm">Your budget lives on this device until you sign in. Then one copy sits in our database, encrypted in transit.</p>
      <p className="text-sm">We never ask for a bank password. We never sell your data. There are no ads.</p>
      <p className="text-sm">Export anytime from Settings. Delete anytime from the Danger zone.</p>
      <p className="text-sm">Calculators on this site do not read your saved budget.</p>
      <p className="text-sm">Funnel events, if collected later, never include amounts, merchants, names, or emails.</p>
      <Link to="/" className="font-medium text-primary">Go to Today</Link>
    </div>
  );
}
