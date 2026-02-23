interface Props {
  className?: string;
}

export function TotemLogo({ className = "size-12" }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <rect x="10" y="10" width="80" height="80" rx="16" fill="#1A1918" />
      <path d="M32 68L68 68L68 32Z" fill="#e07a5f" />
      <path d="M68 32L52 50L68 68Z" fill="#c96b50" />
      <path d="M52 50L68 32" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />
    </svg>
  );
}
