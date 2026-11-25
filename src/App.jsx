import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Heart,
  House,
  Leaf,
  Minus,
  Pause,
  Plus,
  Play,
  Quote,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { requestOrderNotification } from "./orderNotification";
import { calculateOrderTotal } from "./orderPricing";
import { products } from "./products";

const AdminPage = lazy(() => import("./AdminPage"));
const AccountPage = lazy(() => import("./AccountPage"));
const categories = ["All", "Skincare", "Body care", "Sets"];
const popularProducts = products.filter((product) => product.badge);
const featuredProduct = products[0];
const CART_STORAGE_KEY = "zosmy-bag";
const testimonials = [
  {
    id: "zosmy-customer-1",
    quote: "this good, شكرا 😍, i like it thank you Zosmy",
    author: "A Zosmy customer",
  },
  {
    id: "zosmy-customer-2",
    quote: "thank you 😍",
    author: "A Zosmy customer",
  },
  {
    id: "zosmy-customer-3",
    quote: "حبيتها 💖",
    author: "A Zosmy customer",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.2, 0.65, 0.3, 0.9] } },
};

function readSavedCart() {
  let serialized;
  try {
    serialized = window.localStorage.getItem(CART_STORAGE_KEY);
  } catch (error) {
    console.error("Could not read the saved bag from local storage.", error);
    return [];
  }
  if (serialized === null) return [];

  let savedItems;
  try {
    savedItems = JSON.parse(serialized);
  } catch (error) {
    console.error("The saved bag contains invalid JSON.", error);
    return [];
  }

  if (!Array.isArray(savedItems)) {
    console.error("The saved bag is not a list of products.");
    return [];
  }

  return savedItems.reduce((restored, item) => {
    if (
      !item ||
      typeof item.productId !== "string" ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    ) {
      console.warn("Ignoring an invalid item in the saved bag.", item);
      return restored;
    }

    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      console.warn("Ignoring a saved bag item for an unknown product.", item.productId);
      return restored;
    }

    const existing = restored.find((entry) => entry.product.id === product.id);
    if (existing) existing.quantity = Math.min(25, existing.quantity + item.quantity);
    else restored.push({ product, quantity: Math.min(25, item.quantity) });
    return restored;
  }, []);
}

function App() {
  const [category, setCategory] = useState("All");
  const [pathname, setPathname] = useState(window.location.pathname);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [couponFeedback, setCouponFeedback] = useState("");
  const [guestReceipt, setGuestReceipt] = useState(null);
  const [trackingCodeForAccount, setTrackingCodeForAccount] = useState(() => new URLSearchParams(window.location.search).get("tracking") || "");
  const [copiedTrackingCode, setCopiedTrackingCode] = useState(false);
  const [cart, setCart] = useState(readSavedCart);
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
  const [activeMobileTab, setActiveMobileTab] = useState("home");
  const [bagNotice, setBagNotice] = useState(null);
  const bagNoticeId = useRef(0);
  const bagButtonControls = useAnimationControls();
  const selectedProduct = products.find(
    (product) => pathname === `/products/${product.id}`,
  );

  useEffect(() => {
    let active = true;
    let unsubscribe;
    import("./firebase")
      .then(({ subscribeToAuth }) => {
        if (active) unsubscribe = subscribeToAuth(setCurrentUser);
      })
      .catch((error) => {
        console.error("Could not initialize customer account state.", error);
        if (active) setAuthError(error.message || "Could not connect to customer accounts.");
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    function syncPathname() {
      setPathname(window.location.pathname);
      setActiveMobileTab(window.location.pathname === "/account" ? "account" : "home");
      setOrderStatus("");
      setDetailQuantity(1);
    }

    window.addEventListener("popstate", syncPathname);
    return () => window.removeEventListener("popstate", syncPathname);
  }, []);

  useEffect(() => {
    document.title = pathname === "/admin"
      ? "Orders — Zosmy Admin"
      : selectedProduct
      ? `${selectedProduct.name} — Zosmy`
      : "Zosmy — A little closer to your glow";
  }, [pathname, selectedProduct]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  useEffect(() => {
    const savedItems = cart.map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    }));

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(savedItems));
    } catch (error) {
      console.error("Could not save the bag to local storage.", error);
    }
  }, [cart]);

  useEffect(() => {
    if (!bagNotice) return undefined;
    const timer = window.setTimeout(() => setBagNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [bagNotice]);

  function navigate(path) {
    if (window.location.pathname === path) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    } else {
      window.history.pushState({}, "", path);
      setPathname(path);
    }
    setOrderStatus("");
    setDetailQuantity(1);
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
  const checkoutTotal = calculateOrderTotal(subtotal, discountCode);

  function applyCoupon() {
    if (couponInput.trim().toLowerCase() === "zosmy2027") {
      setDiscountCode("zosmy2027");
      setCouponFeedback("10% discount applied.");
    } else {
      setDiscountCode("");
      setCouponFeedback("That discount code isn’t valid.");
    }
  }

  function updateCouponInput(value) {
    setCouponInput(value);
    setDiscountCode("");
    setCouponFeedback("");
  }

  function openTrackingPage(code) {
    setTrackingCodeForAccount(code);
    setGuestReceipt(null);
    setCopiedTrackingCode(false);
    setActiveMobileTab("account");
    navigate("/account");
  }

  function updateQuantity(product, change) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing && change > 0) {
        return [...current, { product, quantity: Math.min(25, change) }];
      }
      return current
        .map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(25, item.quantity + change) }
            : item,
        )
        .filter((item) => item.quantity > 0);
    });
  }

  function addToBag(product) {
    updateQuantity(product, 1);
    bagNoticeId.current += 1;
    setBagNotice({ id: bagNoticeId.current, productName: product.name });
    bagButtonControls.start({
      scale: [1, 1.14, 1],
      rotate: [0, -5, 5, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    });
  }

  async function submitOrder(event, items = cart) {
    event.preventDefault();
    if (!items.length) return;

    setIsSubmitting(true);
    setOrderStatus("");
    try {
      const order = {
        ownerUid: currentUser?.uid,
        discountCode,
        customer,
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          quantity,
          unitPrice: product.price,
        })),
      };
      const { createOrder } = await import("./firebase");
      const { orderId, trackingCode } = await createOrder(order);
      let successMessage = "Your order is saved. We'll contact you to confirm shortly.";
      try {
        await requestOrderNotification(orderId);
      } catch (notificationError) {
        console.error("Order saved, but immediate Telegram notification failed.", notificationError);
        successMessage = "Your order is saved. The shop will be notified shortly.";
      }
      if (items === cart) setCart([]);
      setOrderStatus({
        type: "success",
        message: successMessage,
        trackingCode,
        total: calculateOrderTotal(
          items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
          discountCode,
        ),
      });
      setCustomer({ name: "", phone: "", email: "", address: "", city: "" });
      updateCouponInput("");
      setGuestReceipt({ trackingCode });
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (error) {
      console.error("Could not submit the order.", error);
      setOrderStatus({
        type: "error",
        message: error.message || "We couldn't send your order. Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pathname === "/admin") {
    return (
      <Suspense fallback={<main className="admin-main">Loading order dashboard…</main>}>
        <AdminPage />
      </Suspense>
    );
  }

  return (
    <div className="site-shell">
      <div className="announcement black-friday-banner">
        <span className="black-friday-badge"><Sparkles size={12} aria-hidden="true" /> BLACK FRIDAY</span>
        <span className="black-friday-copy">A little something for your first order</span>
        <b>10% OFF · ZOSMY2027</b>
        <ArrowRight size={14} aria-hidden="true" />
      </div>
      <header className="header">
        <a href="/" className="wordmark" aria-label="Zosmy home" onClick={(event) => { event.preventDefault(); navigate("/"); }}>zosmy<span>®</span></a>
        <button
          className="account-button"
          type="button"
          onClick={() => navigate("/account")}
          aria-label={currentUser ? "Open your account and orders" : "Sign in or create an account"}
        >
          <UserRound size={18} strokeWidth={1.7} />
          <span>{currentUser ? "Account" : "Sign in"}</span>
        </button>
        <motion.button
          className="bag-button"
          animate={bagButtonControls}
          onClick={() => setCartOpen(true)}
          aria-label={`Open bag, ${cartCount} items`}
        >
          <ShoppingBag size={19} strokeWidth={1.6} />
          <span>Bag</span>
          <span className="bag-count"><NumberFlow value={cartCount} /></span>
        </motion.button>
      </header>

      <AnimatePresence>
        {bagNotice && (
          <motion.div
            className="bag-toast"
            key={bagNotice.id}
            role="status"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <span className="bag-toast-check"><Check size={17} /></span>
            <span className="bag-toast-copy">
              <strong>Added to your bag</strong>
              <small>{bagNotice.productName}</small>
            </span>
            <button type="button" onClick={() => { setCartOpen(true); setBagNotice(null); }}>
              VIEW BAG <ArrowRight size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.main id="top" key={pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, ease: "easeOut" }}>
        {pathname === "/account" ? (
          <Suspense fallback={<section className="account-page section-pad">Loading account…</section>}>
            <AccountPage
              user={currentUser}
              authError={authError}
              initialTrackingCode={trackingCodeForAccount}
            />
          </Suspense>
        ) : selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            quantity={detailQuantity}
            setQuantity={setDetailQuantity}
            customer={customer}
            setCustomer={setCustomer}
            couponInput={couponInput}
            discountCode={discountCode}
            couponFeedback={couponFeedback}
            onCouponInputChange={updateCouponInput}
            onApplyCoupon={applyCoupon}
            orderStatus={orderStatus}
            isSubmitting={isSubmitting}
            onSubmit={(event) => submitOrder(event, [{ product: selectedProduct, quantity: detailQuantity }])}
            onBack={() => navigate("/")}
          />
        ) : (
          <>
        <motion.section className="hero" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }}>
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
            style={{ backgroundColor: featuredProduct.tone }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <a
              className="hero-image-link"
              href={`/products/${featuredProduct.id}`}
              aria-label={`View ${featuredProduct.name}`}
              onClick={(event) => { event.preventDefault(); navigate(`/products/${featuredProduct.id}`); }}
            >
              <img className="hero-image" src={featuredProduct.image} alt={featuredProduct.name} />
            </a>
            <span className="hero-product-tag">{featuredProduct.badge || "DAILY ESSENTIAL"}</span>
            <div className="hero-product-caption">
              <div className="hero-product-copy">
                <span>THE EVERYDAY FAVORITE</span>
                <strong>{featuredProduct.name}</strong>
                <small>{featuredProduct.description}</small>
              </div>
              <div className="hero-product-action">
                <span>{formatDirhams(featuredProduct.price)}</span>
                <button
                  type="button"
                  aria-label={`Add ${featuredProduct.name} to bag`}
                  onClick={() => addToBag(featuredProduct)}
                ><Plus size={18} /></button>
              </div>
            </div>
          </motion.div>
          <a className="scroll-cue" href="#shop" aria-label="Scroll to shop">
            <ArrowDown size={16} />
          </a>
        </motion.section>

        <motion.section className="value-strip" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }} aria-label="Our values">
          <span><Leaf size={17} /> KIND TO YOUR SKIN</span>
          <span className="strip-divider" />
          <span>GOOD-FOR-YOU INGREDIENTS</span>
          <span className="strip-divider" />
          <span>MADE WITH INTENTION</span>
          <span className="strip-divider" />
          <span>NEVER THE EXTRA STUFF</span>
        </motion.section>

        <motion.section className="shop-section section-pad" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }} id="shop">
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
            onAdd={addToBag}
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
                  <span>{item}</span>
                  <span className="filter-chip-count">
                    {item === "All" ? products.length : products.filter((product) => product.category === item).length}
                  </span>
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
                      onClick={() => addToBag(product)}
                    >
                      ADD TO BAG <Plus size={14} />
                    </button>
                  </div>
                  <div className="product-info">
                    <div className="product-name-row">
                      <h3><a href={`/products/${product.id}`} onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}>{product.name}</a></h3>
                      <span className="product-price">{formatDirhams(product.price)}</span>
                    </div>
                    <p className="product-description">{product.description}</p>
                    <a className="product-details-link" href={`/products/${product.id}`} onClick={(event) => { event.preventDefault(); navigate(`/products/${product.id}`); }}>VIEW PRODUCT <ArrowRight size={13} /></a>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        </motion.section>

        <motion.section
          className="concern-section section-pad"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.16 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          id="concerns"
        >
          <motion.div className="concern-heading" variants={reveal}>
            <div className="eyebrow"><span className="eyebrow-line" /> START WITH WHAT YOUR SKIN NEEDS</div>
            <h2>Your skin has a story.<br /><em>Find your starting point.</em></h2>
            <p>Explore simple everyday care, one little ritual at a time.</p>
          </motion.div>
          <div className="concern-grid">
            {[
              { title: "A little more hydration", detail: "For skin that feels thirsty or tight.", image: products[0].image, category: "Skincare", tag: "HYDRATION" },
              { title: "A softer daily ritual", detail: "Comforting care for your everyday routine.", image: products[1].image, category: "Skincare", tag: "DAILY CARE" },
              { title: "Care from head to toe", detail: "A moment of nourishment beyond your face.", image: products[3].image, category: "Body care", tag: "BODY CARE" },
            ].map((item) => (
              <motion.article className="concern-card" key={item.tag} variants={reveal} whileHover={{ y: -7 }} transition={{ duration: 0.25 }}>
                <div className="concern-image"><img src={item.image} alt="" loading="lazy" /></div>
                <div className="concern-card-copy">
                  <span>{item.tag}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <button type="button" onClick={() => { setCategory(item.category); document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth" }); }}>
                    EXPLORE PRODUCTS <ArrowRight size={14} />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="ingredient-section"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.18 }}
          transition={{ duration: 0.65, ease: [0.2, 0.65, 0.3, 0.9] }}
          id="ingredients"
        >
          <div className="ingredient-photo"><img src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=85" alt="Skincare serum and botanical-inspired ingredients" loading="lazy" /></div>
          <div className="ingredient-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> A CLOSER LOOK AT THE GOOD STUFF</div>
            <h2>Ingredients with<br /><em>a purpose.</em></h2>
            <p>Get to know a few of the ingredients featured in the Zosmy collection. Simple details, so you can choose with confidence.</p>
            <div className="ingredient-list">
              <div><span>01</span><section><strong>Hyaluronic Acid + Vitamin B5</strong><small>Featured in Dew Drops Serum · A hydration-focused pairing.</small></section></div>
              <div><span>02</span><section><strong>Ceramides + Squalane</strong><small>Featured in Cloud Cream · Made for a comforting skin-care step.</small></section></div>
              <div><span>03</span><section><strong>Mineral SPF 30</strong><small>Featured in Soft Focus · An everyday sun-care essential.</small></section></div>
            </div>
            <a className="text-link" href="#shop">EXPLORE THE COLLECTION <ArrowRight size={15} /></a>
          </div>
        </motion.section>

        <RoutineFinder onAdd={addToBag} onOpen={(product) => navigate(`/products/${product.id}`)} />

        <motion.section
          className="review-section section-pad"
          id="reviews"
          variants={reveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
        >
          <div className="review-intro">
            <div className="eyebrow"><span className="eyebrow-line" /> A NOTE FROM THE COMMUNITY</div>
            <h2>A little love,<br /><em>straight from you.</em></h2>
            <p>
              A little note from someone who made time for their skin.
            </p>
          </div>
          <TestimonialSlider />
        </motion.section>

        <motion.section className="story-section" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }} id="story">
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
        </motion.section>

        <motion.section className="ritual-section section-pad" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }} id="ritual">
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
        </motion.section>

        <motion.section className="newsletter" initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.55, ease: "easeOut" }}>
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
        </motion.section>
          </>
        )}
      </motion.main>

      {!selectedProduct && pathname !== "/account" && (
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
                <div className="drawer-title">
                  <span className="drawer-kicker">GOOD THINGS, GATHERED</span>
                  <h2 id="cart-title">Your bag <span>{cartCount}</span></h2>
                </div>
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
                    <div className="subtotal">
                      <span>Subtotal</span>
                      <strong><NumberFlow value={subtotal} locales="fr-MA" format={{ maximumFractionDigits: 2 }} /> DH</strong>
                    </div>
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
                <motion.div
                  className="order-success"
                  role="status"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <motion.span
                    initial={{ scale: 0.55, rotate: -18 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 16 }}
                  >
                    <motion.svg viewBox="0 0 24 24" aria-hidden="true">
                      <motion.path
                        d="m5 12 4 4L19 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.15, duration: 0.3 }}
                      />
                    </motion.svg>
                  </motion.span>
                  <p>{orderStatus.message}</p>
                  <button className="text-link" onClick={() => { setCheckoutOpen(false); setCartOpen(false); }}>BACK TO THE GOOD STUFF <ArrowRight size={15} /></button>
                </motion.div>
              ) : (
                <form className="checkout-form" onSubmit={submitOrder}>
                  <CustomerFields customer={customer} setCustomer={setCustomer} />
                  <PromoCodeField
                    id="checkout-discount-code"
                    value={couponInput}
                    feedback={couponFeedback}
                    applied={discountCode === "zosmy2027"}
                    onChange={updateCouponInput}
                    onApply={applyCoupon}
                  />
                  <div className="checkout-total">
                    <span>{discountCode ? "Your total after 10% off" : "Your feel-good total"}</span>
                    <strong><NumberFlow value={checkoutTotal} locales="fr-MA" format={{ maximumFractionDigits: 2 }} /> DH</strong>
                  </div>
                  {orderStatus?.type === "error" && <p className="form-message" role="alert">{orderStatus.message}</p>}
                  <button className="button button-dark checkout-button" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                    {isSubmitting ? "SAVING YOUR ORDER..." : "PLACE YOUR ORDER"}
                    <OrderButtonIcon isSubmitting={isSubmitting} />
                  </button>
                  <p className="checkout-disclaimer">Payment isn’t collected online. We’ll contact you to confirm delivery.</p>
                </form>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {guestReceipt && (
          <motion.div
            className="modal-backdrop tracking-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="tracking-receipt"
              role="dialog"
              aria-modal="true"
              aria-labelledby="tracking-receipt-title"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <button
                className="icon-button modal-close"
                type="button"
                onClick={() => setGuestReceipt(null)}
                aria-label="Close order confirmation"
              ><X size={20} /></button>
              <span className="tracking-receipt-check"><Check size={23} /></span>
              <div className="eyebrow"><span className="eyebrow-line" /> ORDER RECEIVED</div>
              <h2 id="tracking-receipt-title">Your order is on its way to us.</h2>
              <p>Save this tracking number to check your order status anytime.</p>
              <code className="tracking-code-display">{guestReceipt.trackingCode}</code>
              <div className="tracking-receipt-actions">
                <button
                  className="tracking-copy-button"
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(guestReceipt.trackingCode);
                      setCopiedTrackingCode(true);
                    } catch (error) {
                      console.error("Could not copy the tracking number.", error);
                    }
                  }}
                >
                  {copiedTrackingCode ? <Check size={15} /> : <Copy size={15} />}
                  {copiedTrackingCode ? "COPIED" : "COPY NUMBER"}
                </button>
                <button
                  className="button button-dark"
                  type="button"
                  onClick={() => openTrackingPage(guestReceipt.trackingCode)}
                >{currentUser ? "VIEW MY ORDERS" : "TRACK ORDER"} <ArrowRight size={15} /></button>
              </div>
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
        <a
          href="/account"
          className={pathname === "/account" ? "mobile-tab active" : "mobile-tab"}
          aria-current={pathname === "/account" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveMobileTab("account");
            navigate("/account");
          }}
        >
          <UserRound size={20} strokeWidth={1.8} />
          <span>Account</span>
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
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (isPaused || isInteracting || items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((index) => (index + 1) % items.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [isPaused, isInteracting, items.length]);

  if (!items.length) return null;

  const activeProduct = items[activeIndex];
  const move = (direction) => {
    setDirection(direction);
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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="popular-slide"
          key={activeProduct.id}
          aria-live="polite"
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragStart={() => setIsInteracting(true)}
          onDragEnd={(_, info) => {
            if (info.offset.x < -55 || info.velocity.x < -450) move(1);
            else if (info.offset.x > 55 || info.velocity.x > 450) move(-1);
            setIsInteracting(false);
          }}
          initial={{ opacity: 0, x: direction * 36 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -28 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <a
            className="popular-image"
            href={`/products/${activeProduct.id}`}
            aria-label={`View ${activeProduct.name}`}
            onClick={(event) => {
              event.preventDefault();
              onOpen(activeProduct);
            }}
            style={{ backgroundColor: activeProduct.tone }}
          >
            <img src={activeProduct.image} alt="" loading="lazy" />
            {activeProduct.badge && <span className="product-badge">{activeProduct.badge}</span>}
          </a>
          <div className="popular-copy">
            <span className="popular-kicker"><Sparkles size={14} /> A CUSTOMER FAVORITE</span>
            <h4>
              <a
                href={`/products/${activeProduct.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(activeProduct);
                }}
              >
                {activeProduct.name}
              </a>
            </h4>
            <p>{activeProduct.description}</p>
            <strong>{formatDirhams(activeProduct.price)}</strong>
            <div className="popular-actions">
              <button type="button" className="button button-dark" onClick={() => onAdd(activeProduct)}>ADD TO BAG <Plus size={15} /></button>
              <button type="button" className="text-link" onClick={() => onOpen(activeProduct)}>EXPLORE <ArrowRight size={14} /></button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="popular-dots" role="group" aria-label="Choose a popular product">
        {items.map((product, index) => (
          <button
            type="button"
            key={product.id}
            className={index === activeIndex ? "popular-dot active" : "popular-dot"}
            aria-label={`Show ${product.name}`}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => {
              setDirection(index >= activeIndex ? 1 : -1);
              setActiveIndex(index);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function RoutineFinder({ onAdd, onOpen }) {
  const [goal, setGoal] = useState("hydration");
  const recommendations = {
    hydration: ["dew-drops", "cloud-cream"],
    everyday: ["soft-focus", "cloud-cream"],
    body: ["body-oil", "lip-balm"],
  };
  const recommendedProducts = recommendations[goal]
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);

  return (
    <motion.section
      className="routine-finder section-pad"
      initial={{ opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.6 }}
      id="routine-finder"
    >
      <div className="routine-finder-heading">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR LITTLE ROUTINE FINDER</div>
        <h2>Not sure where to start?<br /><em>Let's make it simple.</em></h2>
        <p>Choose what you’re looking for and discover a few Zosmy essentials to explore.</p>
      </div>
      <div className="routine-options" role="group" aria-label="Choose your skincare goal">
        {[
          { value: "hydration", label: "More hydration" },
          { value: "everyday", label: "Everyday face care" },
          { value: "body", label: "Body & lip care" },
        ].map((option) => (
          <button type="button" key={option.value} className={goal === option.value ? "routine-option active" : "routine-option"} aria-pressed={goal === option.value} onClick={() => setGoal(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <motion.div className="routine-results" layout>
        <AnimatePresence mode="wait">
          <motion.div className="routine-result-grid" key={goal} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {recommendedProducts.map((product) => (
              <article className="routine-product" key={product.id}>
                <button type="button" className="routine-product-image" onClick={() => onOpen(product)} aria-label={`View ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" /></button>
                <div><strong>{product.name}</strong><span>{formatDirhams(product.price)}</span></div>
                <button type="button" className="routine-add" onClick={() => onAdd(product)}>ADD TO BAG <Plus size={13} /></button>
              </article>
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <p className="routine-disclaimer">A simple product discovery guide, not a medical or dermatological assessment.</p>
    </motion.section>
  );
}

function DropletIcon() {
  return <span className="droplet-icon">◒</span>;
}

function TestimonialSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isInteracting, setIsInteracting] = useState(false);
  const activeTestimonial = testimonials[activeIndex];

  useEffect(() => {
    if (
      isInteracting ||
      testimonials.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return undefined;

    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((index) => (index + 1) % testimonials.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isInteracting]);

  function move(step) {
    setDirection(step);
    setActiveIndex((index) => (index + step + testimonials.length) % testimonials.length);
  }

  function select(index) {
    setDirection(index >= activeIndex ? 1 : -1);
    setActiveIndex(index);
  }

  return (
    <div
      className="testimonial-slider"
      aria-label="Customer testimonials"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
      }}
    >
      <div className="testimonial-slider-header">
        <span className="review-customer-label">KIND WORDS, KEPT CLOSE</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          className={testimonials.length > 1 ? "testimonial-card is-draggable" : "testimonial-card"}
          key={activeTestimonial.id}
          drag={testimonials.length > 1 ? "x" : false}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragStart={() => setIsInteracting(true)}
          onDragEnd={(_, info) => {
            if (info.offset.x < -55 || info.velocity.x < -450) move(1);
            else if (info.offset.x > 55 || info.velocity.x > 450) move(-1);
            setIsInteracting(false);
          }}
          initial={{ x: direction * 80, rotate: direction * 1.8, scale: 0.96 }}
          animate={{ x: 0, rotate: 0, scale: 1 }}
          exit={{ x: direction * -80, rotate: direction * -1.8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.7 }}
        >
          <span className="review-sparkle" aria-hidden="true"><Quote size={22} /></span>
          <blockquote className="review-quote" dir="auto">{activeTestimonial.quote}</blockquote>
          <div className="review-attribution">
            <span className="review-avatar">Z</span>
            <span>{activeTestimonial.author}</span>
          </div>
        </motion.article>
      </AnimatePresence>
      <div className="testimonial-dots" role="group" aria-label="Choose a testimonial">
        {testimonials.map((testimonial, index) => (
          <button
            type="button"
            key={testimonial.id}
            className={index === activeIndex ? "testimonial-dot active" : "testimonial-dot"}
            aria-label={`Show testimonial ${index + 1}`}
            aria-current={index === activeIndex ? "true" : undefined}
            disabled={testimonials.length < 2}
            onClick={() => select(index)}
          />
        ))}
      </div>
    </div>
  );
}

function ProductDetail({
  product,
  quantity,
  setQuantity,
  customer,
  setCustomer,
  couponInput,
  discountCode,
  couponFeedback,
  onCouponInputChange,
  onApplyCoupon,
  orderStatus,
  isSubmitting,
  onSubmit,
  onBack,
}) {
  const subtotal = product.price * quantity;
  const total = calculateOrderTotal(subtotal, discountCode);

  return (
    <section className="product-detail-page section-pad">
      <button className="text-link product-back-link" onClick={onBack}><ArrowRight size={14} /> BACK TO SHOP</button>
      <div className="product-detail-layout">
        <motion.div
          className="product-detail-image"
          style={{ backgroundColor: product.tone }}
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <img src={product.image} alt={product.name} />
          {product.badge && <span className="product-badge">{product.badge}</span>}
          <motion.span
            className="product-image-note"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            A LITTLE MOMENT, JUST FOR YOU
          </motion.span>
        </motion.div>
        <motion.div
          className="product-detail-copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
        >
          <div className="eyebrow"><span className="eyebrow-line" /> {product.category.toUpperCase()}</div>
          <h1>{product.name}</h1>
          <p className="product-detail-description">{product.description}</p>
          <div className="product-detail-rating"><span aria-label="Rated 5 out of 5">★★★★★</span> A LITTLE LOVE FROM OUR COMMUNITY</div>
          <div className="product-buy-card">
            <div className="product-buy-heading">
              <strong className="product-detail-price">{formatDirhams(product.price)}</strong>
              <span>Pay on delivery</span>
            </div>
            <form className="product-order-form" onSubmit={onSubmit}>
              <div className="detail-quantity">
                <span>QUANTITY</span>
                <div className="quantity-control">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Remove one"><Minus size={13} /></button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((value) => Math.min(25, value + 1))} aria-label="Add one" disabled={quantity >= 25}><Plus size={13} /></button>
                </div>
              </div>
              <div className="product-buy-fields">
                <span className="product-fields-title">WHERE SHOULD WE SEND IT?</span>
                <CustomerFields customer={customer} setCustomer={setCustomer} />
              </div>
              <PromoCodeField
                id="product-discount-code"
                value={couponInput}
                feedback={couponFeedback}
                applied={discountCode === "zosmy2027"}
                onChange={onCouponInputChange}
                onApply={onApplyCoupon}
              />
              <div className="checkout-total">
                <span>{discountCode ? "Your total after 10% off" : "Your feel-good total"}</span>
                <strong><NumberFlow value={total} locales="fr-MA" format={{ maximumFractionDigits: 2 }} /> DH</strong>
              </div>
              <AnimatePresence>
                {orderStatus?.type === "success" && (
                  <motion.p
                    className="order-inline-success"
                    role="status"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.25 }}
                  >
                    {orderStatus.message}
                  </motion.p>
                )}
              </AnimatePresence>
              {orderStatus?.type === "error" && <p className="form-message" role="alert">{orderStatus.message}</p>}
              <button className="button button-dark checkout-button" type="submit" disabled={isSubmitting || orderStatus?.type === "success"} aria-busy={isSubmitting}>
                {isSubmitting ? "SAVING YOUR ORDER..." : orderStatus?.type === "success" ? "ORDER RECEIVED" : "ORDER THIS PRODUCT"}
                <OrderButtonIcon isSubmitting={isSubmitting} isComplete={orderStatus?.type === "success"} />
              </button>
              <p className="checkout-disclaimer">No online payment needed. We’ll contact you to confirm delivery.</p>
            </form>
          </div>
          <div className="product-buy-promise"><span><Check size={14} /> Thoughtful ingredients</span><span><Check size={14} /> Delivery confirmation by phone</span></div>
        </motion.div>
      </div>
    </section>
  );
}

function OrderButtonIcon({ isSubmitting, isComplete = false }) {
  if (isSubmitting) {
    return (
      <motion.span
        className="order-button-spinner"
        aria-hidden="true"
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, ease: "linear", repeat: Infinity }}
      />
    );
  }
  if (isComplete) {
    return (
      <motion.span
        className="order-button-complete"
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <Check size={16} aria-hidden="true" />
      </motion.span>
    );
  }
  return <ArrowRight size={15} aria-hidden="true" />;
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

function PromoCodeField({ id, value, feedback, applied, onChange, onApply }) {
  return (
    <div className="promo-code-field">
      <label htmlFor={id}>DISCOUNT CODE</label>
      <div className="promo-code-controls">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onApply();
            }
          }}
          placeholder="Enter discount code"
          autoCapitalize="none"
          autoComplete="off"
          maxLength={40}
        />
        <button type="button" onClick={onApply} disabled={applied}>APPLY</button>
      </div>
      {feedback && (
        <span className={applied ? "promo-feedback applied" : "promo-feedback"} role="status">
          {feedback}
        </span>
      )}
    </div>
  );
}

function formatDirhams(amount) {
  return `${new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(amount)} DH`;
}

export default App;
