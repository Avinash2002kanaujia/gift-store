import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { clearCurrentUser, updateCurrentUserProfile } from "../utils/authStorage";

function Account({ user, setUser }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", contactNumber: "", address: "" });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  useEffect(() => {
    if (!user?.email) {
      return;
    }

    setIsLoading(true);
    setErrorText("");

    axios
      .get(`/api/orders?email=${encodeURIComponent(user.email)}`)
      .then((res) => {
        setOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setOrders([]);
        setErrorText("Unable to load your orders right now.");
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  const orderCount = orders.length;
  const latestStatus = orders[0]?.orderStatus || "No orders yet";

  const groupedOrders = useMemo(() => orders, [orders]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      name: user.name || "",
      contactNumber: user.contactNumber || "",
      address: user.address || ""
    });
  }, [user]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card-center">
          <p className="auth-kicker">My Orders</p>
          <h1>Login required</h1>
          <p>Please login first to see your profile details and order statuses.</p>
          <Link to="/login" className="auth-link-button">Go to Login</Link>
        </div>
      </div>
    );
  }

  const logout = () => {
    clearCurrentUser();
    setUser(null);
    navigate("/");
  };

  const onProfileChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const name = String(profileForm.name || "").trim();
    const contactNumber = String(profileForm.contactNumber || "").trim();
    const address = String(profileForm.address || "").trim();

    if (name.length < 2) {
      setProfileError("Name must be at least 2 characters.");
      return;
    }

    if (!/^[0-9+\-()\s]{7,20}$/.test(contactNumber)) {
      setProfileError("Enter a valid contact number.");
      return;
    }

    if (address.length < 6) {
      setProfileError("Address must be at least 6 characters.");
      return;
    }

    const result = updateCurrentUserProfile({ name, contactNumber, address });
    if (!result.ok) {
      setProfileError(result.error || "Unable to update profile right now.");
      return;
    }

    setUser(result.user);
    setProfileSuccess("Profile updated successfully.");
    setIsEditingProfile(false);
  };

  return (
    <div className="account-page">
      <section className="account-hero">
        <div>
          <p className="auth-kicker">Customer Dashboard</p>
          <h1>Welcome, {user.name}</h1>
          <p>Track your order placed status, packing updates, shipment progress, and delivery.</p>
        </div>
        <div className="account-actions">
          <button
            type="button"
            className="secondary-btn account-edit-btn"
            aria-label="Edit your profile details"
            onClick={() => {
              setIsEditingProfile((prev) => !prev);
              setProfileError("");
              setProfileSuccess("");
            }}
          >
            {isEditingProfile ? "Close Profile Editor" : "Edit Profile Details"}
          </button>
          <button className="secondary-btn" onClick={logout}>Logout</button>
        </div>
      </section>

      <div className="account-grid">
        <aside className="account-profile-card">
          <h2>Your Details</h2>
          <div className="profile-row"><span>Name</span><strong>{user.name}</strong></div>
          <div className="profile-row"><span>Email</span><strong>{user.email}</strong></div>
          <div className="profile-row"><span>Contact</span><strong>{user.contactNumber}</strong></div>
          <div className="profile-row"><span>Address</span><strong>{user.address}</strong></div>
          <div className="profile-row"><span>Orders</span><strong>{orderCount}</strong></div>
          <div className="profile-row"><span>Latest Status</span><strong>{latestStatus}</strong></div>

          {isEditingProfile && (
            <form className="account-edit-form" onSubmit={saveProfile}>
              <h3>Update Profile</h3>

              <label htmlFor="account-name">Name</label>
              <input
                id="account-name"
                type="text"
                value={profileForm.name}
                onChange={(e) => onProfileChange("name", e.target.value)}
                required
              />

              <label htmlFor="account-contact">Contact Number</label>
              <input
                id="account-contact"
                type="text"
                value={profileForm.contactNumber}
                onChange={(e) => onProfileChange("contactNumber", e.target.value)}
                required
              />

              <label htmlFor="account-address">Address</label>
              <input
                id="account-address"
                type="text"
                value={profileForm.address}
                onChange={(e) => onProfileChange("address", e.target.value)}
                required
              />

              <div className="account-edit-actions">
                <button type="submit">Save Changes</button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setProfileForm({
                      name: user.name || "",
                      contactNumber: user.contactNumber || "",
                      address: user.address || ""
                    });
                    setProfileError("");
                    setProfileSuccess("");
                    setIsEditingProfile(false);
                  }}
                >
                  Cancel
                </button>
              </div>

              {profileError && <p className="status-text error">{profileError}</p>}
            </form>
          )}

          {profileSuccess && <p className="status-text ok">{profileSuccess}</p>}
        </aside>

        <section className="account-orders-card">
          <div className="account-section-head">
            <h2>Your Orders</h2>
            <button className="secondary-btn" onClick={() => navigate(0)}>Refresh</button>
          </div>

          {isLoading ? (
            <p className="admin-empty">Loading your orders...</p>
          ) : errorText ? (
            <p className="admin-empty">{errorText}</p>
          ) : groupedOrders.length === 0 ? (
            <div className="cart-empty">
              <h3>No orders placed yet</h3>
              <p>Place your first order to see its status here.</p>
              <Link to="/" className="cart-shop-link">Shop Now</Link>
            </div>
          ) : (
            <div className="account-order-list">
              {groupedOrders.map((order) => (
                <article className="account-order-card" key={order._id}>
                  <div className="account-order-head">
                    <div>
                      <p className="order-label">Order ID</p>
                      <h3>{order._id}</h3>
                    </div>
                    <span className={`order-status-pill ${String(order.orderStatus || "Order Placed").toLowerCase().replace(/\s+/g, "-")}`}>
                      {order.orderStatus || "Order Placed"}
                    </span>
                  </div>
                  <div className="account-order-meta">
                    <div><span>Payment</span><strong>{order.paymentStatus}</strong></div>
                    <div><span>Mode</span><strong>{order.paymentMode}</strong></div>
                    <div><span>Total</span><strong>₹{order.totalPayment}</strong></div>
                  </div>
                  <div className="account-order-items">
                    {(order.items || []).map((item) => (
                      <div className="account-order-item" key={`${order._id}-${item.productId}`}>
                        <strong>{item.productName}</strong>
                        <span>{item.productId}</span>
                        <span>Qty {item.quantity}</span>
                        <span>₹{item.lineTotal}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Account;
