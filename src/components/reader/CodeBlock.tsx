import { use } from "react";
import parse from "html-react-parser";

const highlightPromise = import("sugar-high").then((m) => m.highlight);

interface Props {
  code: string;
}

function HighlightedCode({ code }: Props) {
  const highlight = use(highlightPromise);
  return <code>{parse(highlight(code))}</code>;
}

export function CodeBlock({ code }: Props) {
  return (
    <pre className="overflow-x-auto rounded bg-surface-card p-4 text-sm leading-relaxed break-inside-avoid">
      <HighlightedCode code={code} />
    </pre>
  );
}
