import "../../mock/setup";
import { seedDatabase } from "../../mock/seed-db";
import { ErrorBoundary } from "@ext/components/ErrorBoundary";
import DemoApp from "./DemoApp";
import { useEffect, useState } from "react";

export default function DemoIsland() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seedDatabase().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <ErrorBoundary>
      <DemoApp />
    </ErrorBoundary>
  );
}
