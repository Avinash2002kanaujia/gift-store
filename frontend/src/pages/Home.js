import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const PRODUCT_CACHE_KEY = "gift-store-products-cache";
const PRODUCT_CACHE_UPDATED_KEY = "gift-store-products-cache-updated-at";

const TESTIMONIALS = [
  {
    id: "t-1",
    name: "Riya Sharma",
    role: "Customer",
    location: "Jaipur",
    rating: 5,
    quote: "The checkout was smooth and the order status updates were very clear. Loved the overall experience."
  },
  {
    id: "t-2",
    name: "Aman Verma",
    role: "Customer",
    location: "Delhi",
    rating: 5,
    quote: "I found the perfect bouquet quickly. Delivery updates from placed to delivered were accurate and helpful."
  },
  {
    id: "t-3",
    name: "Neha Singh",
    role: "Regular Buyer",
    location: "Lucknow",
    rating: 4,
    quote: "The product quality is great and the support team responds fast. I keep coming back for special occasions."
  }
];

const DUMMY_PRODUCT_NAMES = new Set([
  "elegant ring",
  "soft teddy bear",
  "flower bouquet",
  "chocolate gift box",
  "anniversary watch"
]);

const OCCASION_FILTERS = [
  { id: "birthday", label: "Birthday", query: "gift birthday" },
  { id: "anniversary", label: "Anniversary", query: "ring watch" },
  { id: "surprise", label: "Just Because", query: "teddy flower" },
  { id: "premium", label: "Premium", query: "set watch ring" }
];

const ringImage = "/logo192.png";
const teddyImage = "/logo512.png";

const getProductImage = (name = "") => {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.includes("teddy") || normalizedName.includes("taddy")) {
    return teddyImage;
  }

  return ringImage;
};

const guessCategory = (name = "") => {
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName.includes("ring") || normalizedName.includes("jewel")) {
    return "Accessories";
  }
  if (normalizedName.includes("teddy") || normalizedName.includes("taddy") || normalizedName.includes("toy")) {
    return "Soft Toys";
  }
  if (normalizedName.includes("watch")) {
    return "Watches";
  }
  if (normalizedName.includes("cake") || normalizedName.includes("choco") || normalizedName.includes("sweet")) {
    return "Sweets";
  }
  if (normalizedName.includes("rose") || normalizedName.includes("flower")) {
    return "Flowers";
  }

  return "Gifts";
};

const normalizeProduct = (product) => ({
  ...product,
  _id: product._id || `product-${product.name}-${product.price}`,
  category: product.category || guessCategory(product.name),
  image: product.image || getProductImage(product.name),
  description: product.description || "A thoughtful gift for every special moment."
});

const mergeProductLists = (apiProducts, cachedProducts) => {
  const byKey = new Map();

  [...cachedProducts, ...apiProducts].forEach((item) => {
    const key = item?._id || `${String(item?.name || "").toLowerCase()}-${String(item?.price || "")}`;
    if (key) {
      byKey.set(key, item);
    }
  });

  return Array.from(byKey.values());
};

function Home({ cart, setCart }) {
  const API_BASE = "/api/products";

  const readCachedProducts = () => {
    try {
      const raw = localStorage.getItem(PRODUCT_CACHE_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeCachedProducts = (products) => {
    try {
      localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(products));
    } catch {
      // Ignore storage write failures.
    }
  };

  const [apiProducts, setApiProducts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [priceFilter, setPriceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [isLoading, setIsLoading] = useState(true);
  const [toastText, setToastText] = useState("");

  const fetchProducts = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const res = await axios.get(API_BASE, { params: { _t: Date.now() } });
        const fromApi = Array.isArray(res.data) ? res.data : [];
        const cached = readCachedProducts();
        const source = fromApi.length > 0 ? mergeProductLists(fromApi, cached) : cached;
        const normalized = source.map(normalizeProduct);
        setApiProducts(normalized);
        writeCachedProducts(source);
      } catch {
        const cached = readCachedProducts();
        setApiProducts(cached.map(normalizeProduct));
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [API_BASE]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const onProductsUpdated = () => fetchProducts({ silent: true });
    const onStorage = (event) => {
      if (event.key === PRODUCT_CACHE_KEY || event.key === PRODUCT_CACHE_UPDATED_KEY) {
        onProductsUpdated();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onProductsUpdated();
      }
    };

    window.addEventListener("gift-store-products-updated", onProductsUpdated);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("gift-store-products-updated", onProductsUpdated);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchProducts]);

  const databaseProducts = useMemo(() => {
    return apiProducts.filter((product) => {
      const name = String(product.name || "").trim().toLowerCase();
      const isMemoryProduct = String(product.source || "").toLowerCase() === "memory" || String(product._id || "").startsWith("mem-product-");

      return !isMemoryProduct && !DUMMY_PRODUCT_NAMES.has(name);
    });
  }, [apiProducts]);

  const categories = useMemo(() => {
    const set = new Set(databaseProducts.map((product) => product.category));
    return ["All", ...Array.from(set)];
  }, [databaseProducts]);

  const filteredProducts = useMemo(() => {
    let next = [...databaseProducts];

    if (activeCategory !== "All") {
      next = next.filter((product) => product.category === activeCategory);
    }

    if (priceFilter === "under-500") {
      next = next.filter((product) => Number(product.price) < 500);
    } else if (priceFilter === "500-1500") {
      next = next.filter((product) => Number(product.price) >= 500 && Number(product.price) <= 1500);
    } else if (priceFilter === "above-1500") {
      next = next.filter((product) => Number(product.price) > 1500);
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      next = next.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q) ||
          (product.description || "").toLowerCase().includes(q)
      );
    }

    if (sortBy === "price-low") {
      next.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === "price-high") {
      next.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === "name") {
      next.sort((a, b) => a.name.localeCompare(b.name));
    }

    return next;
  }, [databaseProducts, activeCategory, priceFilter, searchText, sortBy]);

  useEffect(() => {
    if (!toastText) {
      return undefined;
    }

    const timer = setTimeout(() => setToastText(""), 1600);
    return () => clearTimeout(timer);
  }, [toastText]);

  const clearFilters = () => {
    setActiveCategory("All");
    setSearchText("");
    setPriceFilter("all");
    setSortBy("featured");
  };

  const addToCart = (product) => {
    setCart((prev) => [...prev, product]);
    setToastText(`${product.name} added to cart`);
  };

  const shouldShowEmptyState = !isLoading && filteredProducts.length === 0;
  const loadingPlaceholders = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  const averageRating = useMemo(() => {
    const total = TESTIMONIALS.reduce((sum, item) => sum + item.rating, 0);
    return (total / TESTIMONIALS.length).toFixed(1);
  }, []);

  const heroShowcaseProducts = useMemo(() => {
    return [...databaseProducts]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 3);
  }, [databaseProducts]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeCategory !== "All") count += 1;
    if (priceFilter !== "all") count += 1;
    if (sortBy !== "featured") count += 1;
    if (searchText.trim()) count += 1;
    return count;
  }, [activeCategory, priceFilter, sortBy, searchText]);

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const applyOccasionFilter = (query) => {
    setActiveCategory("All");
    setPriceFilter("all");
    setSortBy("featured");
    setSearchText(query);
    scrollToSection("products");
  };

  return (
    <div className="home-page">
      <div className="hero">
        <div className="hero-layout">
          <div className="hero-content">
            <p className="hero-kicker">Curated Moments</p>
            <div className="hero-announcement" role="status">
              <strong>{averageRating}/5 Rated</strong>
              <span>by {TESTIMONIALS.length}+ happy buyers</span>
            </div>
            <h1>Gifts that feel personal, not predictable</h1>
            <p>Find thoughtful picks for birthdays, anniversaries and everyday surprises.</p>
            <div className="hero-actions">
              <button type="button" className="hero-primary-btn" onClick={() => scrollToSection("products")}>Shop Now</button>
              <button type="button" className="hero-secondary-btn" onClick={() => scrollToSection("about")}>Why Gift Store</button>
            </div>

            <div className="hero-occasion-row" role="list" aria-label="Shop by occasion">
              {OCCASION_FILTERS.map((occasion) => (
                <button
                  key={occasion.id}
                  type="button"
                  className="hero-occasion-chip"
                  role="listitem"
                  onClick={() => applyOccasionFilter(occasion.query)}
                >
                  {occasion.label}
                </button>
              ))}
            </div>

            <div className="hero-stats">
              <div>
                <strong>{databaseProducts.length}+</strong>
                <span>Gift Options</span>
              </div>
              <div>
                <strong>{categories.length - 1}</strong>
                <span>Categories</span>
              </div>
              <div>
                <strong>{cart.length}</strong>
                <span>In Cart</span>
              </div>
            </div>

            <div className="hero-highlights" role="list" aria-label="Shopping highlights">
              <span role="listitem">Free shipping above ₹599</span>
              <span role="listitem">Secure checkout and payments</span>
              <span role="listitem">Track order status live</span>
            </div>

            <div className="hero-trust-row" role="list" aria-label="Service trust points">
              <p role="listitem">Fast support response</p>
              <p role="listitem">Transparent pricing</p>
              <p role="listitem">Reliable order updates</p>
            </div>
          </div>

          <div className="hero-showcase" aria-label="Featured gift images">
            <p className="hero-showcase-title">Featured Picks</p>
            {heroShowcaseProducts.length > 0 ? (
              heroShowcaseProducts.map((product, index) => (
                <article
                  key={product._id}
                  className={`hero-image-card hero-image-card-${index + 1}`}
                >
                  <img src={product.image || getProductImage(product.name)} alt={product.name} />
                  <div className="hero-image-meta">
                    <p>{product.name}</p>
                    <span>₹{product.price}</span>
                  </div>
                  <span className="hero-image-badge">{product.category || guessCategory(product.name)}</span>
                </article>
              ))
            ) : (
              <article className="hero-showcase-empty">
                <h3>No manual products yet</h3>
                <p>Add products from Admin panel and they will appear here.</p>
              </article>
            )}
          </div>
        </div>
      </div>

      <div id="products" className="container products">
        <div className="section-title-row">
          <div>
            <p className="section-kicker">Browse Collections</p>
            <h2 className="section-title">Popular Gifts</h2>
          </div>
          <div className="products-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                clearFilters();
                fetchProducts();
              }}
            >
              Refresh Products
            </button>
            {activeFilterCount > 0 && (
              <button type="button" className="filters-clear-btn" onClick={clearFilters}>
                Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>

        <p className="products-intro">
          Handpicked gifts from your admin inventory. Use search, category, price and sort controls to refine what you see.
        </p>

        <div className="gift-tools">
          <input
            className="gift-search"
            placeholder="Search gifts by name, category or keyword"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select className="gift-select" value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)}>
            <option value="all">All Prices</option>
            <option value="under-500">Below ₹500</option>
            <option value="500-1500">₹500 to ₹1500</option>
            <option value="above-1500">Above ₹1500</option>
          </select>

          <select className="gift-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>

        <div className="category-section">
          <h3>Categories</h3>
          <div className="category-row">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-chip ${activeCategory === category ? "active" : ""}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <p className="gift-meta">
          {isLoading
            ? "Loading gifts..."
            : `${filteredProducts.length} gifts found${activeFilterCount > 0 ? ` • ${activeFilterCount} filters active` : ""}`}
        </p>

        {isLoading ? (
          <div className="grid loading-grid" aria-label="Loading gift products">
            {loadingPlaceholders.map((item) => (
              <div className="card loading-card" key={`loading-${item}`}>
                <div className="loading-media shimmer" />
                <div className="loading-line shimmer" />
                <div className="loading-line short shimmer" />
                <div className="loading-price shimmer" />
                <div className="loading-button shimmer" />
              </div>
            ))}
          </div>
        ) : shouldShowEmptyState ? (
          <div className="gift-empty-state">
            <h3>No gifts matched your filters</h3>
            <p>Try a different category or remove filters to view all gift options.</p>
            <button onClick={clearFilters}>Clear All Filters</button>
          </div>
        ) : (
          <div className="grid">
            {filteredProducts.map((p) => (
              <div className="card" key={p._id}>
                <img src={p.image || getProductImage(p.name)} alt={p.name} />
                <span className="gift-category">{p.category}</span>
                <h3>{p.name}</h3>
                <p className="gift-description">{p.description}</p>
                <p className="gift-price">₹{p.price}</p>

                <button onClick={() => addToCart(p)}>Add to Cart</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <section id="about" className="info-page-wrap">
        <div className="info-page-hero">
          <p className="info-kicker">About Us</p>
          <h2>About Gift Store</h2>
          <p>
            Gift Store was built to make gifting simple and meaningful. We curate quality products for birthdays,
            anniversaries, celebrations, and everyday surprises.
          </p>
          <div className="info-quick-stats" role="list" aria-label="Gift Store highlights">
            <div role="listitem">
              <strong>24x7</strong>
              <span>Order Support</span>
            </div>
            <div role="listitem">
              <strong>100%</strong>
              <span>Secure Checkout</span>
            </div>
            <div role="listitem">
              <strong>Fast</strong>
              <span>Status Updates</span>
            </div>
          </div>
        </div>

        <div className="info-grid">
          <article className="info-card">
            <h3>Our Mission</h3>
            <p>Help people send thoughtful gifts quickly with a smooth and reliable shopping experience.</p>
          </article>

          <article className="info-card">
            <h3>What We Offer</h3>
            <p>Curated products, transparent pricing, easy checkout, and real-time order status updates.</p>
          </article>

          <article className="info-card">
            <h3>Why Customers Choose Us</h3>
            <p>Simple interface, dependable service, and a customer-first approach from cart to delivery.</p>
          </article>
        </div>

        <div className="about-trust-strip" role="list" aria-label="Trust points">
          <div className="about-pill" role="listitem">Handpicked gift quality</div>
          <div className="about-pill" role="listitem">Transparent pricing and tax</div>
          <div className="about-pill" role="listitem">Live order lifecycle tracking</div>
          <div className="about-pill" role="listitem">Friendly support team</div>
        </div>
      </section>

      <section id="testimonials" className="info-page-wrap">
        <div className="info-page-hero">
          <p className="info-kicker">Testimonials</p>
          <h2>Testimonials</h2>
          <p>
            What our customers say about shopping and ordering from Gift Store. Rated {averageRating}/5 by our
            recent buyers.
          </p>
        </div>

        <div className="testimonial-grid">
          {TESTIMONIALS.map((item) => (
            <article key={item.id} className="testimonial-card">
              <div className="testimonial-top-row">
                <span className="testimonial-stars" aria-label={`${item.rating} out of 5 stars`}>
                  {"★".repeat(item.rating)}
                  {"☆".repeat(5 - item.rating)}
                </span>
                <span className="testimonial-location">{item.location}</span>
              </div>
              <p className="testimonial-quote">"{item.quote}"</p>
              <div className="testimonial-author-row">
                <span className="testimonial-avatar" aria-hidden="true">
                  {item.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <p className="testimonial-name">{item.name}</p>
                  <p className="testimonial-role">{item.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {toastText && <div className="gift-toast">{toastText}</div>}
    </div>
  );
}

export default Home;