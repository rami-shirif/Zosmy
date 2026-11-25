import { products } from "./products";
import { calculateOrderTotal } from "./orderPricing";

const productById = new Map(products.map((product) => [product.id, product]));
const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGE_OPTIONS = [
  { id: 7, label: "7 days" },
  { id: 30, label: "30 days" },
  { id: 90, label: "90 days" },
  { id: 0, label: "All time" },
];

export function orderSubtotal(order) {
  return Object.values(order.items || {}).reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
    0,
  );
}

export function orderTotal(order) {
  return calculateOrderTotal(orderSubtotal(order), order.discountCode);
}

export function orderUnits(order) {
  return Object.values(order.items || {}).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function startOfDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dayKey(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function customerKey(order) {
  const customer = order.customer || {};
  if (order.ownerUid) return `uid:${order.ownerUid}`;
  const phone = String(customer.phone || "").replace(/\D/g, "").slice(-9);
  if (phone.length >= 8) return `tel:${phone}`;
  const email = String(customer.email || "").trim().toLowerCase();
  if (email) return `mail:${email}`;
  return `order:${order.id}`;
}

function percentChange(current, previous) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

function summarize(orders) {
  const counted = orders.filter((order) => (order.status || "new") !== "cancelled");
  const revenue = counted.reduce((sum, order) => sum + orderTotal(order), 0);
  return {
    revenue,
    orders: counted.length,
    units: counted.reduce((sum, order) => sum + orderUnits(order), 0),
    average: counted.length ? revenue / counted.length : 0,
  };
}

/**
 * Builds every number the analytics dashboard shows.
 * Cancelled orders are left out of revenue, units and best sellers, but are
 * reported separately so the cancellation rate stays visible.
 * `range` is a number of days, or 0 for all time.
 */
export function buildAnalytics(allOrders, range, now = Date.now()) {
  const valid = allOrders.filter((order) => typeof order.createdAt === "number");
  const rangeStart = range ? startOfDay(now) - (range - 1) * DAY_MS : 0;
  const inRange = range ? valid.filter((order) => order.createdAt >= rangeStart) : valid;
  const previous = range
    ? valid.filter((order) => order.createdAt >= rangeStart - range * DAY_MS && order.createdAt < rangeStart)
    : [];
  const counted = inRange.filter((order) => (order.status || "new") !== "cancelled");

  const current = summarize(inRange);
  const before = summarize(previous);
  const cancelled = inRange.length - counted.length;

  // Daily series (revenue + orders), zero-filled so quiet days still show.
  const firstOrderTime = valid.reduce((min, order) => Math.min(min, order.createdAt), now);
  const seriesStart = range ? rangeStart : Math.min(startOfDay(firstOrderTime), startOfDay(now) - 29 * DAY_MS);
  const days = [];
  const dayIndex = new Map();
  for (let time = seriesStart; time <= now; time += DAY_MS) {
    const key = dayKey(time);
    dayIndex.set(key, days.length);
    days.push({ key, date: new Date(time), revenue: 0, orders: 0 });
  }
  counted.forEach((order) => {
    const index = dayIndex.get(dayKey(order.createdAt));
    if (index === undefined) return;
    days[index].revenue += orderTotal(order);
    days[index].orders += 1;
  });

  // Best-selling products.
  const sales = new Map();
  counted.forEach((order) => {
    Object.entries(order.items || {}).forEach(([productId, item]) => {
      const entry = sales.get(productId) || { id: productId, units: 0, revenue: 0 };
      const quantity = Number(item.quantity) || 0;
      entry.units += quantity;
      entry.revenue += quantity * (Number(item.unitPrice) || 0);
      sales.set(productId, entry);
    });
  });
  const bestSellers = [...sales.values()]
    .map((entry) => ({ ...entry, product: productById.get(entry.id), name: productById.get(entry.id)?.name || entry.id }))
    .sort((left, right) => right.units - left.units || right.revenue - left.revenue);

  // Revenue by category.
  const categories = new Map();
  bestSellers.forEach((entry) => {
    const category = entry.product?.category || "Other";
    categories.set(category, (categories.get(category) || 0) + entry.revenue);
  });
  const categoryRevenue = [...categories.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((left, right) => right.revenue - left.revenue);

  // Order status mix.
  const statusCounts = { new: 0, confirmed: 0, delivered: 0, cancelled: 0 };
  inRange.forEach((order) => {
    const status = order.status || "new";
    if (status in statusCounts) statusCounts[status] += 1;
  });

  // Customers. "New" means their first order in the data falls inside the range.
  const firstSeen = new Map();
  valid.forEach((order) => {
    const key = customerKey(order);
    const seen = firstSeen.get(key);
    if (seen === undefined || order.createdAt < seen) firstSeen.set(key, order.createdAt);
  });
  const customers = new Map();
  counted.forEach((order) => {
    const key = customerKey(order);
    const entry = customers.get(key) || {
      key,
      name: order.customer?.name || "Guest",
      city: order.customer?.city || "",
      orders: 0,
      spent: 0,
      last: 0,
    };
    entry.orders += 1;
    entry.spent += orderTotal(order);
    entry.last = Math.max(entry.last, order.createdAt);
    if (order.customer?.name) entry.name = order.customer.name;
    customers.set(key, entry);
  });
  const customerList = [...customers.values()];
  const newCustomers = customerList.filter((entry) => !range || firstSeen.get(entry.key) >= rangeStart).length;
  const returningCustomers = customerList.length - newCustomers;
  const repeatBuyers = customerList.filter((entry) => entry.orders > 1).length;
  const topCustomers = [...customerList].sort((left, right) => right.spent - left.spent).slice(0, 5);

  const cities = new Map();
  counted.forEach((order) => {
    const city = String(order.customer?.city || "").trim();
    if (!city) return;
    const label = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    const entry = cities.get(label) || { name: label, orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += orderTotal(order);
    cities.set(label, entry);
  });
  const topCities = [...cities.values()].sort((left, right) => right.orders - left.orders).slice(0, 5);

  // Orders by hour of day, to show when customers buy.
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  counted.forEach((order) => {
    hours[new Date(order.createdAt).getHours()].orders += 1;
  });

  const peakDay = days.reduce((best, day) => (day.orders > best.orders ? day : best), days[0] || { orders: 0 });
  const couponOrders = counted.filter((order) => order.discountCode).length;

  return {
    totals: {
      ...current,
      cancelled,
      customers: customerList.length,
      newCustomers,
      returningCustomers,
      repeatBuyers,
      repeatRate: customerList.length ? (repeatBuyers / customerList.length) * 100 : 0,
      couponOrders,
      cancelRate: inRange.length ? (cancelled / inRange.length) * 100 : 0,
      ordersPerDay: days.length ? current.orders / days.length : 0,
    },
    change: range
      ? {
          revenue: percentChange(current.revenue, before.revenue),
          orders: percentChange(current.orders, before.orders),
          average: percentChange(current.average, before.average),
        }
      : null,
    days,
    peakDay: peakDay?.orders ? peakDay : null,
    bestSellers,
    categoryRevenue,
    statusCounts,
    topCustomers,
    topCities,
    hours,
    hasData: inRange.length > 0,
  };
}
