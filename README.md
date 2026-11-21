# Zosmy cosmetics storefront

A responsive cosmetics storefront built with React, Vite, JavaScript/JSX, Framer Motion, Number Flow, and Firebase. Prices are displayed in Moroccan dirhams (DH/MAD), and each product has its own `/products/<id>` order page.

## Run locally

```bash
npm install
npm run dev
```

The storefront runs without Firebase. To receive customer orders, create a Firebase project, enable Cloud Firestore and Cloud Functions, and copy `.env.example` to `.env.local` with the web app configuration values. Restart Vite after changing environment variables.

## Enable order and Telegram notifications

1. Install the Firebase CLI, sign in, and select your Firebase project (`firebase use <project-id>`). Cloud Functions deployment requires a billing-enabled Firebase project.
2. Install the function dependencies with `npm install --prefix functions`.
3. Create a Telegram bot with BotFather and obtain the destination chat ID. Set both values as Firebase secrets; do not put bot credentials in `.env.local` or frontend code:

   ```bash
   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
   firebase functions:secrets:set TELEGRAM_CHAT_ID
   ```

4. Build the storefront and deploy it with the order function:

   ```bash
   npm run build
   firebase deploy --only hosting,functions
   ```

The `placeOrder` function validates customer details and quantities, calculates prices from its trusted catalog, saves each order in Firestore’s `orders` collection, and sends the customer, delivery, product, and DH total to Telegram. Keep the catalog in `functions/index.js` synchronized with `src/products.js`. Firebase Hosting serves the app and rewrites product URLs to the SPA so direct product links work. The app displays whether Telegram notification succeeded; orders are still saved if Telegram is temporarily unavailable.

Orders are paid on delivery; this demo does not collect online payments. Configure Firestore security rules before accepting real customer data. Firebase web configuration is public by design; Telegram credentials stay in Firebase Secret Manager and are only used by the function.

## Build

```bash
npm run build
```