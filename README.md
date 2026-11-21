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
3. Create a Telegram bot with BotFather and obtain the destination chat ID. For local deployment, copy `.telegram-secrets.example` to `.telegram-secrets` and fill in both values. This local file is ignored by Git; do not put bot credentials in `.env.local` or frontend code.

   ```bash
   cp .telegram-secrets.example .telegram-secrets
   ```

4. Upload the values to Firebase Secret Manager and deploy the order function locally:

   ```bash
   npm run secrets:telegram
   ```

   To deploy functions through GitHub Actions instead, add the following repository secrets and variable under **Settings → Secrets and variables → Actions**:

   - Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `FIREBASE_SERVICE_ACCOUNT` (the JSON key for a Google Cloud service account authorized to deploy Cloud Functions and manage Firebase secrets).
   - Variable: `FIREBASE_PROJECT_ID` (the Firebase project ID).

   Then run **Actions → Deploy Firebase Functions → Run workflow**. The workflow uploads the Telegram values to Firebase Secret Manager and deploys the function. Do not commit credentials or paste them into issues or chat.

5. Build and deploy the storefront:

   ```bash
   npm run build
   firebase deploy --only hosting
   ```

The `placeOrder` function validates customer details and quantities, calculates prices from its trusted catalog, saves each order in Firestore’s `orders` collection, and sends the customer, delivery, product, and DH total to Telegram. Keep the catalog in `functions/index.js` synchronized with `src/products.js`. Firebase Hosting serves the app and rewrites product URLs to the SPA so direct product links work. The app displays whether Telegram notification succeeded; orders are still saved if Telegram is temporarily unavailable.

Orders are paid on delivery; this demo does not collect online payments. Configure Firestore security rules before accepting real customer data. Firebase web configuration is public by design; Telegram credentials stay in Firebase Secret Manager and are only used by the function.

## Build

```bash
npm run build
```