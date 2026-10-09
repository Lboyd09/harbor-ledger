export type OpenRequest = { categoryId: string; ym?: string } | null;

type Listener = (request: OpenRequest) => void;

let listener: Listener | null = null;

export function openCategoryPanel(categoryId: string, ym?: string) {
  listener?.({ categoryId, ym });
}

export function takeCategoryPanelListener(next: Listener) {
  listener = next;
  return () => {
    listener = null;
  };
}
