import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const getItemKey = (item) => item._id || `${item.name}-${item.price}`;

function Cart({ cart, setCart, user = null }) {
  const ORDER_API = "/api/orders";
  const [showPayment, setShowPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    setCheckoutError("");

    setCustomerName(user.name || "");
    setEmail(user.email || "");
    setContactNumber(user.contactNumber || "");
    setAddress(user.address || "");
    setDeliveryAddress(user.address || "");
  }, [user]);

  const groupedItems = useMemo(() => {
    const map = new Map();

    cart.forEach((item) => {
      const key = getItemKey(item);
      const price = Number(item.price || 0);

      if (!map.has(key)) {
        map.set(key, {
          key,
          product: item,
          name: item.name,
          price,
          image: item.image || "/logo192.png",
          qty: 0,
          lineTotal: 0
        });
      }

      const current = map.get(key);
      current.qty += 1;
      current.lineTotal += price;
    });

    return Array.from(map.values());
  }, [cart]);

  const itemCount = groupedItems.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = groupedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = subtotal === 0 || subtotal >= 599 ? 0 : 99;
  const taxableBillAmount = subtotal + shipping;
  const tax = Math.round(taxableBillAmount * 0.05);
  const grandTotal = taxableBillAmount + tax;
  const freeShippingGoal = 599;
  const freeShippingRemaining = Math.max(0, freeShippingGoal - subtotal);
  const shippingProgress = Math.min(100, Math.round((subtotal / freeShippingGoal) * 100));

  const addOne = (product) => {
    setCart((prev) => [...prev, product]);
  };

  const removeOne = (key) => {
    setCart((prev) => {
      const index = prev.findIndex((item) => getItemKey(item) === key);
      if (index === -1) {
        return prev;
      }

      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const removeItem = (key) => {
    setCart((prev) => prev.filter((item) => getItemKey(item) !== key));
  };

  const clearCart = () => {
    if (cart.length === 0) {
      return;
    }

    const shouldClear = window.confirm("Clear all items from your cart?");
    if (shouldClear) {
      setCart([]);
    }
  };

  const resetPaymentForm = () => {
    setCustomerName("");
    setEmail("");
    setContactNumber("");
    setAddress("");
    setDeliveryAddress("");
    setPaymentMethod("upi");
    setUpiId("");
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setPaymentError("");
    setPaymentDone(false);
    setIsPaying(false);
  };

  const openPayment = () => {
    if (groupedItems.length === 0) {
      return;
    }

    if (!user) {
      setCheckoutError("Login first to place your order.");
      return;
    }

    resetPaymentForm();
    setCheckoutError("");
    setShowPayment(true);
  };

  const closePayment = () => {
    if (isPaying) {
      return;
    }
    setShowPayment(false);
  };

  const validatePayment = () => {
    if (customerName.trim().length < 2) {
      return "Enter customer name.";
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      return "Enter a valid email address.";
    }

    const phoneOk = /^[0-9+\-()\s]{7,20}$/.test(contactNumber.trim());
    if (!phoneOk) {
      return "Enter a valid contact number.";
    }

    if (!address.trim()) {
      return "Enter address.";
    }

    if (!deliveryAddress.trim()) {
      return "Enter delivery address.";
    }

    if (paymentMethod === "upi") {
      const validUpi = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim());
      if (!validUpi) {
        return "Enter a valid UPI ID, example: name@bank";
      }
      return "";
    }

    if (cardName.trim().length < 2) {
      return "Enter card holder name.";
    }

    const cleanCard = cardNumber.replace(/\s+/g, "");
    if (!/^\d{16}$/.test(cleanCard)) {
      return "Card number should be 16 digits.";
    }

    if (!/^(0[1-9]|1[0-2])\/(\d{2})$/.test(cardExpiry)) {
      return "Expiry should be in MM/YY format.";
    }

    if (!/^\d{3}$/.test(cardCvv)) {
      return "CVV should be 3 digits.";
    }

    return "";
  };

  const payNow = async () => {
    if (!user) {
      setPaymentError("Login first to place your order.");
      return;
    }

    const message = validatePayment();
    if (message) {
      setPaymentError(message);
      return;
    }

    setPaymentError("");
    setIsPaying(true);

    const payload = {
      customerName: customerName.trim(),
      email: email.trim().toLowerCase(),
      contactNumber: contactNumber.trim(),
      address: address.trim(),
      deliveryAddress: deliveryAddress.trim(),
      items: groupedItems.map((item) => ({
        productId: String(item.product?._id || item.key),
        productName: item.name,
        quantity: item.qty,
        unitPrice: item.price,
        lineTotal: item.lineTotal
      })),
      subtotal,
      tax,
      shipping,
      totalPayment: grandTotal,
      orderStatus: "Order Placed",
      paymentStatus: "Paid",
      paymentMode: paymentMethod === "upi" ? "UPI" : "Card"
    };

    try {
      await axios.post(ORDER_API, payload);
      await new Promise((resolve) => setTimeout(resolve, 700));
      setIsPaying(false);
      setPaymentDone(true);
      setCart([]);
    } catch (err) {
      setIsPaying(false);
      setPaymentError(err?.response?.data?.error || "Failed to place order. Please try again.");
    }
  };

  return (
    <div className="cart-page">
      <section className="cart-main">
        <div className="cart-header">
          <div>
            <h2>Your Cart</h2>
            <p>{itemCount} item{itemCount === 1 ? "" : "s"} added</p>
          </div>
          <Link to="/" className="cart-shop-link">Continue Shopping</Link>
        </div>

        {groupedItems.length === 0 ? (
          <div className="cart-empty">
            <h3>Your cart is empty</h3>
            <p>Add products from the home page to see them here.</p>
            <Link to="/" className="cart-shop-link">Browse Products</Link>
          </div>
        ) : (
          <div className="cart-items">
            {groupedItems.map((item) => (
              <article className="cart-item-card" key={item.key}>
                <img className="cart-item-image" src={item.image} alt={item.name} />

                <div className="cart-item-body">
                  <div className="cart-item-meta">
                    <h3>{item.name}</h3>
                    <p>₹{item.price} each</p>
                    <button className="text-btn" onClick={() => removeItem(item.key)}>
                      Remove item
                    </button>
                  </div>

                  <div className="cart-item-actions">
                    <div className="qty-control">
                      <button onClick={() => removeOne(item.key)}>-</button>
                      <span>{item.qty}</span>
                      <button onClick={() => addOne(item.product)}>+</button>
                    </div>
                    <strong>₹{item.lineTotal}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="cart-summary">
        <h3>Order Summary</h3>

        <div className="summary-row">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="summary-row">
          <span>Tax (5%)</span>
          <span>₹{tax}</span>
        </div>
        <div className="summary-row">
          <span>Shipping</span>
          <span>{shipping === 0 ? "Free" : `₹${shipping}`}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>₹{grandTotal}</span>
        </div>

        <div className="shipping-progress-wrap">
          <div className="shipping-progress-label">
            <span>Free Shipping Progress</span>
            <strong>{shippingProgress}%</strong>
          </div>
          <div className="shipping-progress-track" role="progressbar" aria-valuenow={shippingProgress} aria-valuemin="0" aria-valuemax="100">
            <span className="shipping-progress-fill" style={{ width: `${shippingProgress}%` }} />
          </div>
          <p className="shipping-progress-note">
            {freeShippingRemaining === 0
              ? "You unlocked free shipping."
              : `Add ₹${freeShippingRemaining} more for free shipping.`}
          </p>
        </div>

        <button className="checkout-btn" disabled={groupedItems.length === 0} onClick={openPayment}>
          Proceed to Checkout
        </button>
        {checkoutError && (
          <p className="checkout-error">
            {checkoutError} <Link to="/auth">Go to Login / Sign Up</Link>
          </p>
        )}
        <button className="secondary-btn cart-clear-btn" onClick={clearCart} disabled={groupedItems.length === 0}>
          Clear Cart
        </button>

        <p className="cart-note">Free shipping for orders above ₹599.</p>
      </aside>

      {showPayment && (
        <div className="payment-overlay" onClick={closePayment}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-header">
              <h3>Mock Payment Gateway</h3>
              <button className="payment-close" onClick={closePayment}>x</button>
            </div>

            {paymentDone ? (
              <div className="payment-success">
                <h4>Payment Successful</h4>
                <p>Your order was placed successfully.</p>
                <button onClick={closePayment}>Done</button>
              </div>
            ) : (
              <>
                <p className="payment-total">Payable Amount: ₹{grandTotal}</p>

                <div className="payment-fields">
                  <label>Customer Name</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full name"
                  />

                  <label>Email ID</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />

                  <label>Contact Number</label>
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="9876543210"
                  />

                  <label>Address</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Billing address"
                  />

                  <label>Delivery Address</label>
                  <input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Delivery address"
                  />
                </div>

                <div className="payment-methods">
                  <button
                    className={paymentMethod === "upi" ? "pay-method active" : "pay-method"}
                    onClick={() => setPaymentMethod("upi")}
                  >
                    UPI
                  </button>
                  <button
                    className={paymentMethod === "card" ? "pay-method active" : "pay-method"}
                    onClick={() => setPaymentMethod("card")}
                  >
                    Card
                  </button>
                </div>

                {paymentMethod === "upi" ? (
                  <div className="payment-fields">
                    <label>UPI ID</label>
                    <input
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@bank"
                    />
                  </div>
                ) : (
                  <div className="payment-fields">
                    <label>Card Holder Name</label>
                    <input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Name on card"
                    />

                    <label>Card Number</label>
                    <input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="1234 5678 9012 3456"
                    />

                    <div className="payment-split">
                      <div>
                        <label>Expiry</label>
                        <input
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                        />
                      </div>
                      <div>
                        <label>CVV</label>
                        <input
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentError && <p className="payment-error">{paymentError}</p>}

                <button className="payment-submit" onClick={payNow} disabled={isPaying}>
                  {isPaying ? "Processing..." : "Pay Now"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;