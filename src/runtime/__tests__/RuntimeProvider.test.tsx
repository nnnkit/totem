// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  phase: "connecting",
  delay: 500 as number | null,
  actions: {
    boot: vi.fn(async () => {}),
    dispose: vi.fn(),
    checkAuth: vi.fn(async () => {}),
    connectingTimeout: vi.fn(),
  },
}));
vi.mock("../../stores/selectors", () => ({
  useRuntimeActions: () => mocks.actions,
  useAuthPhase: () => mocks.phase,
  useAuthRetryDelayMs: () => mocks.delay,
}));
vi.mock("../../db", () => ({ closeDb: vi.fn() }));
import { RuntimeProvider } from "../RuntimeProvider";

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  });
  mocks.phase = "connecting";
  mocks.delay = 500;
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("auth retry lifecycle", () => {
  it("continues checking when snapshots leave the retry delay unchanged", async () => {
    await act(async () => root.render(<RuntimeProvider />));
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(mocks.actions.checkAuth).toHaveBeenCalledTimes(3);
    mocks.phase = "ready";
    mocks.delay = null;
    await act(async () => root.render(<RuntimeProvider />));
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(mocks.actions.checkAuth).toHaveBeenCalledTimes(3);
  });

  it("does not overlap slow checks or reschedule after cancellation", async () => {
    let resolve!: () => void;
    mocks.actions.checkAuth.mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    await act(async () => root.render(<RuntimeProvider />));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(mocks.actions.checkAuth).toHaveBeenCalledTimes(1);
    mocks.delay = null;
    mocks.phase = "ready";
    await act(async () => root.render(<RuntimeProvider />));
    await act(async () => resolve());
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(mocks.actions.checkAuth).toHaveBeenCalledTimes(1);
  });
});
