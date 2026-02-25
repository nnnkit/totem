import { use } from "react";

const highlightPromise = import("sugar-high").then((m) => m.highlight);

interface Props {
  code: string;
}

function HighlightedCode({ code }: Props) {
  const highlight = use(highlightPromise);
  return <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />;
}

export function CodeBlock({ code }: Props) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-surface-card p-4 text-sm leading-relaxed break-inside-avoid">
      <HighlightedCode code={code} />
    </pre>
  );
}
