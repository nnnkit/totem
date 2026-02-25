import { TotemLogo } from "./TotemLogo";

interface Props {
  phase: "need_login" | "connecting";
  onLogin: () => Promise<void>;
}

export function Onboarding({ phase, onLogin }: Props) {
  if (phase === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh bg-surface text-foreground">
        <TotemLogo className="size-12 mb-6" />
        <span className="animate-spin mb-4"><div className="size-8 border-2 border-accent border-t-transparent rounded-full" /></span>
        <p className="text-lg font-bold text-balance">Connecting to X...</p>
        <p className="text-muted text-sm mt-2 text-pretty">
          Syncing your session in the background.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-surface text-foreground">
      <TotemLogo className="size-14 mb-8" />

      <h1 className="text-2xl font-bold mb-2 text-balance">A calm reader for your X bookmarks.</h1>
      <p className="text-muted text-lg mb-8 max-w-sm text-center text-pretty">
        Read your saved posts in a clean, distraction-free view.
      </p>

      <a
        href="https://x.com/login"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          onLogin().catch(() => {});
        }}
        className="bg-accent hover:bg-accent/90 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
      >
        Log in to X
      </a>

      <p className="text-muted text-sm mt-4 text-pretty">
        Already logged in? Just open a new tab.
      </p>
    </div>
  );
}
