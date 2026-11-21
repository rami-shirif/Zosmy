import { useEffect, useMemo, useState } from "react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Heart,
  House,
  Leaf,
  Menu,
  Minus,
  Pause,
  Plus,
  Play,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { getPlaceOrder } from "./firebase";
import { products } from "./products";

const categories = ["All", "Skincare", "Body care", "Sets"];
const popularProducts = products.filter((product) => product.badge);

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.2, 0.65, 0.3, 0.9] } },
};

function App() {
  const [category, setCategory] = useState("All");
  const [pathname, setPathname] = useState(window.location.pathname);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  });
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [orderStatus, setOrderStatus] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState("home");
  const selectedProduct = products.find(
    (product) => pathname === `/products/${product.id}`,
  );

  useEffect(() => {
    function syncPathname() {
      setPathname(window.location.pathname);
      setOrderStatus("");
      setDetailQuantity(1);
    }

    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);

  useEffect(() => {
    document.title = selectedProduct
      ? `${selectedProduct.name} — Zosmy`
      : "Zosmy — A little closer to your glow";
  }, [selectedProduct]);

  function navigate(path) {
    window.history.pushState({}, "", path);
    setPathname(path);
    setOrderStatus("");
    setDetailQuantity(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const visibleProducts = useMemo(
    () =>
      category === "All"
        ? products
        : products.filter((product) => product.category === category),
    [category],
  );
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  function updateQuantity(product, change) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing && change > 0) {
        return [...current, { product, quantity: change }];
      }
      return current
        .map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
  }

  async function submitOrder(event, items = cart) {
    event.preventDefault();
    if (!items.length) return;

    setIsSubmitting(true);
    setOrderStatus("");
    try {
      const placeOrder = await getPlaceOrder();
      if (!placeOrder) {
        setOrderStatus({
          type: "error",
          message: "Firebase isn't connected yet. Add your Firebase settings to .env.local to place an order.",
        });
        return;
      }
      const result = await placeOrder({
        customer,
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
        })),
      });
      const { telegramNotified } = result.data;
      if (items === cart) setCart([]);
      setOrderStatus({
        type: "success",
        message: telegramNotified
          ? "Your order is in. Thanks for making a little time for you."
          : "Your order was saved, but we couldn't notify the shop on Telegram. Please contact us to confirm.",
      });
    } catch (error) {
      console.error("Could not submit the order.", error);
      setOrderStatus({
        type: "error",
        message: error.message || "We couldn't save your order. Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="site-shell">
      <div className="announcement">
        A little something for your first order — enjoy 10% off with <b>HELLO10</b>
        <ArrowRight size={14} aria-hidden="true" />
      </div>
      <header className="header">
        <button
          className="icon-button mobile-menu-button"
          aria-label="Open menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Menu size={21} />
        </button>
        <a href="/" className="wordmark" aria-label="Zosmy home" onClick={(event) => { event.preventDefault(); navigate("/"); }}>zosmy<span>®</span></a>
        <nav className={menuOpen ? "nav-links nav-open" : "nav-links"}>
          <a href={selectedProduct ? "/#shop" : "#shop"} onClick={(event) => { setMenuOpen(false); if (selectedProduct) { event.preventDefault(); navigate("/"); } }}>Shop</a>
          <a href={selectedProduct ? "/#story" : "#story"} onClick={(event) => { setMenuOpen(false); if (selectedProduct) { event.preventDefault(); navigate("/"); } }}>Our story</a>
          <a href={selectedProduct ? "/#ritual" : "#ritual"} onClick={(event) => { setMenuOpen(false); if (selectedProduct) { event.preventDefault(); navigate("/"); } }}>The ritual</a>
        </nav>
        <button
          className="bag-button"
          onClick={() => setCartOpen(true)}
          aria-label={`Open bag, ${cartCount} items`}
        >
          <ShoppingBag size={19} strokeWidth={1.6} />
          <span>Bag</span>
          <span className="bag-count"><NumberFlow value={cartCount} /></span>
        </button>
      </header>

      <main id="top">
        {selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            quantity={detailQuantity}
            setQuantity={setDetailQuantity}
            customer={customer}
            setCustomer={setCustomer}
            orderStatus={orderStatus}
            isSubmitting={isSubmitting}
            onSubmit={(event) => submitOrder(event, [{ product: selectedProduct, quantity: detailQuantity }])}
            onBack={() => navigate("/")}
          />
        ) : (
          <>
        <section className="hero">
          <div className="hero-copy">
            <motion.div
              className="eyebrow"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="eyebrow-line" /> SKINCARE, SLOWED DOWN
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.08 }}
            >
              A little closer
              <br />
              to your <em>glow.</em>
            </motion.h1>
            <motion.p
              className="hero-description"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.2 }}
            >
              Thoughtful formulas for the skin you’re in.
              <br className="desktop-break" /> Made to feel good, every single day.
            </motion.p>
            <motion.a
              className="button button-dark"
              href="#shop"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              FIND YOUR RITUAL <ArrowRight size={15} />
            </motion.a>
            <div className="hero-note">
              <span className="note-stars">★★★★★</span>
              <span>Loved by 12,000+ happy skin days</span>
            </div>
          </div>
          <motion.div
            className="hero-image-wrap"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <img
              className="hero-image"
              src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1600&q=90"
              alt="A calm, sunlit skincare ritual"
            />
            <div className="hero-sticker">
              <span>GOOD SKIN</span>
              <Sparkles size={16} />
              <span>GOOD MOOD</span>
            </div>
            <div className="image-caption">
              <span>01 / 03</span>
              <span>YOUR EVERYDAY, ELEVATED</span>
            </div>
          </motion.div>
          <a className="scroll-cue" href="#shop" aria-label="Scroll to shop">
            <ArrowDown size={16} />
          </a>
        </section>

        <section className="value-strip" aria-label="Our values">
          <span><Leaf size={17} /> KIND TO YOUR SKIN</span>
          <span className="strip-divider" />
          <span>GOOD-FOR-YOU INGREDIENTS</span>
          <span className="strip-divider" />
          <span>MADE WITH INTENTION</span>
          <span className="strip-divider" />
          <span>NEVER THE EXTRA STUFF</span>
        </section>

        <section className="shop-section section-pad" id="shop">
          <motion.div
            className="section-heading"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> THE GOOD SKIN EDIT</div>
              <h2>Small rituals.<br /><em>Big feel-good.</em></h2>
            </div>
            <p>
              Your skin, but on a really good day.
              <br />Meet the essentials you’ll reach for again.
            </p>
          </motion.div>
          <PopularProducts
            products={popularProducts}
            onAdd={(product) => updateQuantity(product, 1)}
            onOpen={(product) => navigate(`/products/${product.id}`)}
          />
          <div className="shop-toolbar">
            <div className="filter-list" aria-label="Filter products">
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? "filter-chip active" : "filter-chip"}
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                >
                  {item}
                </button>
              ))}
            </div>
            <span className="product-count">{visibleProducts.length} GOOD THINGS</span>
          </div>
          <motion.div layout className="product-grid">
            <AnimatePresence mode="popLayout">
              {visibleProducts.map((product, index) => (
                <motion.article
                  className="product-card"
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, delay: index * 0.045 }}
                >
                  <div className="product-image" style={{ backgroundColor: product.tone }}>
                    <a
                      className="product-image-link"
                      href={`/products/${product.id}`}
                      aria-label={`View ${product.name}`}
                      onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}
                    >
                      <img src={product.image} alt={product.name} loading="lazy" />
                    </a>
                    {product.badge && <span className="product-badge">{product.badge}</span>}
                    <button
                      className="favorite-button"
                      aria-label={`Add ${product.name} to favorites`}
                      onClick={(event) => {
                        event.currentTarget.classList.toggle("favorited");
                      }}
                    >
                      <Heart size={17} />
                    </button>
                    <button
                      className="quick-add"
                      onClick={() => updateQuantity(product, 1)}
                    >
                      ADD TO BAG <Plus size={14} />
                    </button>
                  </div>
                  <div className="product-info">
                    <div className="product-name-row">
                      <h3><a href={`/products/${product.id}`} onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}>{product.name}</a></h3>
                      <span>{formatDirhams(product.price)}</span>
                    </div>
                    <p>{product.description}</p>
                    <a className="product-details-link" href={`/products/${product.id}`} onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}>VIEW PRODUCT <ArrowRight size={13} /></a>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        </section>

        <section className="story-section" id="story">
          <div className="story-image">
            <img
              src="https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?auto=format&fit=crop&w=1300&q=85"
              alt="Botanical ingredients and skincare"
              loading="lazy"
            />
            <div className="story-image-label">A SOFTER KIND OF SKINCARE</div>
          </div>
          <motion.div
            className="story-copy"
            variants={reveal}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="eyebrow"><span className="eyebrow-line" /> A NOTE FROM US</div>
            <h2>Less pressure.<br /><em>More presence.</em></h2>
            <p>
              We believe your skincare shelf should feel like an exhale. So we
              make uncomplicated, feel-good formulas that give your skin what
              it needs—and leave a little room for everything else.
            </p>
            <a className="text-link" href="#ritual">A LITTLE MORE ABOUT US <ArrowRight size={15} /></a>
            <div className="story-signoff">With care, <span>the zosmy team</span></div>
          </motion.div>
        </section>

        <section className="ritual-section section-pad" id="ritual">
          <div className="ritual-heading">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR THREE-MINUTE RESET</div>
            <h2>Make room for <em>you.</em></h2>
          </div>
          <div className="ritual-steps">
            <div className="ritual-step">
              <span className="step-number">01</span>
              <span className="step-icon"><Sparkles size={20} /></span>
              <h3>Cleanse gently</h3>
              <p>Wash away the day. Keep the good stuff.</p>
            </div>
            <div className="ritual-step">
              <span className="step-number">02</span>
              <span className="step-icon"><DropletIcon /></span>
              <h3>Give skin a drink</h3>
              <p>A few drops of hydration go a long way.</p>
            </div>
            <div className="ritual-step">
              <span className="step-number">03</span>
              <span className="step-icon"><Heart size={20} /></span>
              <h3>Seal in the soft</h3>
              <p>Take a breath. This part is just for you.</p>
            </div>
          </div>
        </section>

        <section className="newsletter">
          <div className="newsletter-sparkle"><Sparkles size={25} /></div>
          <p>NOTES FROM THE SOFTER SIDE</p>
          <h2>A little love in your inbox.</h2>
          <span>Good skin notes, small joys, and 10% off your first order.</span>
          <form
            className="newsletter-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              form.reset();
              setNewsletterStatus("You’re on the list. Keep an eye on your inbox.");
            }}
          >
            <label className="visually-hidden" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" type="email" placeholder="Your email address" required />
            <button type="submit" aria-label="Subscribe"><ArrowRight size={18} /></button>
          </form>
          {newsletterStatus && <span className="newsletter-success">{newsletterStatus}</span>}
        </section>
          </>
        )}
      </main>

      {!selectedProduct && (
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <a href="/" className="wordmark" onClick={(event) => { event.preventDefault(); navigate("/"); }}>zosmy<span>®</span></a>
            <p>A little closer to your glow.<br />A lot closer to yourself.</p>
          </div>
          <div className="footer-column">
            <h3>THE GOOD STUFF</h3>
            <a href="#shop">Shop all</a>
            <a href="#shop">Skincare</a>
            <a href="#shop">Body care</a>
            <a href="#ritual">Build your ritual</a>
          </div>
          <div className="footer-column">
            <h3>HERE FOR YOU</h3>
            <a href="mailto:hello@zosmy.com">Get in touch</a>
            <a href="#story">Our story</a>
            <a href="#story">Shipping & returns</a>
            <a href="#story">FAQs</a>
          </div>
          <div className="footer-note">
            <span>TAKE WHAT YOU NEED</span>
            <p>A moment. A deep breath.<br />A little kindness to yourself.</p>
            <span className="footer-flower">✳</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 ZOSMY. MADE WITH A LITTLE MORE CARE.</span>
          <div><a href="#story">PRIVACY</a><a href="#story">TERMS</a><span>MADE FOR YOUR SKIN, NOT THE ALGORITHM.</span></div>
        </div>
      </footer>
      )}

      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.button
              className="drawer-backdrop"
              aria-label="Close bag"
              onClick={() => setCartOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="cart-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-title"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <div className="drawer-heading">
                <h2 id="cart-title">Your little bag <span>({cartCount})</span></h2>
                <button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={20} /></button>
              </div>
              {cart.length === 0 ? (
                <div className="empty-cart">
                  <ShoppingBag size={28} strokeWidth={1.3} />
                  <p>Your bag is taking a little breather.</p>
                  <button className="button button-dark" onClick={() => { setCartOpen(false); document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth" }); }}>FIND YOUR RITUAL <ArrowRight size={15} /></button>
                </div>
              ) : (
                <>
                  <div className="cart-items">
                    {cart.map(({ product, quantity }) => (
                      <div className="cart-item" key={product.id}>
                        <img src={product.image} alt="" />
                        <div className="cart-item-copy">
                          <h3>{product.name}</h3>
                          <span>{formatDirhams(product.price)}</span>
                          <div className="quantity-control">
                            <button onClick={() => updateQuantity(product, -1)} aria-label={`Remove one ${product.name}`}><Minus size={13} /></button>
                            <NumberFlow value={quantity} />
                            <button onClick={() => updateQuantity(product, 1)} aria-label={`Add one ${product.name}`}><Plus size={13} /></button>
                          </div>
                        </div>
                        <span className="line-total">{formatDirhams(product.price * quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="cart-bottom">
                    <div className="subtotal"><span>Subtotal</span><strong>{formatDirhams(subtotal)}</strong></div>
                    <p>Shipping calculated at checkout.</p>
                    <button className="button button-dark checkout-button" onClick={() => { setCheckoutOpen(true); setOrderStatus(""); }}>CONTINUE TO CHECKOUT <ArrowRight size={15} /></button>
                    <span className="secure-note"><Heart size={13} /> A little care goes a long way</span>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isSubmitting) setCheckoutOpen(false);
            }}
          >
            <motion.section
              className="checkout-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-title"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <button className="icon-button modal-close" onClick={() => setCheckoutOpen(false)} aria-label="Close checkout"><X size={20} /></button>
              <div className="eyebrow"><span className="eyebrow-line" /> ALMOST YOURS</div>
              <h2 id="checkout-title">A little more <em>you-time.</em></h2>
              {orderStatus?.type === "success" ? (
                <div className="order-success"><span><Check size={23} /></span><p>{orderStatus.message}</p><button className="text-link" onClick={() => { setCheckoutOpen(false); setCartOpen(false); }}>BACK TO THE GOOD STUFF <ArrowRight size={15} /></button></div>
              ) : (
                <form className="checkout-form" onSubmit={submitOrder}>
                  <CustomerFields customer={customer} setCustomer={setCustomer} />
                  <div className="checkout-total"><span>Your feel-good total</span><strong>{formatDirhams(subtotal)}</strong></div>
                  {orderStatus?.type === "error" && <p className="form-message" role="alert">{orderStatus.message}</p>}
                  <button className="button button-dark checkout-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "SAVING YOUR ORDER..." : "PLACE YOUR ORDER"} <ArrowRight size={15} />
                  </button>
                  <p className="checkout-disclaimer">Payment isn’t collected online. We’ll contact you to confirm delivery.</p>
                </form>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="mobile-tab-bar" aria-label="App navigation">
        <a
          href="/"
          className={activeMobileTab === "home" ? "mobile-tab active" : "mobile-tab"}
          aria-current={activeMobileTab === "home" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveMobileTab("home");
            navigate("/");
          }}
        >
          <House size={20} strokeWidth={1.8} />
          <span>Home</span>
        </a>
        <a
          href={selectedProduct ? "/#shop" : "#shop"}
          className={activeMobileTab === "shop" ? "mobile-tab active" : "mobile-tab"}
          aria-current={activeMobileTab === "shop" ? "page" : undefined}
          onClick={(event) => {
            setActiveMobileTab("shop");
            if (selectedProduct) {
              event.preventDefault();
              navigate("/");
              window.setTimeout(() => document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth" }), 0);
            }
          }}
        >
          <Store size={20} strokeWidth={1.8} />
          <span>Shop</span>
        </a>
        <a
          href={selectedProduct ? "/#ritual" : "#ritual"}
          className={activeMobileTab === "ritual" ? "mobile-tab active" : "mobile-tab"}
          aria-current={activeMobileTab === "ritual" ? "page" : undefined}
          onClick={(event) => {
            setActiveMobileTab("ritual");
            if (selectedProduct) {
              event.preventDefault();
              navigate("/");
              window.setTimeout(() => document.querySelector("#ritual")?.scrollIntoView({ behavior: "smooth" }), 0);
            }
          }}
        >
          <BookOpen size={20} strokeWidth={1.8} />
          <span>Ritual</span>
        </a>
        <button
          type="button"
          className={activeMobileTab === "bag" ? "mobile-tab active" : "mobile-tab"}
          aria-label={`Open bag, ${cartCount} items`}
          onClick={() => {
            setActiveMobileTab("bag");
            setCartOpen(true);
          }}
        >
          <span className="mobile-tab-icon">
            <ShoppingBag size={20} strokeWidth={1.8} />
            {cartCount > 0 && <span className="mobile-tab-count">{cartCount}</span>}
          </span>
          <span>Bag</span>
        </button>
      </nav>
    </div>
  );
}

function PopularProducts({ products: items, onAdd, onOpen }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (isPaused || isInteracting || items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [isPaused, isInteracting, items.length]);

  if (!items.length) return null;

  const activeProduct = items[activeIndex];
  const move = (direction) => {
    setActiveIndex((index) => (index + direction + items.length) % items.length);
  };

  return (
    <section
      className="popular-section"
      aria-label="Most popular products"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
      }}
    >
      <div className="popular-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> THE COMMUNITY LOVES</div>
          <h3>Most <em>loved.</em></h3>
        </div>
        <div className="popular-controls">
          <button type="button" aria-label="Previous popular product" onClick={() => move(-1)}><ArrowLeft size={17} /></button>
          <span aria-live="polite">{String(activeIndex + 1).padStart(2, "0")} <i>/</i> {String(items.length).padStart(2, "0")}</span>
          <button
            type="button"
            className="popular-pause"
            aria-label={isPaused ? "Resume automatic product slider" : "Pause automatic product slider"}
            onClick={() => setIsPaused((paused) => !paused)}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button type="button" aria-label="Next popular product" onClick={() => move(1)}><ArrowRight size={17} /></button>
        </div>
      </div>
      <div className="popular-slide" key={activeProduct.id} aria-live="polite">
        <div className="popular-image" style={{ backgroundColor: activeProduct.tone }}>
          <img src={activeProduct.image} alt={activeProduct.name} loading="lazy" />
          {activeProduct.badge && <span className="product-badge">{activeProduct.badge}</span>}
        </div>
        <div className="popular-copy">
          <span className="popular-kicker"><Sparkles size={14} /> A CUSTOMER FAVORITE</span>
          <h4>{activeProduct.name}</h4>
          <p>{activeProduct.description}</p>
          <strong>{formatDirhams(activeProduct.price)}</strong>
          <div className="popular-actions">
            <button type="button" className="button button-dark" onClick={() => onAdd(activeProduct)}>ADD TO BAG <Plus size={15} /></button>
            <button type="button" className="text-link" onClick={() => onOpen(activeProduct)}>EXPLORE <ArrowRight size={14} /></button>
          </div>
        </div>
      </div>
      <div className="popular-dots" role="group" aria-label="Choose a popular product">
        {items.map((product, index) => (
          <button
            type="button"
            key={product.id}
            className={index === activeIndex ? "popular-dot active" : "popular-dot"}
            aria-label={`Show ${product.name}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}

function DropletIcon() {
  return <span className="droplet-icon">◒</span>;
}

function ProductDetail({
  product,
  quantity,
  setQuantity,
  customer,
  setCustomer,
  orderStatus,
  isSubmitting,
  onSubmit,
  onBack,
}) {
  return (
    <section className="product-detail-page section-pad">
      <button className="text-link product-back-link" onClick={onBack}><ArrowRight size={14} /> BACK TO SHOP</button>
      <div className="product-detail-layout">
        <div className="product-detail-image" style={{ backgroundColor: product.tone }}>
          <img src={product.image} alt={product.name} />
          {product.badge && <span className="product-badge">{product.badge}</span>}
        </div>
        <div className="product-detail-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> {product.category.toUpperCase()}</div>
          <h1>{product.name}</h1>
          <p className="product-detail-description">{product.description}</p>
          <strong className="product-detail-price">{formatDirhams(product.price)}</strong>
          <form className="product-order-form" onSubmit={onSubmit}>
            <div className="detail-quantity">
              <span>QUANTITY</span>
              <div className="quantity-control">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Remove one"><Minus size={13} /></button>
                <span>{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Add one"><Plus size={13} /></button>
              </div>
            </div>
            <CustomerFields customer={customer} setCustomer={setCustomer} />
            <div className="checkout-total"><span>Total</span><strong>{formatDirhams(product.price * quantity)}</strong></div>
            {orderStatus?.type === "success" && <p className="order-inline-success" role="status">{orderStatus.message}</p>}
            {orderStatus?.type === "error" && <p className="form-message" role="alert">{orderStatus.message}</p>}
            <button className="button button-dark checkout-button" type="submit" disabled={isSubmitting || orderStatus?.type === "success"}>
              {isSubmitting ? "SENDING YOUR ORDER..." : orderStatus?.type === "success" ? "ORDER RECEIVED" : "ORDER THIS PRODUCT"} <ArrowRight size={15} />
            </button>
            <p className="checkout-disclaimer">Pay on delivery. We’ll contact you to confirm your order.</p>
          </form>
        </div>
      </div>
    </section>
  );
}

function CustomerFields({ customer, setCustomer }) {
  function update(field, value) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="customer-fields">
      <label>FULL NAME<input value={customer.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" maxLength={100} required /></label>
      <label>PHONE NUMBER<input type="tel" value={customer.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" maxLength={30} required /></label>
      <label>EMAIL ADDRESS (OPTIONAL)<input type="email" value={customer.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" maxLength={254} /></label>
      <label>DELIVERY ADDRESS<input value={customer.address} onChange={(event) => update("address", event.target.value)} autoComplete="street-address" maxLength={200} required /></label>
      <label>CITY<input value={customer.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" maxLength={100} required /></label>
    </div>
  );
}

function formatDirhams(amount) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(amount)} DH`;
}

export default App;
