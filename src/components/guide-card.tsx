import { useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "harbor-guide-v1";

function readHidden() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function GuideCard() {
  const [hidden, setHidden] = useState(readHidden);

  if (hidden) {
    return (
      <button
        type="button"
        className="text-sm text-muted underline-offset-2 hover:underline"
        onClick={() => {
          try {
            window.localStorage.removeItem(KEY);
          } catch {
            /* ignore */
          }
          setHidden(false);
        }}
      >
        How Harbor works
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">How Harbor works</h2>
        <button
          type="button"
          className="text-sm text-muted underline-offset-2 hover:underline"
          onClick={() => {
            try {
              window.localStorage.setItem(KEY, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          Hide
        </button>
      </div>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
        <li>
          <Link to="/import" className="text-primary underline-offset-2 hover:underline">
            Import a CSV
          </Link>{" "}
          from your bank. Harbor does not log into any account.
        </li>
        <li>
          Open{" "}
          <Link to="/categories" className="text-primary underline-offset-2 hover:underline">
            Categories
          </Link>
          . Merchants you pay most often sit at the top. Change one category and every matching charge updates.
        </li>
        <li>
          Open a month row to divide one deposit or charge into two categories. The overall category stays. On an
          expense, Payback is in the category list: it matches the closest deposit and both leave that month.
        </li>
        <li>
          <Link to="/plan" className="text-primary underline-offset-2 hover:underline">
            Budget
          </Link>{" "}
          is the monthly amount that starts over.{" "}
          <Link to="/funds" className="text-primary underline-offset-2 hover:underline">
            Funds
          </Link>{" "}
          keep what you don’t spend.{" "}
          <Link to="/year" className="text-primary underline-offset-2 hover:underline">
            Year
          </Link>{" "}
          is the summary, the charts, and the spreadsheet. Account exports Excel and Google Sheets.
        </li>
      </ol>
    </section>
  );
}
