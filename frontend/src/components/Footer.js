import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <h3>Gift Store</h3>
          <p>Thoughtful gifts for every occasion with easy ordering and reliable delivery tracking.</p>
        </div>

        <div className="footer-links">
          <h4>Quick Links</h4>
          <Link to="/">Home</Link>
          <Link to="/auth">Login / Sign Up</Link>
        </div>

        <div className="footer-contact">
          <h4>Company Details</h4>
          <p><strong>Address:</strong> 12 Rose Avenue, Sector 8, New Delhi, India</p>
          <p><strong>Contact:</strong> +91 98765 43210</p>
          <p><strong>Email:</strong> support@giftstore.com</p>
          <p><strong>Hours:</strong> Mon - Sat, 9:00 AM - 8:00 PM</p>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} Gift Store. All rights reserved.</p>
    </footer>
  );
}

export default Footer;
