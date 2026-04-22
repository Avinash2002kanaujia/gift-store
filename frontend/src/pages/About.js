function About() {
  return (
    <div className="info-page-wrap">
      <section className="info-page-hero">
        <p className="info-kicker">About Us</p>
        <h1>We make gifting feel meaningful</h1>
        <p>
          Gift Store started with one simple idea: a good gift should feel personal, thoughtful, and memorable.
          We curate products that help people celebrate milestones and everyday moments.
        </p>
      </section>

      <section className="info-grid">
        <article className="info-card">
          <h3>Our Mission</h3>
          <p>
            To help customers discover quality gifts quickly while keeping the shopping experience simple,
            warm, and dependable.
          </p>
        </article>

        <article className="info-card">
          <h3>What We Offer</h3>
          <p>
            Curated gifts, easy checkout, transparent payment flow, and order tracking from placed to delivered.
          </p>
        </article>

        <article className="info-card">
          <h3>Why Customers Choose Us</h3>
          <p>
            Clear pricing, smooth order management, and a customer dashboard that keeps order updates visible.
          </p>
        </article>
      </section>
    </div>
  );
}

export default About;
