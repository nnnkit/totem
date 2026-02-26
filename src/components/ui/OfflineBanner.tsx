interface Props {
  onLogin?: () => void;
}

export function OfflineBanner({ onLogin }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted">
      <hr className="w-12 border-t border-dashed border-border" />
      <p>
        Offline mode.
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
            to sync new bookmarks.
          </>
        )}
      </p>
    </div>
  );
}
