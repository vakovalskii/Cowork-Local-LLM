import type { SessionStatus } from "../types";

export function shouldMarkHistoryStale(
  activeSessionId: string | null,
  sessionId: string,
  status: SessionStatus,
): boolean {
  if (!activeSessionId) return false;
  if (activeSessionId === sessionId) return false;
  return status === "completed" || status === "error";
}
