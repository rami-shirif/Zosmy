import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const telegramBotToken = defineSecret("9027818646:AAFju5pJiejHk_SragPkqiNBrcaq50CfE2Q");
const telegramChatId = defineSecret("9027818646");
const currency = "MAD";

// Keep this trusted price list in sync with src/products.js.
const catalog = {
  "dew-drops": { name: "Dew Drops Serum", price: 38 },
  "cloud-cream": { name: "Cloud Cream", price: 32 },
  "soft-focus": { name: "Soft Focus SPF 30", price: 29 },
  "body-oil": { name: "Sunday Body Oil", price: 34 },
  "ritual-set": { name: "The Slow Morning Set", price: 82 },
  "lip-balm": { name: "Petal Lip Balm", price: 18 },
};

initializeApp();
const db = getFirestore();

export const placeOrder = onCall(
  { secrets: [telegramBotToken, telegramChatId] },
  async (request) => {
    const customer = validateCustomer(request.data?.customer);
    const items = validateItems(request.data?.items);
    const token = telegramBotToken.value();
    const chatId = telegramChatId.value();

    if (!token || !chatId) {
      throw new HttpsError(
        "failed-precondition",
        "The shop has not finished configuring order notifications.",
      );
    }

    const subtotal = items.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );
    const orderRef = await db.collection("orders").add({
      customer,
      items,
      currency,
      subtotal,
      status: "new",
      telegramStatus: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    try {
      await sendTelegramOrder({ token, chatId, orderId: orderRef.id, customer, items, subtotal });
      await orderRef.update({
        telegramStatus: "sent",
        telegramSentAt: FieldValue.serverTimestamp(),
      });
      return { orderId: orderRef.id, telegramNotified: true };
    } catch {
      console.error("Telegram notification failed for order", orderRef.id);
      await orderRef.update({ telegramStatus: "failed" });
      return { orderId: orderRef.id, telegramNotified: false };
    }
  },
);

function validateCustomer(value) {
  const fields = ["name", "phone", "address", "city"];
  if (!value || typeof value !== "object") {
    throw new HttpsError("invalid-argument", "Customer details are required.");
  }

  const customer = Object.fromEntries(
    [...fields, "email"].map((field) => [
      field,
      typeof value[field] === "string" ? value[field].trim() : "",
    ]),
  );

  for (const field of fields) {
    if (!customer[field] || customer[field].length > (field === "address" ? 200 : 100)) {
      throw new HttpsError("invalid-argument", `Please provide a valid ${field}.`);
    }
  }
  if (customer.phone.length > 30) {
    throw new HttpsError("invalid-argument", "Please provide a valid phone number.");
  }
  if (customer.email.length > 254 || (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))) {
    throw new HttpsError("invalid-argument", "Please provide a valid email address.");
  }

  return customer;
}

function validateItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new HttpsError("invalid-argument", "Your order must contain between 1 and 20 products.");
  }

  return value.map((item) => {
    const product = catalog[item?.productId];
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 25) {
      throw new HttpsError("invalid-argument", "Your order contains an invalid product or quantity.");
    }

    return {
      productId: item.productId,
      name: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
    };
  });
}

async function sendTelegramOrder({ token, chatId, orderId, customer, items, subtotal }) {
  const lines = [
    "<b>New Zosmy order</b>",
    `<b>Order:</b> <code>${escapeHtml(orderId)}</code>`,
    `<b>Name:</b> ${escapeHtml(customer.name)}`,
    `<b>Phone:</b> ${escapeHtml(customer.phone)}`,
    `<b>Email:</b> ${escapeHtml(customer.email || "Not provided")}`,
    `<b>Delivery address:</b> ${escapeHtml(customer.address)}, ${escapeHtml(customer.city)}`,
    "",
    "<b>Products:</b>",
    ...items.map(
      (item) =>
        `• ${escapeHtml(item.name)} × ${item.quantity} — ${formatDirhams(item.unitPrice * item.quantity)}`,
    ),
    "",
    `<b>Total:</b> ${formatDirhams(subtotal)}`,
  ];
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok || !(await response.json()).ok) {
    throw new Error("Telegram rejected the order notification.");
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDirhams(amount) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(amount)} DH`;
}
