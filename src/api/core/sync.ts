export type SyncTrigger = "auto" | "manual";
export type SyncCompletionStatus = "success" | "failure" | "timeout" | "skipped";
export type SyncMode = "full" | "incremental";

export interface SyncReservationDecision {
  allow: boolean;
  mode: SyncMode | null;
  reason: string;
  leaseId?: string;
  accountKey?: string;
}

interface RuntimeResponse {
  error?: string;
  ok?: boolean;
  allow?: boolean;
  mode?: SyncMode | null;
  reason?: string;
  leaseId?: string;
  accountKey?: string;
}

function runtimeError(response: RuntimeResponse): string {
  return response.error || "API_ERROR";
}

export async function reserveSyncRun(input: {
  accountId: string;
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
      response.mode === "full" || response.mode === "incremental"
        ? response.mode
        : null,
    reason: typeof response.reason === "string" ? response.reason : "unknown",
    leaseId: typeof response.leaseId === "string" ? response.leaseId : undefined,
    accountKey:
      typeof response.accountKey === "string" ? response.accountKey : undefined,
  };
}

export async function completeSyncRun(input: {
  accountId: string;
  leaseId: string;
  mode: SyncMode;
  status: SyncCompletionStatus;
  trigger: SyncTrigger;
}): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: "COMPLETE_SYNC",
    accountId: input.accountId,
    leaseId: input.leaseId,
    mode: input.mode,
    status: input.status,
    trigger: input.trigger,
  })) as RuntimeResponse;
  if (response?.error) throw new Error(runtimeError(response));
}
