import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Package, Search } from "lucide-react";
import {
  signInAdmin,
  signOutAdmin,
  subscribeToAdminSession,
  subscribeToRecentOrders,
  updateOrderStatus,
} from "./firebase";
import { products } from "./products";
import { calculateOrderTotal } from "./orderPricing";

const orderStatuses = ["new", "confirmed", "delivered", "cancelled"];
const orderFilters = ["all", ...orderStatuses];
const statusLabels = {
  all: "All orders",
  new: "New",
  confirmed: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const productById = new Map(products.map((product) => [product.id, product]));

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

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderStatuses, setUpdatingOrderStatuses] = useState({});
  const [error, setError] = useState("");
  const orderCounts = orderStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: orders.filter((order) => (order.status || "new") === status).length,
    }),
    {},
  );
  const filteredOrders = orders.filter((order) => {
    const status = order.status || "new";
    if (activeFilter !== "all" && status !== activeFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const searchableFields = [
      order.id,
      order.customer?.name,
      order.customer?.phone,
      order.customer?.email,
      order.customer?.address,
      order.customer?.city,
    ];
    return searchableFields.some((value) => String(value || "").toLowerCase().includes(query));
  });

  useEffect(() => {
    document.title = "Orders — Zosmy Admin";
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAdminSession(
      (sessionAdmin) => {
        setAdmin(sessionAdmin);
        setIsLoading(false);
      },
      (sessionError) => {
        console.error("Could not restore the admin session.", sessionError);
        setError(sessionError.message || "Could not restore the admin session.");
        setIsLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!admin) return undefined;
    let active = true;
    setIsLoading(true);
    setError("");
    const unsubscribe = subscribeToRecentOrders(
      (result) => {
        if (active) {
          setOrders(result);
          setIsLoading(false);
        }
      },
      (loadError) => {
        console.error("Could not load orders.", loadError);
        if (active) {
          setError(loadError.message || "Could not load orders.");
          setIsLoading(false);
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [admin]);

  async function handleLogin(event) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      setAdmin(await signInAdmin(email.trim(), password));
      setPassword("");
    } catch (loginError) {
      console.error("Could not sign in to the order dashboard.", loginError);
      setError(loginError.message || "Could not sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(orderId, status) {
    setError("");
    setUpdatingOrderStatuses((current) => ({ ...current, [orderId]: status }));
    try {
      const order = orders.find((candidate) => candidate.id === orderId);
      await updateOrderStatus(orderId, status, order?.trackingCode);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status } : order)),
      );
    } catch (updateError) {
      console.error("Could not update order status.", updateError);
      setError(updateError.message || "Could not update order status.");
    } finally {
      setUpdatingOrderStatuses((current) => {
        const { [orderId]: _updatedStatus, ...remaining } = current;
        return remaining;
      });
    }
  }

  async function handleSignOut() {
    try {
      await signOutAdmin();
      setAdmin(null);
      setOrders([]);
      setError("");
    } catch (signOutError) {
      console.error("Could not sign out of the order dashboard.", signOutError);
      setError(signOutError.message || "Could not sign out.");
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <a className="admin-wordmark" href="/">zosmy<span>®</span></a>
        <a className="admin-back-link" href="/">
          <ArrowLeft size={15} /> Store
        </a>
      </header>

      <main className="admin-main">
        <div className="admin-title-row">
          <div>
            <span className="eyebrow"><span className="eyebrow-line" /> ZOSMY STORE</span>
            <h1>Order dashboard</h1>
          </div>
          {admin && (
            <div className="admin-actions">
              <button type="button" className="admin-action" onClick={handleSignOut}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>

        {error && <p className="admin-error" role="alert">{error}</p>}

        {isLoading && !admin ? (
          <p className="admin-empty" role="status">Checking admin session…</p>
        ) : !admin ? (
          <form className="admin-login" onSubmit={handleLogin}>
            <h2>Sign in</h2>
            <p>Use an admin account created in Firebase Authentication.</p>
            <label>
              EMAIL
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              PASSWORD
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="button button-dark" type="submit" disabled={isLoading}>
              {isLoading ? "SIGNING IN..." : "OPEN ORDERS"}
            </button>
          </form>
        ) : (
          <section className="admin-orders" aria-live="polite">
            <div className="admin-overview" aria-label="Order totals">
              {orderFilters.map((status) => {
                const count = status === "all" ? orders.length : orderCounts[status];
                return (
                  <button
                    className={`admin-stat${activeFilter === status ? " active" : ""}`}
                    type="button"
                    key={status}
                    aria-pressed={activeFilter === status}
                    onClick={() => setActiveFilter(status)}
                  >
                    <span>{statusLabels[status]}</span>
                    <strong>{count}</strong>
                  </button>
                );
              })}
            </div>

            <div className="admin-orders-toolbar">
              <div className="admin-orders-heading">
                <div>
                  <h2>Orders</h2>
                  <span>{filteredOrders.length} of {orders.length} · latest 100</span>
                </div>
              </div>
              <label className="admin-search">
                <Search size={16} aria-hidden="true" />
                <span className="visually-hidden">Search orders</span>
                <input
                  type="search"
                  placeholder="Search name, phone or order ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>

            {isLoading && orders.length === 0 ? (
              <p className="admin-empty">Loading orders…</p>
            ) : orders.length === 0 ? (
              <p className="admin-empty">No orders yet.</p>
            ) : filteredOrders.length === 0 ? (
              <p className="admin-empty">No orders match your search or filter.</p>
            ) : (
              <div className="admin-order-list">
                {filteredOrders.map((order) => {
                  const orderItems = Object.entries(order.items || {});
                  const status = order.status || "new";
                  const updatingStatus = updatingOrderStatuses[order.id];
                  const isUpdating = updatingStatus !== undefined;
                  const subtotal = orderItems.reduce(
                    (sum, [, item]) => sum + item.unitPrice * item.quantity,
                    0,
                  );
                  const total = calculateOrderTotal(subtotal, order.discountCode);
                  return (
                    <article className="admin-order-card" key={order.id}>
                      <div className="admin-order-top">
                        <div>
                          <span className="admin-order-id">ORDER {order.id.toUpperCase()}</span>
                          <time>{formatDate(order.createdAt)}</time>
                        </div>
                        <div className="admin-status-picker">
                          <span>ORDER STATUS</span>
                          <div className="admin-status-options" role="group" aria-label="Change order status">
                            {orderStatuses.map((nextStatus) => (
                              <button
                                className={`admin-status-option status-${nextStatus}${status === nextStatus ? " active" : ""}`}
                                type="button"
                                key={nextStatus}
                                disabled={isUpdating}
                                aria-pressed={status === nextStatus}
                                onClick={() => handleStatusChange(order.id, nextStatus)}
                              >
                                {updatingStatus === nextStatus ? "Updating…" : statusLabels[nextStatus]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="admin-customer">
                        <strong>{order.customer?.name}</strong>
                        <a href={`tel:${order.customer?.phone}`}>{order.customer?.phone}</a>
                        {order.customer?.email && <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>}
                        <span>{order.customer?.address}, {order.customer?.city}</span>
                      </div>
                      <ul className="admin-order-items">
                        {orderItems.map(([productId, item]) => {
                          const product = productById.get(productId);
                          return (
                            <li key={productId}>
                              <span className="admin-product">
                                <span className="admin-product-image">
                                  <Package size={17} aria-hidden="true" />
                                  {product?.image && (
                                    <img src={product.image} alt="" loading="lazy" />
                                  )}
                                </span>
                                <span>{product?.name || item.name || productId} × {item.quantity}</span>
                              </span>
                              <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="admin-order-total">
                        <span>{order.discountCode === "zosmy2027" ? "Total · ZOSMY2027 applied" : "Total · pay on delivery"}</span>
                        <strong>{formatPrice(total)}</strong>
                      </div>
                      {order.trackingCode && <p className="admin-tracking-code">Guest tracking: {order.trackingCode}</p>}
                      <p className="admin-telegram-status">
                        Telegram: {order.telegramStatus || "not scheduled"}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
