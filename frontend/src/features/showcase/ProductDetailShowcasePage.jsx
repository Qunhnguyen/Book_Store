export default function ProductDetailShowcasePage() {
  return (
    <div className="detail-page">
      <header className="header-bookstore">
        <div className="logo">BookStore</div>
        <nav>
          <a>Browse</a>
          <a>Best Sellers</a>
          <a>New Releases</a>
          <a className="active">Deals</a>
        </nav>
        <input placeholder="Search books, authors..." />
        <div className="icons">🛒 ♥ 👤</div>
      </header>

      <main className="main-wrap">
        <div className="crumbs">Home › Fiction › Contemporary</div>
        <section className="detail-grid">
          <div className="detail-poster">The Midnight Library</div>
          <div>
            <h1 className="title-big">The Midnight Library</h1>
            <div className="sub-link">by Matt Haig</div>
            <div className="score-row">★★★★★ 4.8 (12,450 Reviews) · <span>In Stock</span></div>
            <div className="price-line">
              <strong>$18.99</strong>
              <span>$24.99</span>
              <b>24% OFF</b>
            </div>
            <div className="btn-row">
              <button>Add to Cart</button>
              <button className="ghost">Buy Now</button>
            </div>
            <div className="desc">
              <h3>Description</h3>
              <p>
                Between life and death there is a library, and within that library, the shelves go on forever.
                Every book provides a chance to try another life you could have lived.
              </p>
            </div>
          </div>
        </section>

        <section className="ratings-row">
          <div className="score-card">
            <strong>4.8</strong>
            <p>Based on 12,450 ratings</p>
          </div>
          <div className="review-col">
            <div className="review-line">Sarah Jenkins - "A profound and touching book..." ★★★★★</div>
            <div className="review-line">Michael Chen - "Great concept and very well written..." ★★★★★</div>
          </div>
        </section>

        <section>
          <h2>People also bought</h2>
          <div className="books-grid-5 short">
            {[1, 2, 3, 4, 5].map((i) => (
              <article key={i} className="book-item compact">
                <div className={`cover c${i}`} />
                <h3>Book {i}</h3>
                <p>Author {i}</p>
                <strong>$1{i}.50</strong>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer-light">
        <div className="logo">BookStore</div>
        <div>Best Sellers · New Releases · E-books · Gift Cards</div>
        <input placeholder="Email address" />
      </footer>
    </div>
  );
}
