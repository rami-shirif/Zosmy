# Zosmy cosmetics storefront

A responsive cosmetics storefront built with React, Vite, JavaScript/JSX, Framer Motion, and Number Flow. Prices are displayed in Moroccan dirhams (DH/MAD), and each product has its own `/products/<id>` order page.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Firebase Realtime Database and admin page

Orders are stored in Firebase Realtime Database and can be reviewed at `/admin`. Customers may check out as guests and use the tracking number shown after ordering to see live status and total, or create/sign in to an account to see their own order history. Tracking numbers reveal only a minimal order summary; only accounts explicitly added as admins can view full guest order details or change statuses. The `ZOSMY2027` coupon reduces the order total by 10%.

1. In the Firebase project, create a **Realtime Database**. Copy its database URL from the Realtime Database page into `VITE_FIREBASE_DATABASE_URL` in `.env.local`. Set the other Firebase web configuration values from **Project settings → General**.
2. Publish `database.rules.json` in **Realtime Database → Rules**. The rules allow guest order creation, restrict account order reads to the matching UID, and expose only a minimal status record to anyone with the unguessable tracking number. Or deploy the rules with `firebase deploy --only database --project <project-id>`.
3. Enable **Email/Password** under **Authentication → Sign-in method** for customers who want account-based order history. Create an email/password user for each admin in **Authentication → Users** and copy the user’s UID.
4. In Realtime Database **Data**, create `/admins/<UID>` and set its value to `true`. Do not add a public admin sign-up flow; only users with this record can access the dashboard.
5. Open `/admin` on the deployed storefront and sign in with the admin account. The page shows the 100 newest orders and lets admins update order status.

## Telegram notifications

When a customer submits an order, the storefront saves it to Realtime Database and Apps Script sends that new order to Telegram. The bot no longer provides order-list commands or status buttons. The one-minute trigger silently retries pending notifications; it sends a message only when it successfully processes a pending order.

1. In Firebase, copy the Realtime Database URL shown on the database page.
2. Open the Firebase project's Google Cloud project in [Google Cloud Console](https://console.cloud.google.com/). In **IAM & Admin → IAM**, grant the Google account that will own/run Apps Script the **Firebase Realtime Database Admin** role. Apps Script runs as that account to read orders and mark notifications as sent. This path does not use Firebase Functions or require Blaze.
3. Create a project at [Google Apps Script](https://script.google.com/). In **Project Settings**, link the script to the same Google Cloud project as Firebase. In the editor, replace `Code.gs` with `apps-script/Code.gs`; show and replace `appsscript.json` with `apps-script/appsscript.json`. Redeploy the web app as a new version after changing `Code.gs`.
4. In **Project Settings → Script Properties**, add:
   - `FIREBASE_DATABASE_URL`: the Realtime Database URL copied in step 1.
   - `TELEGRAM_BOT_TOKEN`: the token from BotFather.
   - `TELEGRAM_CHAT_ID`: the receiving Telegram chat ID.

   Keep the Telegram token in Script Properties, not in the storefront or repository.
5. In Apps Script, select `setupOrderNotifications` and click **Run** once. Review and approve the requested Firebase Database, email identity, and external request permissions. This installs a one-minute backup trigger.
6. Select **Deploy → New deployment → Web app**, set **Execute as** to yourself and **Who has access** to anyone, then deploy. Copy the web app URL ending in `/exec`.
7. Add the Apps Script `/exec` URL to `.env.local` as `VITE_GOOGLE_APPS_SCRIPT_URL`.
8. If you previously enabled the Telegram order menu or webhook, redeploy the updated Apps Script as a new version. Run `disableTelegramOrderMenu` once in the Apps Script editor to remove the webhook, `/start` and `/orders` commands, and custom menu button. You do not need Cloudflare or Firebase Functions for order notifications.
9. Test by submitting a new order. Telegram should receive that order only. Run `testTelegramNotification` to test Telegram delivery and check Apps Script **Executions** for errors. The retry trigger remains silent unless it sends a pending order notification.

New Realtime Database orders start with `telegramStatus: pending`. After sending a message, the script updates that order to `sent`. If the immediate request fails, the order stays pending and the backup trigger retries it. Check the Apps Script **Executions** page and logs for errors. The admin page updates live and shows the notification status.

Orders already stored in Firestore are not moved automatically; they remain in Firestore and won't be included in the Realtime Database admin page.

## Run and deploy

Copy `.env.example` to `.env.local`, configure the Firebase values and `VITE_GOOGLE_APPS_SCRIPT_URL`, then build and publish the `dist` folder:

```bash
npm run build
```

Firebase Hosting is configured to serve the SPA at `/admin`; deploy it with `firebase deploy --only hosting --project <project-id>`. Other static hosts must rewrite `/admin` to `index.html`. Keep product IDs and prices in `src/products.js`, `database.rules.json`, and `apps-script/Code.gs` synchronized. Firebase and Apps Script have usage limits; orders cannot be placed until the database, rules, and Apps Script trigger are configured.
