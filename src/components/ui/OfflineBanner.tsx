interface Props {
  onLogin?: () => void;
}

export function OfflineBanner({ onLogin }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted">
      <hr className="w-12 border-t border-dashed border-border" />
      <p>
        You're viewing saved bookmarks.
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
            </a>{" "}
            for full content.
          </>
        )}
      </p>
    </div>
  );
}
