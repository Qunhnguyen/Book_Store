import { Link } from 'react-router-dom';

const books = [
  ['Systemic Design', 'Linda M. Chen', '$34.99', 'IN STOCK'],
  ['The Quiet Deep', 'James Oswald', '$22.50', 'IN STOCK'],
  ['Urban Botany', 'Dr. Clara Vale', '$41.00', 'LOW STOCK'],
  ['Algorithmic Soul', 'P.K. Henderson', '$31.25', 'IN STOCK'],
  ['Stoic Pathways', 'Marcus Aurelius Jr.', '$18.99', 'SOLD OUT'],
  ['Pythonic Ways', 'Guido Von Rossum', '$49.99', 'IN STOCK'],
  ['Molecular Tastes', 'Chef Rene Z.', '$39.00', 'IN STOCK'],
  ['The High Peak', 'Erik Larson', '$27.50', 'IN STOCK'],
  ['Typography Essentials', 'Sarah Dresner', '$45.00', 'IN STOCK'],
  ['Midnight Woods', 'T. F. Knight', '$19.95', 'LOW STOCK'],
];

export default function HomeShowcasePage() {
  return (
    <div className="home-page">
      <header className="header-lumina">
        <div className="logo">Lumina</div>
        <input placeholder="Search across 10,000+ titles, authors, or genres..." />
        <nav>
          <a className="active">Home</a>
          <a>Best Sellers</a>
          <a>New Releases</a>
          <a>Deals</a>
        </nav>
        <div className="icons">🛒 👤</div>
      </header>

      <main className="main-wrap">
        <section className="hero-panel">
          <div>
            <span className="capsule">AI PERSONALIZED RECOMMENDATIONS</span>
            <h1>
              Discover Your Next
              <br />
              <span>Great Read</span>
            </h1>
            <p>Our AI analyzes your reading habits to curate a collection of books you'll actually love.</p>
            <button>Explore Now</button>
          </div>
          <div className="hero-books">
            <div className="hero-book dark">Minimal Design Book</div>
            <div className="hero-book mix">Future Visions</div>
            <div className="hero-book green">History Reimagined</div>
          </div>
        </section>

        <div className="cat-strip">
          <a className="active">All Categories</a>
          <a>Programming</a>
          <a>Fiction</a>
          <a>Design</a>
          <a>Self-Improvement</a>
          <a>Science</a>
        </div>

        <section>
          <div className="title-row">
            <h2>Popular Books</h2>
            <button className="sort-btn">Sort by: Popularity</button>
          </div>
          <div className="books-grid-5">
            {books.map(([title, author, price, stock], idx) => (
              <article key={title} className="book-item">
                <span className={`stock ${stock.includes('LOW') ? 'low' : ''}`}>{stock}</span>
                <div className={`cover c${idx % 5}`}>{title}</div>
                <h3>{title}</h3>
                <p>{author}</p>
                <div className="book-row">
                  <strong>{price}</strong>
                  <button aria-label="add">+</button>
                </div>
              </article>
            ))}
          </div>
          <div className="center">
            <Link className="outline" to="/book/1">Load More Titles</Link>
          </div>
        </section>
      </main>

      <footer className="footer-dark">
        <div>
          <h4>Lumina</h4>
          <p>The world's first AI-powered bookstore. We don't just sell books, we curate reading journeys.</p>
        </div>
        <div>
          <h5>Shop</h5>
          <p>All Collections</p>
          <p>Gift Cards</p>
          <p>Book Sets</p>
        </div>
        <div>
          <h5>Support</h5>
          <p>Help Center</p>
          <p>Order Tracking</p>
          <p>Returns</p>
        </div>
        <div>
          <h5>Newsletter</h5>
          <input placeholder="Email address" />
        </div>
      </footer>
    </div>
  );
}
