import "../../mock/setup";
import { seedDatabase } from "../../mock/seed-db";
import { ErrorBoundary } from "@ext/components/ErrorBoundary";
import DemoApp from "./DemoApp";
import { useEffect, useState } from "react";

function LoadingScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 100 100" className="size-10 animate-pulse" fill="none">
          <path d="M10 90L90 90L90 10Z" fill="#e07a5f" />
          <path d="M90 10L55 45L90 90Z" fill="#c96b50" />
          <path d="M55 45L90 10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        </svg>
        <p className="text-sm text-muted">Loading demo&hellip;</p>
      </div>
    </div>
  );
}

export default function DemoIsland() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seedDatabase().then(() => setReady(true));
  }, []);
  if (!ready) return <LoadingScreen />;
  return (
    <ErrorBoundary>
      <DemoApp />
    </ErrorBoundary>
  );
}
