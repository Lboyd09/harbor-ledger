/** Download a text file. Revoking the blob immediately can save an empty file. */
export function downloadText(filename: string, text: string, type: string) {
  const payload = type.includes("csv") && !text.startsWith("\uFEFF") ? `\uFEFF${text}` : text;
  const blob = new Blob([payload], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}
