import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, LogOut, Package, Search, Truck } from "lucide-react";
import {
  createCustomerAccount,
  signInCustomer,
  signOutCustomer,
  subscribeToCustomerOrders,
  subscribeToOrderTracking,
} from "./firebase";
import { products } from "./products";

const productById = new Map(products.map((product) => [product.id, product]));
const orderProgress = [
  { status: "new", label: "Pending confirmation", Icon: Clock3 },
  { status: "confirmed", label: "In delivery", Icon: Truck },
  { status: "delivered", label: "Delivered", Icon: Check },
];
const trackingStatusLabels = {
  new: "Pending confirmation",
  confirmed: "In delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatPrice(amount) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(amount)} DH`;
}

function formatDate(timestamp) {
  if (typeof timestamp !== "number") return "Just now";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export default function AccountPage({ user, authError, initialTrackingCode = "" }) {
  const [mode, setMode] = useState(initialTrackingCode ? "track" : "create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [trackingInput, setTrackingInput] = useState(initialTrackingCode);
  const [trackingCode, setTrackingCode] = useState(initialTrackingCode);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!initialTrackingCode) return;
    setMode("track");
    setTrackingInput(initialTrackingCode);
    setTrackingCode(initialTrackingCode);
  }, [initialTrackingCode]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return undefined;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToCustomerOrders(
      user.uid,
      (result) => {
        setOrders(result);
        setIsLoading(false);
      },
      (loadError) => {
        console.error("Could not load customer orders.", loadError);
        setError(loadError.message || "Could not load your orders.");
        setIsLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!trackingCode || user) return undefined;
    setIsTracking(true);
    setTrackedOrder(null);
    const unsubscribe = subscribeToOrderTracking(
      trackingCode,
      (result) => {
        setTrackedOrder(result);
        setIsTracking(false);
      },
      (trackingError) => {
        console.error("Could not look up order tracking.", trackingError);
        setError(trackingError.message || "Could not look up this tracking number.");
        setIsTracking(false);
      },
    );
    return unsubscribe;
  }, [trackingCode, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (mode === "create" && password !== confirmation) {
      setError("Your passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "create") await createCustomerAccount(email.trim(), password);
      else await signInCustomer(email.trim(), password);
      setPassword("");
      setConfirmation("");
    } catch (authFailure) {
      console.error("Could not authenticate customer.", authFailure);
      setError(authFailure.message || "Could not access your account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError("");
    try {
      await signOutCustomer();
    } catch (signOutError) {
      console.error("Could not sign out of the customer account.", signOutError);
      setError(signOutError.message || "Could not sign out.");
    }
  }

  function handleTrackOrder(event) {
    event.preventDefault();
    const normalizedCode = trackingInput.replace(/\s/g, "").toUpperCase();
    if (!/^[2-9A-HJ-NP-Z]{20}$/.test(normalizedCode)) {
      setError("Enter the 20-character tracking number from your order confirmation.");
      setTrackingCode("");
      return;
    }
    setError("");
    setTrackingCode(normalizedCode);
  }

  const trackedStatus = trackedOrder?.status || "new";
  const trackedProgress = orderProgress.findIndex((step) => step.status === trackedStatus);

  return (
    <section className="account-page section-pad">
      <div className="account-heading">
        <span className="eyebrow"><span className="eyebrow-line" /> YOUR ZOSMY ACCOUNT</span>
        <h1>{user ? "Your orders, kept close." : mode === "track" ? "Follow your order." : "A little space, just for you."}</h1>
        <p>{user ? user.email : mode === "track" ? "Enter the tracking number from your order confirmation." : "Sign in, create an account, or track an order."}</p>
      </div>

      {authError && <p className="account-error" role="alert">{authError}</p>}
      {user && error && <p className="account-error" role="alert">{error}</p>}

      {user ? (
        <>
          <div className="account-orders-heading">
            <h2>Order history</h2>
            <button type="button" className="account-signout" onClick={handleSignOut}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
          {isLoading ? (
            <p className="account-empty">Loading your orders…</p>
          ) : orders.length === 0 ? (
            <div className="account-empty">
              <p>No orders yet.</p>
              <a className="text-link" href="/#shop">FIND YOUR RITUAL <ArrowRight size={14} /></a>
            </div>
          ) : (
            <div className="customer-order-list" aria-live="polite">
              {orders.map((order) => {
                const items = Object.entries(order.items || {});
                const subtotal = items.reduce((sum, [, item]) => sum + item.unitPrice * item.quantity, 0);
                const total = order.discountCode === "zosmy2027"
                  ? Math.round(subtotal * 0.9 * 100) / 100
                  : subtotal;
                const status = order.status || "new";
                const currentProgress = orderProgress.findIndex((step) => step.status === status);
                return (
                  <article className="customer-order" key={order.id}>
                    <div className="customer-order-header">
                      <div>
                        <span className="customer-order-id">ORDER {order.id.toUpperCase()}</span>
                        <time>{formatDate(order.createdAt)}</time>
                      </div>
                      {currentProgress === -1 && (
                        <span className={`customer-order-status status-${status}`}>
                          {status === "cancelled" ? "Cancelled" : status}
                        </span>
                      )}
                    </div>
                    {currentProgress !== -1 && (
                      <ol className="customer-order-progress" aria-label={`Order status: ${orderProgress[currentProgress].label}`}>
                        {orderProgress.map(({ status: stepStatus, label, Icon }, index) => {
                          const stepClass = index < currentProgress
                            ? "completed"
                            : index === currentProgress
                              ? "active"
                              : "";
                          return (
                            <li
                              className={`customer-order-step ${stepClass}`}
                              key={stepStatus}
                              aria-current={index === currentProgress ? "step" : undefined}
                            >
                              <span className="customer-order-step-icon"><Icon size={15} /></span>
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                    <ul>
                      {items.map(([productId, item]) => (
                        <li className="customer-order-item" key={productId}>
                          {productById.get(productId)?.image ? (
                            <img
                              className="customer-order-product-image"
                              src={productById.get(productId).image}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span className="customer-order-product-placeholder" aria-hidden="true">
                              <Package size={17} />
                            </span>
                          )}
                          <span className="customer-order-product-name">
                            {productById.get(productId)?.name || item.name || productId} × {item.quantity}
                          </span>
                          <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="customer-order-total">
                      <span>{order.discountCode === "zosmy2027" ? "Total · ZOSMY2027 applied" : "Total · pay on delivery"}</span>
                      <strong>{formatPrice(total)}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : mode === "track" ? (
        <div className="guest-tracking">
          <div className="account-mode" role="group" aria-label="Account access mode">
            <button type="button" onClick={() => { setMode("create"); setError(""); }}>Create account</button>
            <button type="button" onClick={() => { setMode("signin"); setError(""); }}>Sign in</button>
            <button type="button" className="active" aria-pressed="true">Track order</button>
          </div>
          <form className="guest-tracking-form" onSubmit={handleTrackOrder}>
            <label htmlFor="order-tracking-code">TRACKING NUMBER</label>
            <div className="guest-tracking-input-row">
              <input
                id="order-tracking-code"
                value={trackingInput}
                onChange={(event) => setTrackingInput(event.target.value)}
                autoComplete="off"
                spellCheck="false"
                maxLength={20}
                required
              />
              <button className="button button-dark" type="submit" disabled={isTracking} aria-label="Track order">
                <Search size={16} />
              </button>
            </div>
          </form>
          {error && <p className="account-error" role="alert">{error}</p>}
          {isTracking && <p className="account-empty" role="status">Looking up your order…</p>}
          {!isTracking && trackingCode && !trackedOrder && !error && (
            <p className="account-empty" role="status">No order found for that tracking number.</p>
          )}
          {trackedOrder && (
            <article className="customer-order guest-tracking-result" aria-live="polite">
              <div className="customer-order-header">
                <div>
                  <span className="customer-order-id">ORDER STATUS</span>
                  <time>{formatDate(trackedOrder.createdAt)}</time>
                </div>
                {trackedProgress === -1 && (
                  <span className={`customer-order-status status-${trackedStatus}`}>
                    {trackingStatusLabels[trackedStatus] || trackedStatus}
                  </span>
                )}
              </div>
              {trackedProgress !== -1 && (
                <ol className="customer-order-progress" aria-label={`Order status: ${orderProgress[trackedProgress].label}`}>
                  {orderProgress.map(({ status, label, Icon }, index) => {
                    const stepClass = index < trackedProgress
                      ? "completed"
                      : index === trackedProgress
                        ? "active"
                        : "";
                    return (
                      <li
                        className={`customer-order-step ${stepClass}`}
                        key={status}
                        aria-current={index === trackedProgress ? "step" : undefined}
                      >
                        <span className="customer-order-step-icon"><Icon size={15} /></span>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <ul>
                {Object.entries(trackedOrder.items || {}).map(([productId, item]) => {
                  const product = productById.get(productId);
                  return (
                    <li className="customer-order-item" key={productId}>
                      {product?.image ? (
                        <img
                          className="customer-order-product-image"
                          src={product.image}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="customer-order-product-placeholder" aria-hidden="true">
                          <Package size={17} />
                        </span>
                      )}
                      <span className="customer-order-product-name">
                        {product?.name || productId} × {item.quantity}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="customer-order-total">
                <span>{trackedOrder.discountCode === "zosmy2027" ? "Total · 10% discount" : "Total · pay on delivery"}</span>
                <strong>{formatPrice(trackedOrder.total)}</strong>
              </div>
            </article>
          )}
        </div>
      ) : (
        <form className="account-form" onSubmit={handleSubmit}>
          <div className="account-mode" role="group" aria-label="Account access mode">
            <button
              type="button"
              className={mode === "create" ? "active" : ""}
              aria-pressed={mode === "create"}
              onClick={() => { setMode("create"); setError(""); }}
            >Create account</button>
            <button
              type="button"
              className={mode === "signin" ? "active" : ""}
              aria-pressed={mode === "signin"}
              onClick={() => { setMode("signin"); setError(""); }}
            >Sign in</button>
            <button
              type="button"
              onClick={() => { setMode("track"); setError(""); }}
            >Track order</button>
          </div>
          <label>
            EMAIL ADDRESS
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
            />
          </label>
          <label>
            PASSWORD
            <input
              type="password"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          {mode === "create" && (
            <label>
              CONFIRM PASSWORD
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={6}
                required
              />
            </label>
          )}
          {error && <p className="account-error" role="alert">{error}</p>}
          <button className="button button-dark" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "PLEASE WAIT..." : mode === "create" ? "CREATE ACCOUNT" : "SIGN IN"}
            <ArrowRight size={15} />
          </button>
        </form>
      )}
    </section>
  );
}
