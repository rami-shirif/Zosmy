const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let firebaseAppPromise;

export function getFirebaseApp() {
  if (!Object.values(config).every(Boolean)) {
    return Promise.resolve(null);
  }

  firebaseAppPromise ??= import("firebase/app").then(({ getApps, initializeApp }) =>
    getApps()[0] ?? initializeApp(config),
  );

  return firebaseAppPromise;
}

export async function getPlaceOrder() {
  const app = await getFirebaseApp();
  if (!app) return null;

  const { getFunctions, httpsCallable } = await import("firebase/functions");
  return httpsCallable(getFunctions(app), "placeOrder");
}
