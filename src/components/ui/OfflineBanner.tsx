interface Props {
  onLogin?: () => void;
}

export function OfflineBanner({ onLogin }: Props) {
  return (
    <div className="rounded border border-border bg-surface-card px-4 py-3 text-sm text-muted">
      Full content isn't available offline. You're viewing a saved summary.
      {onLogin && (
        <>
          {" "}
          <a
            href="https://x.com/login"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLogin()}
            className="underline hover:text-foreground"
          >
            Log in
          </a>
        </>
      )}
    </div>
  );
}
