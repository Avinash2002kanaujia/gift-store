import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const PRODUCT_CACHE_KEY = "gift-store-products-cache";
const PRODUCT_CACHE_UPDATED_KEY = "gift-store-products-cache-updated-at";
const DUMMY_PRODUCT_NAMES = new Set([
  "elegant ring",
  "soft teddy bear",
  "flower bouquet",
  "chocolate gift box",
  "anniversary watch"
]);

const isDummyProduct = (product) => {
  const name = String(product?.name || "").trim().toLowerCase();
  const isMemoryProduct = String(product?._id || "").startsWith("mem-product-") || String(product?.source || "").toLowerCase() === "memory";
  return isMemoryProduct || DUMMY_PRODUCT_NAMES.has(name);
};

const persistProductsCache = (nextProducts) => {
  try {
    localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(Array.isArray(nextProducts) ? nextProducts : []));
    localStorage.setItem(PRODUCT_CACHE_UPDATED_KEY, String(Date.now()));
    window.dispatchEvent(new Event("gift-store-products-updated"));
  } catch {
    // Ignore local cache write errors.
  }
};

function Admin() {
  const API_BASE = `${process.env.REACT_APP_BACKEND_URL || ""}/api/products`;
  const ORDER_API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/orders`;
  const fileInputRef = useRef(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [preview, setPreview] = useState("");
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [activeView, setActiveView] = useState("products");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusDrafts, setOrderStatusDrafts] = useState({});
  const [savingOrderStatusId, setSavingOrderStatusId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [stats, setStats] = useState({
    totalProducts: 0,
    averagePrice: 0,
    minPrice: 0,
    maxPrice: 0,
    lastUpdatedAt: null
  });

  const trimmedName = name.trim();
  const parsedPrice = Number(price);
  const isNameValid = trimmedName.length >= 2;
  const isPriceValid = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const hasImage = Boolean(image);
  const canSubmit = isNameValid && isPriceValid && hasImage && !isSaving;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorText("");

    try {
      const res = await axios.get(API_BASE);
      const nextProducts = (Array.isArray(res.data) ? res.data : []).filter((product) => !isDummyProduct(product));
      setProducts(nextProducts);
      persistProductsCache(nextProducts);
    } catch (err) {
      setErrorText("Could not load products. Please check backend connection.");
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/stats`);
      setStats(res.data);
    } catch (err) {
      // Non-blocking fallback when stats endpoint is unavailable.
      setStats((prev) => ({ ...prev, lastUpdatedAt: null }));
    }
  }, [API_BASE]);

  const fetchOrders = useCallback(async () => {
    setIsOrdersLoading(true);
    try {
      const res = await axios.get(ORDER_API);
      const nextOrders = Array.isArray(res.data) ? res.data : [];
      setOrders(nextOrders);
      setOrderStatusDrafts(
        nextOrders.reduce((acc, order) => {
          acc[order._id] = order.orderStatus || "Order Placed";
          return acc;
        }, {})
      );
    } catch (err) {
      setOrders([]);
    } finally {
      setIsOrdersLoading(false);
    }
  }, [ORDER_API]);

  useEffect(() => {
    fetchProducts();
    fetchStats();
    fetchOrders();
  }, [fetchProducts, fetchStats, fetchOrders]);

  const updateOrderStatus = async (orderId) => {
    const nextStatus = orderStatusDrafts[orderId];

    if (!nextStatus) {
      return;
    }

    setSavingOrderStatusId(orderId);

    try {
      const res = await axios.put(`/api/orders/${orderId}/status`, { orderStatus: nextStatus });
      const updatedOrder = res.data;

      setOrders((prev) => prev.map((order) => (order._id === orderId ? updatedOrder : order)));
      setOrderStatusDrafts((prev) => ({
        ...prev,
        [orderId]: updatedOrder.orderStatus || nextStatus
      }));
      setStatusText("Order status updated successfully.");
    } catch (err) {
      setErrorText(err?.response?.data?.error || "Failed to update order status.");
    } finally {
      setSavingOrderStatusId("");
    }
  };

  const saveProduct = async () => {
    if (!trimmedName || !price) {
      setErrorText("Please enter product name and price.");
      return;
    }

    if (!isNameValid) {
      setErrorText("Product name must be at least 2 characters.");
      return;
    }

    if (!isPriceValid) {
      setErrorText("Price must be greater than 0.");
      return;
    }

    if (!hasImage) {
      setErrorText("Please upload a product image.");
      return;
    }

    setIsSaving(true);
    setErrorText("");
    setStatusText("");

    try {
      const editingProductId = editingId;
      const payload = {
        name: trimmedName,
        price: parsedPrice,
        image
      };

      let savedProduct;

      if (editingProductId) {
        const res = await axios.put(`${API_BASE}/${editingProductId}`, payload);
        savedProduct = res.data;
      } else {
        const res = await axios.post(API_BASE, payload);
        savedProduct = res.data;
      }

      setProducts((prev) => {
        const nextProducts = editingProductId
          ? prev.map((item) => (item._id === editingProductId ? savedProduct : item))
          : [savedProduct, ...prev.filter((item) => item._id !== savedProduct._id)];
        persistProductsCache(nextProducts);
        return nextProducts;
      });

      setName("");
      setPrice("");
      setImage("");
      setPreview("");
      setEditingId("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setStatusText(editingProductId ? "Product updated successfully." : "Product added successfully.");
      await fetchStats();
    } catch (err) {
      setErrorText(editingId ? "Failed to update product. Please try again." : "Failed to add product. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProduct = async (id) => {
    const shouldDelete = window.confirm("Delete this product?");
    if (!shouldDelete) {
      return;
    }

    setDeletingId(id);
    setErrorText("");
    setStatusText("");

    try {
      await axios.delete(`${API_BASE}/${id}`);
      setProducts((prev) => {
        const nextProducts = prev.filter((item) => item._id !== id);
        persistProductsCache(nextProducts);
        return nextProducts;
      });
      setStatusText("Product deleted successfully.");
      await fetchStats();
    } catch (err) {
      setErrorText("Failed to delete product. Please try again.");
    } finally {
      setDeletingId("");
    }
  };

  const startEdit = (product) => {
    setEditingId(product._id);
    setName(product.name || "");
    setPrice(String(product.price || ""));
    setImage(product.image || "");
    setPreview(product.image || "");
    setErrorText("");
    setStatusText("Editing selected product.");
  };

  const cancelEdit = () => {
    setEditingId("");
    setName("");
    setPrice("");
    setImage("");
    setPreview("");
    setErrorText("");
    setStatusText("Edit cancelled.");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    setImage("");
    setPreview("");
    setEditingId("");
    setErrorText("");
    setStatusText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      setImage("");
      setPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorText("Please upload a valid image file.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorText("Image size must be less than 2MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setImage(dataUrl);
      setPreview(dataUrl);
      setErrorText("");
    };
    reader.readAsDataURL(file);
  };

  const visibleProducts = useMemo(() => {
    const filteredProducts = products.filter((product) =>
      product.name.toLowerCase().includes(searchText.trim().toLowerCase())
    );

    return [...filteredProducts].sort((a, b) => {
      if (sortBy === "price-low") {
        return Number(a.price) - Number(b.price);
      }

      if (sortBy === "price-high") {
        return Number(b.price) - Number(a.price);
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sortBy === "oldest") {
        return a._id.localeCompare(b._id);
      }

      return b._id.localeCompare(a._id);
    });
  }, [products, searchText, sortBy]);

  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    if (!query) {
      return orders;
    }

    return orders.filter((order) => {
      const itemsText = (order.items || [])
        .map((item) => `${item.productName} ${item.productId}`)
        .join(" ")
        .toLowerCase();

      return [
        order._id,
        order.customerName,
        order.email,
        order.contactNumber,
        order.address,
        order.deliveryAddress,
        order.paymentStatus,
        order.paymentMode,
        itemsText
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [orders, orderSearch]);

  const formattedLastUpdated = stats.lastUpdatedAt
    ? new Date(stats.lastUpdatedAt).toLocaleString()
    : "Not available";

  return (
    <div className="admin-page">
      <aside className="admin-form-panel">
        <div className="admin-form-header">
          <h2>{editingId ? "Edit Product" : "Add Product"}</h2>
          <p className="admin-subtext">Upload details on the left and manage inventory on the right.</p>
          <span className={`form-pill ${canSubmit ? "ok" : ""}`}>
            {editingId ? "Edit mode" : canSubmit ? "Ready to add" : "Fill name, price and image"}
          </span>
        </div>

        <div className="field-group">
          <label htmlFor="product-name">Product Name</label>
          <input
            id="product-name"
            placeholder="Ex: Teddy Bear"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          {!isNameValid && trimmedName.length > 0 && (
            <p className="input-hint error">Use at least 2 characters.</p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="product-price">Price (INR)</label>
          <input
            id="product-price"
            type="number"
            min="1"
            step="1"
            placeholder="Ex: 1499"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {!isPriceValid && price !== "" && (
            <p className="input-hint error">Enter a valid price greater than 0.</p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="product-image-file">Product Image</label>
          <input
            id="product-image-file"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="file-input-hidden"
            onChange={handleImage}
          />
          <label htmlFor="product-image-file" className={`upload-box ${preview ? "has-preview" : ""}`}>
            <strong>{preview ? "Change image" : "Click to upload image"}</strong>
            <span>PNG, JPG or WebP up to 2MB</span>
          </label>
        </div>

        {preview && (
          <img
            src={preview}
            alt="Product Preview"
            className="admin-preview"
          />
        )}

        <div className="form-actions">
          <button onClick={saveProduct} disabled={!canSubmit}>
            {isSaving ? (editingId ? "Updating..." : "Adding...") : editingId ? "Update Product" : "Add Product"}
          </button>
          <button className="secondary-btn" onClick={resetForm} disabled={isSaving}>
            Clear
          </button>
        </div>

        {editingId && (
          <button className="secondary-btn cancel-edit-btn" onClick={cancelEdit} disabled={isSaving}>
            Cancel Edit
          </button>
        )}

        {statusText && <p className="status-text ok">{statusText}</p>}
        {errorText && <p className="status-text error">{errorText}</p>}
      </aside>

      <section className="admin-details-panel">
        <div className="admin-view-switch">
          <button
            className={activeView === "products" ? "view-btn active" : "view-btn"}
            onClick={() => setActiveView("products")}
          >
            Products
          </button>
          <button
            className={activeView === "orders" ? "view-btn active" : "view-btn"}
            onClick={() => setActiveView("orders")}
          >
            Orders
          </button>
          <button className="secondary-btn view-refresh-btn" onClick={fetchOrders}>Refresh Orders</button>
        </div>

        {activeView === "products" && (
          <>
        <div className="admin-details-header">
          <h2>Product Details</h2>
          <span>{visibleProducts.length} shown</span>
        </div>

        <div className="admin-stats">
          <div className="stat-card">
            <p>Total Products</p>
            <h3>{visibleProducts.length}</h3>
          </div>
          <div className="stat-card">
            <p>Average Price</p>
            <h3>₹{stats.averagePrice}</h3>
          </div>
          <div className="stat-card">
            <p>Price Range</p>
            <h3>₹{stats.minPrice} - ₹{stats.maxPrice}</h3>
          </div>
        </div>

        <p className="admin-meta">Last inventory update: {formattedLastUpdated}</p>

        <div className="admin-controls">
          <input
            className="admin-search"
            placeholder="Search by product name"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select className="admin-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name: A-Z</option>
          </select>
        </div>

        {isLoading && <p className="admin-empty">Loading products...</p>}

        {!isLoading && visibleProducts.length === 0 ? (
          <p className="admin-empty">
            {products.length === 0
              ? "No products yet. Add one from the left panel."
              : "No products match your search."}
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <img
                        src={p.image || "/logo192.png"}
                        alt={p.name}
                        className="admin-thumb"
                      />
                    </td>
                    <td>{p.name}</td>
                    <td>₹{p.price}</td>
                    <td>
                      <button
                        className="edit-btn"
                        onClick={() => startEdit(p)}
                        disabled={deletingId === p._id}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => deleteProduct(p._id)}
                        disabled={deletingId === p._id}
                      >
                        {deletingId === p._id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}

        {activeView === "orders" && (
        <div className="admin-orders-section">
          <div className="admin-details-header">
            <h2>Customer Orders</h2>
            <div className="orders-header-actions">
              <span>{orders.length} orders</span>
            </div>
          </div>

          <div className="admin-controls">
            <input
              className="admin-search"
              placeholder="Search by customer, email, order id, or product"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
          </div>

          {isOrdersLoading ? (
            <p className="admin-empty">Loading orders...</p>
          ) : visibleOrders.length === 0 ? (
            <p className="admin-empty">No orders yet.</p>
          ) : (
            <div className="orders-grid">
              {visibleOrders.map((order) => (
                <article className="order-card" key={order._id}>
                  <div className="order-card-head">
                    <div>
                      <p className="order-label">Order ID</p>
                      <h3>{order._id}</h3>
                    </div>
                    <div className="order-status-stack">
                      <span className={`payment-pill ${String(order.paymentStatus || "").toLowerCase()}`}>
                        {order.paymentStatus}
                      </span>
                      <span className={`order-status-pill ${String(order.orderStatus || "Order Placed").toLowerCase().replace(/\s+/g, "-")}`}>
                        {order.orderStatus || "Order Placed"}
                      </span>
                    </div>
                  </div>

                  <div className="order-meta-grid">
                    <div>
                      <p className="order-label">Customer</p>
                      <strong>{order.customerName}</strong>
                    </div>
                    <div>
                      <p className="order-label">Email</p>
                      <strong>{order.email}</strong>
                    </div>
                    <div>
                      <p className="order-label">Contact</p>
                      <strong>{order.contactNumber}</strong>
                    </div>
                    <div>
                      <p className="order-label">Payment Mode</p>
                      <strong>{order.paymentMode}</strong>
                    </div>
                    <div>
                      <p className="order-label">Total Payment</p>
                      <strong>₹{order.totalPayment}</strong>
                    </div>
                  </div>

                  <div className="order-address-block">
                    <p className="order-label">Address</p>
                    <p>{order.address}</p>
                    <p className="order-label">Delivery Address</p>
                    <p>{order.deliveryAddress}</p>
                  </div>

                  <div className="order-status-controls">
                    <label>Order Status</label>
                    <div className="order-status-row">
                      <select
                        className="admin-sort"
                        value={orderStatusDrafts[order._id] || order.orderStatus || "Order Placed"}
                        onChange={(e) =>
                          setOrderStatusDrafts((prev) => ({
                            ...prev,
                            [order._id]: e.target.value
                          }))
                        }
                      >
                        <option value="Order Placed">Order Placed</option>
                        <option value="Order Packed">Order Packed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                      </select>

                      <button
                        className="secondary-btn"
                        onClick={() => updateOrderStatus(order._id)}
                        disabled={savingOrderStatusId === order._id}
                      >
                        {savingOrderStatusId === order._id ? "Saving..." : "Update Status"}
                      </button>
                    </div>
                  </div>

                  <div className="order-items-wrap">
                    <p className="order-label">Product Details</p>
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Product ID</th>
                            <th>Qty</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((item, idx) => (
                            <tr key={`${order._id}-${item.productId}-${idx}`}>
                              <td>{item.productName}</td>
                              <td>{item.productId}</td>
                              <td>{item.quantity}</td>
                              <td>₹{item.lineTotal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        )}
      </section>
    </div>
  );
}

export default Admin;