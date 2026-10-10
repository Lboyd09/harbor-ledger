import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: () => (
      <div className="mx-auto max-w-lg space-y-3 px-5 py-12">
        <h1 className="font-display text-2xl font-semibold">That page moved.</h1>
        <a href="/" className="font-medium text-primary">
          Go to Today
        </a>
      </div>
    ),
  });
}
