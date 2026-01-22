import { Notification } from "electron";

type Meta = any;

let clickHandler: (meta?: Meta) => void = () => {};

export function setNotificationClickHandler(fn: (meta?: Meta) => void) {
  clickHandler = fn;
}

export async function sendNotification(
  title: string,
  body: string,
  meta?: Meta,
) {
  try {
    const n = new Notification({ title, body, silent: false });
    n.on("click", () => {
      try {
        clickHandler(meta);
      } catch (e) {
        console.error("[NotificationService] click handler error", e);
      }
    });
    n.show();
    return { success: true };
  } catch (error: any) {
    console.error("[NotificationService] Failed to send notification:", error);
    return { success: false, error: String(error) };
  }
}

export default {
  sendNotification,
  setNotificationClickHandler,
};
