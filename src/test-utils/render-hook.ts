/**
 * Minimal hook renderer for jsdom-environment tests — drives a hook through a
 * throwaway component with React's own act(), no external testing library.
 * Use under `// @vitest-environment jsdom`.
 */
import { act, createElement, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

export { act };

// React's act() refuses to run unless the environment opts in.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

export interface RenderHookOptions<TProps> {
  initialProps?: TProps;
  // Wrap the harness in <StrictMode> to surface double-invoked effects.
  strictMode?: boolean;
}

export interface RenderHookResult<TResult, TProps> {
  result: { current: TResult };
  rerender: (props?: TProps) => Promise<void>;
  unmount: () => Promise<void>;
}

export async function renderHook<TResult, TProps = void>(
  callback: (props: TProps) => TResult,
  options: RenderHookOptions<TProps> = {},
): Promise<RenderHookResult<TResult, TProps>> {
  const container = document.createElement("div");
  const result = { current: undefined as unknown as TResult };
  let currentProps = options.initialProps as TProps;
  let root!: Root;

  function Harness({ hookProps }: { hookProps: TProps }): ReactNode {
    result.current = callback(hookProps);
    return null;
  }

  const renderTree = () => {
    const element = createElement(Harness, { hookProps: currentProps });
    root.render(
      options.strictMode ? createElement(StrictMode, null, element) : element,
    );
  };

  await act(async () => {
    root = createRoot(container);
    renderTree();
  });

  return {
    result,
    async rerender(props?: TProps) {
      if (arguments.length > 0) currentProps = props as TProps;
      await act(async () => {
        renderTree();
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

/**
 * Flush pending promise microtasks and any React work they schedule (e.g. an
 * async effect that resolves and then calls setState). Wrapped in act() so the
 * resulting re-render is applied before assertions run.
 */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
