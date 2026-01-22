export function shouldHandlePartialMessage(
  activeSessionId: string | null,
  eventSessionId: string | undefined,
): boolean {
  if (!activeSessionId || !eventSessionId) return false;
  return activeSessionId === eventSessionId;
}
