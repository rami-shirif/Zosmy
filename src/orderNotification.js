const appsScriptUrl = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL?.trim();

export async function requestOrderNotification(orderId) {
  if (!appsScriptUrl) {
    throw new Error("Google Apps Script URL is not configured.");
  }

  await fetch(appsScriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ orderId }),
  });
}
