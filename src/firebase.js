import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  get,
  getDatabase,
  equalTo,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  update,
} from "firebase/database";
import { calculateOrderTotal } from "./orderPricing";

const trackingAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createTrackingCode() {
  const randomValues = globalThis.crypto.getRandomValues(new Uint8Array(20));
  return Array.from(randomValues, (value) => trackingAlphabet[value % trackingAlphabet.length]).join("");
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getServices() {
  const missingConfig = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingConfig.length) {
    throw new Error(`Configure Firebase in .env.local (${missingConfig.join(", ")}).`);
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  return {
    auth: getAuth(app),
    db: getDatabase(app),
  };
}

export function subscribeToAuth(onUser) {
  const { auth } = getServices();
  return onAuthStateChanged(auth, onUser);
}

export async function createCustomerAccount(email, password) {
  const { auth } = getServices();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInCustomer(email, password) {
  const { auth } = getServices();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutCustomer() {
  const { auth } = getServices();
  await signOut(auth);
}

export async function createOrder({ customer, items, ownerUid, discountCode = "" }) {
  const { db } = getServices();
  const cleanCustomer = Object.fromEntries(
    ["name", "phone", "email", "address", "city"].map((field) => [
      field,
      typeof customer[field] === "string" ? customer[field].trim() : "",
    ]),
  );
  const cleanItems = Object.fromEntries(
    items.map(({ productId, quantity, unitPrice }) => [
      productId,
      { quantity, unitPrice },
    ]),
  );
  const appliedDiscountCode = discountCode.trim().toLowerCase() === "zosmy2027"
    ? "zosmy2027"
    : "";
  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const total = calculateOrderTotal(subtotal, appliedDiscountCode);
  const trackingCode = createTrackingCode();
  const orderRef = push(ref(db, "orders"));
  if (!orderRef.key) throw new Error("Could not create an order ID.");

  const createdAt = { ".sv": "timestamp" };
  const order = {
    ...(ownerUid ? { ownerUid } : {}),
    trackingCode,
    discountCode: appliedDiscountCode,
    customer: cleanCustomer,
    items: cleanItems,
    status: "new",
    telegramStatus: "pending",
    createdAt,
  };
  const tracking = {
    status: "new",
    createdAt,
    total,
    discountCode: appliedDiscountCode,
    items: Object.fromEntries(
      Object.entries(cleanItems).map(([productId, item]) => [
        productId,
        { quantity: item.quantity },
      ]),
    ),
  };

  await update(ref(db), {
    [`orders/${orderRef.key}`]: order,
    [`orderTracking/${trackingCode}`]: tracking,
  });
  return { orderId: orderRef.key, trackingCode };
}

export function subscribeToOrderTracking(trackingCode, onOrder, onError) {
  const { db } = getServices();
  return onValue(
    ref(db, `orderTracking/${trackingCode}`),
    (snapshot) => onOrder(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

export function subscribeToCustomerOrders(uid, onOrders, onError) {
  const { db } = getServices();
  const ordersQuery = query(
    ref(db, "orders"),
    orderByChild("ownerUid"),
    equalTo(uid),
  );
  return onValue(
    ordersQuery,
    (snapshot) => {
      const orders = [];
      snapshot.forEach((orderSnapshot) => {
        orders.push({ id: orderSnapshot.key, ...orderSnapshot.val() });
      });
      onOrders(orders.sort((left, right) => right.createdAt - left.createdAt));
    },
    onError,
  );
}

export async function signInAdmin(email, password) {
  const { auth, db } = getServices();
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  try {
    const adminSnapshot = await get(ref(db, `admins/${credential.user.uid}`));
    if (!adminSnapshot.exists()) {
      throw new Error("This account is not authorized to view orders.");
    }
    return credential.user;
  } catch (error) {
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error("Could not clear an unauthorized admin session.", signOutError);
    }
    throw error;
  }
}

export function subscribeToAdminSession(onAdmin, onError) {
  const { auth, db } = getServices();
  let latestUid = null;
  return onAuthStateChanged(
    auth,
    async (user) => {
      latestUid = user?.uid || null;
      if (!user) {
        onAdmin(null);
        return;
      }

      try {
        const adminSnapshot = await get(ref(db, `admins/${user.uid}`));
        if (latestUid === user.uid) {
          onAdmin(adminSnapshot.exists() ? user : null);
        }
      } catch (error) {
        if (latestUid === user.uid) onError(error);
      }
    },
    onError,
  );
}

export async function signOutAdmin() {
  const { auth } = getServices();
  await signOut(auth);
}

export function subscribeToRecentOrders(onOrders, onError) {
  const { db } = getServices();
  const ordersQuery = query(
    ref(db, "orders"),
    orderByChild("createdAt"),
    limitToLast(100),
  );
  return onValue(
    ordersQuery,
    (snapshot) => {
      const orders = [];
      snapshot.forEach((orderSnapshot) => {
        orders.push({ id: orderSnapshot.key, ...orderSnapshot.val() });
      });
      onOrders(orders.reverse());
    },
    onError,
  );
}

export async function updateOrderStatus(orderId, status, trackingCode) {
  const { db } = getServices();
  const updates = { [`orders/${orderId}/status`]: status };
  if (trackingCode) updates[`orderTracking/${trackingCode}/status`] = status;
  await update(ref(db), updates);
}
