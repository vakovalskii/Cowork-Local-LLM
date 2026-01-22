const BODY_LIMIT = 140;
const ELLIPSIS = "...";

type AssistantMessage = {
  type: "assistant";
  message?: { content?: Array<{ type?: string; text?: string }> };
};

type TextMessage = { type: "text"; text?: string };

type ResultMessage = { type: "result"; result?: string };

type AnyMessage = AssistantMessage | TextMessage | ResultMessage | Record<string, unknown>;

export function extractResponseText(message: AnyMessage): string | null {
  if (!message || typeof message !== "object") return null;

  if (message.type === "assistant") {
    const content = (message as AssistantMessage).message?.content ?? [];
    const parts = content
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text as string);
    const joined = parts.join(" ").trim();
    return joined ? joined : null;
  }

  if (message.type === "text") {
    const text = (message as TextMessage).text;
    return typeof text === "string" ? text : null;
  }

  if (message.type === "result") {
    const text = (message as ResultMessage).result;
    return typeof text === "string" ? text : null;
  }

  return null;
}

export function normalizeResponseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateResponseText(text: string, limit = BODY_LIMIT): string {
  if (text.length <= limit) return text;
  const max = Math.max(0, limit - ELLIPSIS.length);
  return text.slice(0, max).trimEnd() + ELLIPSIS;
}

export function buildNotificationBody(rawText: string | null): string {
  if (!rawText) return "";
  return truncateResponseText(normalizeResponseText(rawText));
}
