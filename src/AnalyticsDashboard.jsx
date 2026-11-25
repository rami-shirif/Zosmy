import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { RANGE_OPTIONS, buildAnalytics } from "./analytics";

const dirhams = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 0 });
const dayLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dayLong = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });

function formatDh(amount) {
  return `${dirhams.format(Math.round(amount))} DH`;
}

function compact(amount) {
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`;
  return String(Math.round(amount));
}

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    setWidth(node.clientWidth || 320);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || 320));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Change({ value }) {
  if (value === undefined) return null;
  if (value === null) return <span className="an-change an-change-up"><ArrowUpRight size={13} /> New</span>;
  const rounded = Math.round(value);
  if (rounded === 0) return <span className="an-change an-change-flat"><Minus size={13} /> No change</span>;
  const up = rounded > 0;
  return (
    <span className={`an-change ${up ? "an-change-up" : "an-change-down"}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(rounded)}% vs previous period
    </span>
  );
}

function Kpi({ label, value, suffix = "", change, note }) {
  return (
    <div className="an-kpi">
      <span className="an-kpi-label">{label}</span>
      <strong className="an-kpi-value">
        <NumberFlow value={Math.round(value)} format={{ maximumFractionDigits: 0 }} locales="fr-MA" suffix={suffix} />
      </strong>
      {change !== undefined ? <Change value={change} /> : <span className="an-kpi-note">{note}</span>}
    </div>
  );
}

/** Revenue line + area chart with hover read-out. */
function RevenueChart({ days }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const height = width < 520 ? 230 : 280;
  const pad = { top: 18, right: 14, bottom: 30, left: 44 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...days.map((day) => day.revenue), 0));
  const x = (index) => pad.left + (days.length > 1 ? (index / (days.length - 1)) * innerW : innerW / 2);
  const y = (value) => pad.top + innerH - (value / max) * innerH;

  const points = days.map((day, index) => [x(index), y(day.revenue)]);
  // Smooth the line with a monotone-style curve so it reads as one gesture.
  const line = points.reduce((path, [px, py], index) => {
    if (index === 0) return `M${px},${py}`;
    const [qx, qy] = points[index - 1];
    const mid = (px + qx) / 2;
    return `${path} C${mid},${qy} ${mid},${py} ${px},${py}`;
  }, "");
  const area = points.length
    ? `${line} L${points[points.length - 1][0]},${pad.top + innerH} L${points[0][0]},${pad.top + innerH} Z`
    : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => max * fraction);
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(Math.floor(innerW / 74), 2)));

  function handleMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - pad.left) / innerW;
    setHover(Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1)))));
  }

  const active = hover === null ? null : days[hover];
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover), 90), width - 90);

  return (
    <div className="an-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Revenue per day">
        <defs>
          <linearGradient id="an-rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8b878" stopOpacity=".42" />
            <stop offset="1" stopColor="#d8b878" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="an-grid" />
            <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end" className="an-axis">{compact(tick)}</text>
          </g>
        ))}
        {days.map((day, index) =>
          index % labelEvery === 0 ? (
            <text key={day.key} x={x(index)} y={height - 8} textAnchor="middle" className="an-axis">
              {dayLabel.format(day.date)}
            </text>
          ) : null,
        )}
        {area && <path d={area} fill="url(#an-rev-fill)" />}
        {line && <path d={line} className="an-line" fill="none" />}
        {active && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} className="an-cursor" />
            <circle cx={x(hover)} cy={y(active.revenue)} r="5" className="an-dot" />
          </g>
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {active && (
        <div className="an-tip" style={{ left: tipLeft, top: Math.max(y(active.revenue) - 62, 0) }}>
          <span>{dayLong.format(active.date)}</span>
          <strong>{formatDh(active.revenue)}</strong>
          <small>{active.orders} {active.orders === 1 ? "order" : "orders"}</small>
        </div>
      )}
    </div>
  );
}

/** Orders per day as bars. */
function OrdersChart({ days }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const height = 200;
  const pad = { top: 14, right: 8, bottom: 28, left: 30 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(niceMax(Math.max(...days.map((day) => day.orders), 0)), 4);
  const slot = innerW / Math.max(days.length, 1);
  const barW = Math.max(Math.min(slot * 0.62, 26), 2);
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(Math.floor(innerW / 74), 2)));
  const ticks = [0, max / 2, max];
  const active = hover === null ? null : days[hover];

  return (
    <div className="an-chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Orders per day">
        {ticks.map((tick) => {
          const ty = pad.top + innerH - (tick / max) * innerH;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={ty} y2={ty} className="an-grid" />
              <text x={pad.left - 8} y={ty + 4} textAnchor="end" className="an-axis">{Number.isInteger(tick) ? tick : tick.toFixed(1)}</text>
            </g>
          );
        })}
        {days.map((day, index) => {
          const barH = (day.orders / max) * innerH;
          const bx = pad.left + slot * index + (slot - barW) / 2;
          return (
            <g key={day.key}>
              <rect
                x={bx}
                y={pad.top + innerH - barH}
                width={barW}
                height={Math.max(barH, day.orders ? 2 : 0)}
                rx={Math.min(barW / 2, 4)}
                className={hover === index ? "an-bar an-bar-active" : "an-bar"}
              />
              {index % labelEvery === 0 && (
                <text x={bx + barW / 2} y={height - 8} textAnchor="middle" className="an-axis">{dayLabel.format(day.date)}</text>
              )}
              <rect
                x={pad.left + slot * index}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover(index)}
                onPointerDown={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {active && (
        <div className="an-tip" style={{ left: Math.min(Math.max(pad.left + slot * hover + slot / 2, 70), width - 70), top: 0 }}>
          <span>{dayLong.format(active.date)}</span>
          <strong>{active.orders} {active.orders === 1 ? "order" : "orders"}</strong>
        </div>
      )}
    </div>
  );
}

function BestSellers({ items }) {
  if (!items.length) return <p className="an-empty">No sales in this period yet.</p>;
  const top = items[0].units || 1;
  return (
    <ol className="an-sellers">
      {items.slice(0, 6).map((item, index) => (
        <li key={item.id}>
          <span className="an-seller-thumb" style={{ backgroundColor: item.product?.tone }}>
            {item.product?.image && <img src={item.product.image} alt="" loading="lazy" />}
          </span>
          <span className="an-seller-body">
            <span className="an-seller-head">
              <strong>{item.name}</strong>
              <span>{item.units} sold</span>
            </span>
            <span className="an-seller-track" aria-hidden="true">
              <span style={{ width: `${Math.max((item.units / top) * 100, 4)}%` }} className={index === 0 ? "is-top" : ""} />
            </span>
            <small>{formatDh(item.revenue)} revenue</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

const STATUS_COLORS = { new: "#c9a45f", confirmed: "#7d8fb0", delivered: "#6f9a7b", cancelled: "#b9786f" };
const STATUS_LABELS = { new: "New", confirmed: "Confirmed", delivered: "Delivered", cancelled: "Cancelled" };

function StatusDonut({ counts }) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="an-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Orders by status">
        <circle cx="70" cy="70" r={radius} className="an-donut-track" />
        {total > 0 &&
          Object.entries(counts).map(([status, value]) => {
            if (!value) return null;
            const length = (value / total) * circumference;
            const segment = (
              <circle
                key={status}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={STATUS_COLORS[status]}
                strokeWidth="14"
                strokeDasharray={`${Math.max(length - 2, 0.5)} ${circumference}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += length;
            return segment;
          })}
        <text x="70" y="68" textAnchor="middle" className="an-donut-total">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="an-donut-caption">orders</text>
      </svg>
      <ul>
        {Object.entries(counts).map(([status, value]) => (
          <li key={status}>
            <i style={{ background: STATUS_COLORS[status] }} />
            <span>{STATUS_LABELS[status]}</span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryBars({ items }) {
  if (!items.length) return <p className="an-empty">No category sales yet.</p>;
  const total = items.reduce((sum, item) => sum + item.revenue, 0) || 1;
  return (
    <ul className="an-categories">
      {items.map((item) => (
        <li key={item.name}>
          <span>{item.name}</span>
          <span className="an-category-track"><span style={{ width: `${(item.revenue / total) * 100}%` }} /></span>
          <strong>{Math.round((item.revenue / total) * 100)}%</strong>
        </li>
      ))}
    </ul>
  );
}

function HourStrip({ hours }) {
  const max = Math.max(...hours.map((entry) => entry.orders), 1);
  const peak = hours.reduce((best, entry) => (entry.orders > best.orders ? entry : best), hours[0]);
  return (
    <div>
      <div className="an-hours" role="img" aria-label="Orders by hour of day">
        {hours.map((entry) => (
          <span
            key={entry.hour}
            title={`${String(entry.hour).padStart(2, "0")}:00 · ${entry.orders} orders`}
            style={{ height: `${Math.max((entry.orders / max) * 100, 5)}%`, opacity: entry.orders ? 0.35 + 0.65 * (entry.orders / max) : 0.2 }}
          />
        ))}
      </div>
      <div className="an-hours-axis"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>
      {peak.orders > 0 && <p className="an-hours-note">Most orders arrive around {String(peak.hour).padStart(2, "0")}:00.</p>}
    </div>
  );
}

export default function AnalyticsDashboard({ orders, isLoading }) {
  const [range, setRange] = useState(30);
  const data = useMemo(() => buildAnalytics(orders, range), [orders, range]);
  const { totals } = data;

  if (isLoading && orders.length === 0) return <p className="admin-empty" role="status">Loading analytics…</p>;
  if (orders.length === 0) {
    return (
      <p className="admin-empty">
        No orders yet. Revenue, best sellers and customer statistics will appear here after the first order.
      </p>
    );
  }

  return (
    <div className="an">
      <div className="an-toolbar">
        <div>
          <h2>Store performance</h2>
          <span>Cancelled orders are excluded from revenue and sales.</span>
        </div>
        <div className="an-range" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={range === option.id ? "active" : ""}
              aria-pressed={range === option.id}
              onClick={() => setRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className="an-hero" aria-label="Revenue">
        <div className="an-hero-head">
          <div>
            <span className="an-hero-label">Revenue</span>
            <strong className="an-hero-value">
              <NumberFlow value={Math.round(totals.revenue)} format={{ maximumFractionDigits: 0 }} locales="fr-MA" suffix=" DH" />
            </strong>
            {data.change ? <Change value={data.change.revenue} /> : <span className="an-kpi-note">Across all recorded orders</span>}
          </div>
          <dl className="an-hero-facts">
            <div><dt>Average order</dt><dd>{formatDh(totals.average)}</dd></div>
            <div><dt>Units sold</dt><dd>{totals.units}</dd></div>
            <div><dt>Best day</dt><dd>{data.peakDay ? `${dayLabel.format(data.peakDay.date)} · ${data.peakDay.orders} orders` : "—"}</dd></div>
          </dl>
        </div>
        <RevenueChart days={data.days} />
      </section>

      <div className="an-kpis">
        <Kpi label="Orders" value={totals.orders} change={data.change?.orders} note={`${totals.ordersPerDay.toFixed(1)} per day`} />
        <Kpi label="Customers" value={totals.customers} note={`${totals.newCustomers} new · ${totals.returningCustomers} returning`} />
        <Kpi label="Repeat buyers" value={totals.repeatRate} suffix="%" note={`${totals.repeatBuyers} ordered more than once`} />
        <Kpi label="Cancelled" value={totals.cancelRate} suffix="%" note={`${totals.cancelled} ${totals.cancelled === 1 ? "order" : "orders"} · ${totals.couponOrders} used ZOSMY2027`} />
      </div>

      {!data.hasData ? (
        <p className="admin-empty">No orders in this period. Try a longer range.</p>
      ) : (
        <div className="an-grid-layout">
          <section className="an-panel an-span-2">
            <header><h3>Daily orders</h3><span>{totals.orders} in period</span></header>
            <OrdersChart days={data.days} />
          </section>

          <section className="an-panel an-span-2">
            <header><h3>Best-selling cosmetics</h3><span>by units sold</span></header>
            <BestSellers items={data.bestSellers} />
          </section>

          <section className="an-panel">
            <header><h3>Order status</h3></header>
            <StatusDonut counts={data.statusCounts} />
          </section>

          <section className="an-panel">
            <header><h3>Revenue by category</h3></header>
            <CategoryBars items={data.categoryRevenue} />
          </section>

          <section className="an-panel">
            <header><h3>Top customers</h3><span>by spend</span></header>
            {data.topCustomers.length === 0 ? (
              <p className="an-empty">No customers yet.</p>
            ) : (
              <ul className="an-people">
                {data.topCustomers.map((customer) => (
                  <li key={customer.key}>
                    <span className="an-avatar" aria-hidden="true">{customer.name.trim().charAt(0).toUpperCase() || "G"}</span>
                    <span className="an-person">
                      <strong>{customer.name}</strong>
                      <small>{customer.orders} {customer.orders === 1 ? "order" : "orders"}{customer.city ? ` · ${customer.city}` : ""}</small>
                    </span>
                    <span className="an-person-total">{formatDh(customer.spent)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="an-panel">
            <header><h3>Top cities</h3><span>by orders</span></header>
            {data.topCities.length === 0 ? (
              <p className="an-empty">No city data yet.</p>
            ) : (
              <ul className="an-cities">
                {data.topCities.map((city) => (
                  <li key={city.name}>
                    <span>{city.name}</span>
                    <small>{formatDh(city.revenue)}</small>
                    <strong>{city.orders}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="an-panel an-span-2">
            <header><h3>When customers order</h3><span>by hour of day</span></header>
            <HourStrip hours={data.hours} />
          </section>
        </div>
      )}
    </div>
  );
}
