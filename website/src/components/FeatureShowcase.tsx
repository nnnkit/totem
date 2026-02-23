import { useScrollReveal } from "../hooks/useScrollReveal";

interface Props {
  title: string;
  description: string;
  image: React.ReactNode;
  reversed?: boolean;
}

export function FeatureShowcase({
  title,
  description,
  image,
  reversed,
}: Props) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`mx-auto flex max-w-5xl flex-col items-center gap-12 lg:flex-row ${
        reversed ? "lg:flex-row-reverse" : ""
      } transition-all duration-700 ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-8 opacity-0"
      }`}
      style={{
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
      }}
    >
      <div className="w-full lg:w-3/5">{image}</div>
      <div className="w-full lg:w-2/5">
        <h3
          className="text-2xl font-medium text-x-text text-balance"
          style={{ fontFamily: '"Spectral", Georgia, serif' }}
        >
          {title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-x-text-secondary text-pretty">
          {description}
        </p>
      </div>
    </div>
  );
}
