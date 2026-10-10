import { useState, type InputHTMLAttributes } from "react";
import { Input } from "./ui/field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "onBlur" | "onFocus" | "onKeyDown"> & {
  /** The saved amount, as it should show when nobody is typing. */
  value: string;
  /** Called once with what was typed, on blur or Enter. Never on each keystroke. */
  onCommit: (draft: string) => void;
  /** Second Escape, after the draft is already the saved value. */
  onEscapeClose?: () => void;
};

/**
 * An amount box that lets someone finish typing before anything is saved.
 * Keystrokes only change the box. Blur or Enter hands the text to onCommit,
 * which decides what (if anything) to store. Escape puts the saved value back.
 */
export function AmountField({ value, onCommit, onEscapeClose, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  return (
    <Input
      inputMode="decimal"
      {...rest}
      value={draft ?? value}
      onFocus={() => {
        setDraft(value);
        setArmed(false);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        setArmed(false);
      }}
      onBlur={() => {
        if (draft != null) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.stopPropagation();
          const dirty = draft != null && draft !== value;
          if (dirty) {
            setDraft(null);
            setArmed(true);
          } else if (armed) {
            onEscapeClose?.();
          } else {
            setArmed(true);
          }
        }
      }}
    />
  );
}
