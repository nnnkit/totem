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
      <path d="M10 90L90 90L90 10Z" fill="#e07a5f" />
      <path d="M90 10L55 45L90 90Z" fill="#c96b50" />
      <path d="M55 45L90 10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <path d="M10 90L90 90L90 10Z" fill="url(#totem-shine)" />
    </svg>
  );
}
