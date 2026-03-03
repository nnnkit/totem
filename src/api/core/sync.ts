export type SyncTrigger = "auto" | "manual";
export type SyncCompletionStatus = "success" | "failure" | "timeout" | "skipped";
export type SyncMode = "full" | "incremental" | "quick";

export interface SyncReservationDecision {
  allow: boolean;
  mode: SyncMode | null;
  reason: string;
  leaseId?: string;
  accountKey?: string;
  retryAfterMs?: number;
}

interface RuntimeResponse {
  error?: string;
  ok?: boolean;
  allow?: boolean;
  mode?: SyncMode | null;
  reason?: string;
  leaseId?: string;
  accountKey?: string;
  errorCode?: string;
  retryAfterMs?: number;
}

function runtimeError(response: RuntimeResponse): string {
  return response.error || "API_ERROR";
}

export async function reserveSyncRun(input: {
  accountId: string | null;
  trigger: SyncTrigger;
  localCount: number;
  requestedMode?: SyncMode;
}): Promise<SyncReservationDecision> {
  const response = (await chrome.runtime.sendMessage({
    type: "REQUEST_SYNC",
    accountId: input.accountId,
    trigger: input.trigger,
    localCount: input.localCount,
    requestedMode: input.requestedMode,
  })) as RuntimeResponse;

  if (response?.error) throw new Error(runtimeError(response));
  return {
    allow: response.allow === true,
    mode:
      response.mode === "full" ||
      response.mode === "incremental" ||
      response.mode === "quick"
        ? response.mode
        : null,
    reason: typeof response.reason === "string" ? response.reason : "unknown",
    leaseId: typeof response.leaseId === "string" ? response.leaseId : undefined,
    accountKey:
      typeof response.accountKey === "string" ? response.accountKey : undefined,
    retryAfterMs:
      typeof response.retryAfterMs === "number" && Number.isFinite(response.retryAfterMs)
        ? Math.max(0, Math.floor(response.retryAfterMs))
        : undefined,
  };
}

export async function completeSyncRun(input: {
  accountId: string | null;
  leaseId: string;
  mode: SyncMode;
  status: SyncCompletionStatus;
  trigger: SyncTrigger;
  errorCode?: string;
}): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: "COMPLETE_SYNC",
    accountId: input.accountId,
    leaseId: input.leaseId,
    mode: input.mode,
    status: input.status,
    trigger: input.trigger,
    errorCode: input.errorCode,
  })) as RuntimeResponse;
  if (response?.error) throw new Error(runtimeError(response));
}
