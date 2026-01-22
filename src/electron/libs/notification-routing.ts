export function shouldNotifyForSession(
  status: string,
  sessionId: string | null,
  focusedSessionId: string | null,
): boolean {
  if (status !== "completed" && status !== "error") return false;
  if (!sessionId) return false;
  if (!focusedSessionId) return true;
  return focusedSessionId !== sessionId;
}
