import { SortQueue } from "./sort-queue";

export function CategorizeCoach({ onClose, doneLabel = "Back to the month" }: { onClose: () => void; doneLabel?: string }) {
  return <SortQueue onDone={onClose} doneLabel={doneLabel} />;
}