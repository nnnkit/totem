interface Props {
  className?: string;
}

export function TotemLogo({ className = "size-12" }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <defs>
        <linearGradient id="totem-shine" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.45" />
          <stop offset="50%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="#1c1c1e" />
      <path d="M20 80L80 80L80 20Z" fill="#e07a5f" />
      <path d="M80 20L52.5 47.5L80 80Z" fill="#c96b50" />
      <path d="M52.5 47.5L80 20" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <path d="M20 80L80 80L80 20Z" fill="url(#totem-shine)" />
    </svg>
  );
}
