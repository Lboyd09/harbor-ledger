import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { confirmEmailToken } from "@/lib/budget/email-links";
import { Button } from "@/components/ui/button";

type ConfirmSearch = { token?: string };

const confirmInflight = new Map<string, ReturnType<typeof confirmEmailToken>>();

function confirmOnce(token: string) {
  const existing = confirmInflight.get(token);
  if (existing) return existing;
  const pending = confirmEmailToken({ data: { token } });
  confirmInflight.set(token, pending);
  return pending;
}

export const Route = createFileRoute("/confirm")({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: Confirm,
});

function Confirm() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("This confirmation link is missing its token.");
      return;
    }
    let cancel = false;
    void confirmOnce(token)
      .then((result) => {
        if (cancel) return;
        if (!result.ok) {
          setState("error");
          setError(result.error);
          return;
        }
        setState("done");
      })
      .catch(() => {
        if (cancel) return;
        setState("error");
        setError("Could not confirm that email.");
      });
    return () => {
      cancel = true;
    };
  }, [token]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-medium uppercase tracking-widest text-muted">Harbor Ledger</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">Confirm email</h1>
      {state === "working" ? <p className="mt-3 text-sm text-muted">Checking the link…</p> : null}
      {state === "done" ? <p className="mt-3 text-sm text-muted">Email confirmed. You can go back to the ledger.</p> : null}
      {state === "error" ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <Link to="/" className="mt-6">
        <Button className="w-full">Open Harbor</Button>
      </Link>
    </main>
  );
}
