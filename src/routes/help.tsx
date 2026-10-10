import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/help")({ component: HelpPage });

const BANKS: { bank: string; steps: string[] }[] = [
  {
    bank: "Chase",
    steps: [
      "Sign in on chase.com (the download is more reliable there than in the app).",
      "Open the account, then See all activity or Account activity.",
      "Choose Download, pick CSV, set a date range, and download.",
      "The file often starts with Details, Posting Date, Description, Amount.",
    ],
  },
  {
    bank: "Bank of America",
    steps: ["Sign in, then Activity, then Download.", "Pick CSV, not QFX, OFX, or PDF.", "Date, Description, and Amount are enough."],
  },
  {
    bank: "Wells Fargo",
    steps: ["Account, then Activity, then Download.", "A CSV may have no header row. Date, amount, and description are still read."],
  },
  {
    bank: "Capital One, Citi, Ally, and most cards",
    steps: ["Look for Download, Export, or Spreadsheet in account activity.", "Prefer CSV. Debit and Credit columns are fine."],
  },
];

function HelpPage() {
  return (
    <div className="min-w-0 space-y-8">
      <h1 className="font-display text-2xl font-semibold md:text-3xl">Help</h1>
      <section id="csv" className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Bank file</h2>
        <p className="text-sm">No bank login. Download a CSV, then import it.</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Sign in on the bank or card website.</li>
          <li>Open one account’s activity.</li>
          <li>Find Download or Export. Not a PDF.</li>
          <li>Choose CSV.</li>
          <li>Pick a month to start. Duplicates are skipped.</li>
          <li>Save the file, then drop it on Import.</li>
        </ol>
        {BANKS.map((bank) => (
          <div key={bank.bank}>
            <h3 className="text-sm font-medium">{bank.bank}</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-muted">
              {bank.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        ))}
        <Link to="/import" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
          Back to import
        </Link>
      </section>
      <section id="safe-to-spend" className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Safe to spend</h2>
        <p className="text-sm">Income so far, minus this month’s planned bills, minus overspending.</p>
      </section>
      <section id="cushion" className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Cushion</h2>
        <p className="text-sm">Cash that covers a few months of spending. It is not a goal.</p>
      </section>
      <section id="rollover" className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Roll-over</h2>
        <p className="text-sm">A spending category can keep leftovers, or start over next month.</p>
        <p className="text-sm">Income never carries into the next month.</p>
      </section>
    </div>
  );
}
