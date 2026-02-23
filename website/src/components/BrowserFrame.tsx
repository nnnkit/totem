interface Props {
  title: string;
  children: React.ReactNode;
}

export function BrowserFrame({ title, children }: Props) {
  return (
    <div className="rounded-xl border border-x-border bg-x-card shadow-2xl overflow-hidden">
      <div className="flex items-center border-b border-x-border px-4 py-3">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-yellow-400/80" />
          <span className="size-3 rounded-full bg-green-400/80" />
        </div>
        <span className="flex-1 text-center text-xs text-x-text-secondary">
          {title}
        </span>
        <div className="w-14" />
      </div>
      {children}
    </div>
  );
}
