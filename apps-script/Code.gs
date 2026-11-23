const CATALOG = {
  "dew-drops": { name: "Dew Drops Serum", price: 38 },
  "cloud-cream": { name: "Cloud Cream", price: 32 },
  "soft-focus": { name: "Soft Focus SPF 30", price: 29 },
  "body-oil": { name: "Sunday Body Oil", price: 34 },
  "ritual-set": { name: "The Slow Morning Set", price: 82 },
  "lip-balm": { name: "Petal Lip Balm", price: 18 },
};

function setupOrderNotifications() {
  const properties = PropertiesService.getScriptProperties();
  for (const name of ["FIREBASE_DATABASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]) {
    if (!properties.getProperty(name)) {
      throw new Error(`Set ${name} in Apps Script Project Settings → Script Properties.`);
    }
  }

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "processPendingOrders")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("processPendingOrders")
    .timeBased()
    .everyMinutes(1)
    .create();
}

function testFirebaseConnection() {
  const databaseUrl = PropertiesService.getScriptProperties()
    .getProperty("FIREBASE_DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("Set FIREBASE_DATABASE_URL in Script Properties.");
  }

  const pendingOrders = findPendingOrders(databaseUrl);
  const count = Object.keys(pendingOrders).length;
  console.log(`Realtime Database connection OK. Pending orders: ${count}.`);
  return count;
}

function testTelegramNotification() {
  sendTelegramMessage("<b>Zosmy test</b>\nTelegram order notifications are connected.");
  console.log("Telegram test message sent.");
}

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    if (typeof request.orderId !== "string" || !/^[A-Za-z0-9_-]+$/.test(request.orderId)) {
      throw new Error("A valid order ID is required.");
    }

    return jsonResponse({ ok: true, notified: processOrder(request.orderId) });
  } catch (error) {
    console.error(`Immediate order notification failed: ${error.message || error}`);
    return jsonResponse({ ok: false });
  }
}

function processPendingOrders() {
  const pendingOrders = findPendingOrders(getDatabaseUrl());
  console.log(`Found ${Object.keys(pendingOrders).length} pending order(s).`);
  for (const orderId of Object.keys(pendingOrders)) {
    processOrder(orderId);
  }
}

function processOrder(orderId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log(`Skipped order ${orderId}; another notification is in progress.`);
    return false;
  }

  try {
    if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
      throw new Error("Invalid Realtime Database order ID.");
    }
    const databaseUrl = getDatabaseUrl();
    const order = realtimeDatabaseFetch(
      `${databaseUrl.replace(/\/+$/, "")}/orders/${orderId}.json`,
      "get",
    );
    if (!order || order.telegramStatus !== "pending") {
      console.log(`Order ${orderId} is missing or is not pending.`);
      return false;
    }

    const customer = validateCustomer(order.customer);
    const items = validateItems(order.items);
    const subtotal = items.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );
    const discountCode = order.discountCode === "zosmy2027" ? "zosmy2027" : "";
    const discount = discountCode ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const total = subtotal - discount;

    sendTelegramOrder(orderId, customer, items, subtotal, discount, total, discountCode, order.trackingCode);
    updateTelegramStatus(databaseUrl, orderId, "sent");
    console.log(`Telegram notification sent for order ${orderId}.`);
    return true;
  } catch (error) {
    console.error(`Order ${orderId} remains pending: ${error.message || error}`);
    return false;
  } finally {
    lock.releaseLock();
  }
}

function getDatabaseUrl() {
  const databaseUrl = PropertiesService.getScriptProperties()
    .getProperty("FIREBASE_DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("Set FIREBASE_DATABASE_URL in Script Properties.");
  }
  return databaseUrl;
}

function findPendingOrders(databaseUrl) {
  const url = `${databaseUrl.replace(/\/+$/, "")}/orders.json` +
    `?orderBy=${encodeURIComponent('"telegramStatus"')}` +
    `&equalTo=${encodeURIComponent('"pending"')}` +
    "&limitToFirst=20";
  return realtimeDatabaseFetch(url, "get") || {};
}

function updateTelegramStatus(databaseUrl, orderId, status) {
  if (!/^[A-Za-z0-9_-]+$/.test(orderId)) {
    throw new Error("Invalid Realtime Database order ID.");
  }
  const url = `${databaseUrl.replace(/\/+$/, "")}/orders/${orderId}.json`;
  realtimeDatabaseFetch(url, "patch", { telegramStatus: status });
}

function realtimeDatabaseFetch(url, method, payload) {
  const accessToken = ScriptApp.getOAuthToken();
  const options = {
    method,
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  if (payload !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Realtime Database request failed with HTTP ${status}: ${response.getContentText()}`);
  }
  const content = response.getContentText();
  return content ? JSON.parse(content) : null;
}

function validateCustomer(value) {
  const fields = ["name", "phone", "address", "city"];
  if (!value || typeof value !== "object") {
    throw new Error("Customer details are required.");
  }

  const customer = Object.fromEntries(
    [...fields, "email"].map((field) => [
      field,
      typeof value[field] === "string" ? value[field].trim() : "",
    ]),
  );
  for (const field of fields) {
    if (!customer[field] || customer[field].length > (field === "address" ? 200 : 100)) {
      throw new Error(`Please provide a valid ${field}.`);
    }
  }
  if (customer.phone.length > 30) {
    throw new Error("Please provide a valid phone number.");
  }
  if (
    customer.email.length > 254 ||
    (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
  ) {
    throw new Error("Please provide a valid email address.");
  }

  return customer;
}

function validateItems(value) {
  if (!value || typeof value !== "object") {
    throw new Error("The order has no products.");
  }
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 6) {
    throw new Error("The order must contain between 1 and 6 products.");
  }

  return entries.map(([productId, item]) => {
    const product = CATALOG[productId];
    if (
      !product ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 25 ||
      item.unitPrice !== product.price
    ) {
      throw new Error(`The order contains an invalid product or quantity: ${productId}.`);
    }

    return {
      name: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
    };
  });
}

function sendTelegramOrder(orderId, customer, items, subtotal, discount, total, discountCode, trackingCode) {
  sendTelegramMessage(formatOrder(customer, items, subtotal, discount, total, discountCode, orderId, trackingCode));
}

function sendTelegramMessage(text) {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty("TELEGRAM_BOT_TOKEN");
  const chatId = properties.getProperty("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Script Properties.");
  }

  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    muteHttpExceptions: true,
  });
  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch {
    throw new Error(`Telegram returned HTTP ${response.getResponseCode()} with an invalid response.`);
  }
  if (response.getResponseCode() !== 200 || !result.ok) {
    throw new Error(result.description || `Telegram rejected the message (HTTP ${response.getResponseCode()}).`);
  }
}

function formatOrder(customer, items, subtotal, discount, total, discountCode, orderId, trackingCode) {
  const lines = [
    "<b>New Zosmy order</b>",
    `<b>Order:</b> <code>${escapeHtml(String(orderId))}</code>`,
    ...(trackingCode ? [`<b>Tracking:</b> <code>${escapeHtml(String(trackingCode))}</code>`] : []),
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
    `<b>Subtotal:</b> ${formatDirhams(subtotal)}`,
    ...(discountCode ? [`<b>Discount (${escapeHtml(discountCode)}):</b> -${formatDirhams(discount)}`] : []),
    `<b>Total:</b> ${formatDirhams(total)}`,
  ];
  return lines.join("\n");
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
  return `${amount.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} DH`;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
