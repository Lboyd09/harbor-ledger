import { createFileRoute } from "@tanstack/react-router";
import { DesktopOverview, MobileOverview } from "@/components/overview";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <>
      <div className="md:hidden">
        <MobileOverview />
      </div>
      <div className="hidden md:block">
        <DesktopOverview />
      </div>
    </>
  );
}
