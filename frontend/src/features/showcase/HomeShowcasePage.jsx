import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, urls } from '../../api/client';

function asCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function mapTag(book) {
  if (book.stock <= 0) {
    return 'SOLD OUT';
  }

  if (book.stock < 5) {
    return 'LOW STOCK';
  }

  return 'IN STOCK';
}

export default function HomeShowcasePage() {
  const [books, setBooks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [searchText, setSearchText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, recData, categoryData] = await Promise.all([
          get(`${urls.book}/books/`),
          get(`${urls.recommender}/recommendations/`),
          get(`${urls.catalog}/categories/`),
        ]);

        setBooks(Array.isArray(bookData) ? bookData : []);
        setRecommendations(Array.isArray(recData) ? recData : []);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
      } catch (loadError) {
        setError('Some services are unavailable. Showing best-effort data.');
      }
    }

    loadData();
  }, []);

  const categoryTabs = useMemo(() => {
    const fromApi = categories.map((category) => category.name).filter(Boolean);
    return ['All Categories', ...fromApi.slice(0, 6)];
  }, [categories]);

  const filteredBooks = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const source = recommendations.length ? recommendations : books;

    return source.filter((book, idx) => {
      const categoryPass =
        activeCategory === 'All Categories' || categoryTabs[idx % categoryTabs.length] === activeCategory;

      if (!term) {
        return categoryPass;
      }

      return categoryPass && `${book.title} ${book.author}`.toLowerCase().includes(term);
    });
  }, [activeCategory, books, categoryTabs, recommendations, searchText]);

  const heroBooks = (recommendations.length ? recommendations : books).slice(0, 3);

  return (
    <div className="sb-page sb-home">
      <header className="sb-topbar">
        <div className="sb-brand">Lumina</div>
        <input
          placeholder="Search across 10,000+ titles, authors, or genres..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <nav>
          <a className="active">Home</a>
          <a>Best Sellers</a>
          <a>New Releases</a>
          <a>Deals</a>
        </nav>
        <div className="sb-icons">🛒 👤</div>
      </header>

      <section className="sb-hero">
        <div>
          <span className="sb-chip">AI PERSONALIZED RECOMMENDATIONS</span>
          <h1>
            Discover Your Next
            <br />
            <span>Great Read</span>
          </h1>
          <p>Our AI analyzes your reading habits to curate a collection of books you will actually love.</p>
          <Link className="sb-btn" to={heroBooks[0] ? `/book/${heroBooks[0].id}` : '/book/1'}>
            Explore Now
          </Link>
          {error ? <p className="sb-inline-error">{error}</p> : null}
        </div>
        <div className="sb-hero-grid">
          {heroBooks.map((book, idx) => (
            <article key={book.id || idx} className={`sb-hero-book sb-tone-${idx + 1}`}>
              <p>{book.title}</p>
              <span>{book.author}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="sb-cat-bar">
        {categoryTabs.map((category) => (
          <button
            key={category}
            className={activeCategory === category ? 'active' : ''}
            onClick={() => setActiveCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </section>

      <section className="sb-section">
        <div className="sb-row">
          <h2>Popular Books</h2>
          <button type="button" className="sb-filter-btn">Sort by: Popularity</button>
        </div>

        <div className="sb-book-grid">
          {filteredBooks.slice(0, 10).map((book, idx) => {
            const tag = mapTag(book);
            return (
              <article key={book.id || `${book.title}-${idx}`} className="sb-card">
                <span className={`sb-stock ${tag !== 'IN STOCK' ? 'warn' : ''}`}>{tag}</span>
                <Link className={`sb-cover sb-tone-${(idx % 5) + 1}`} to={`/book/${book.id}`}>
                  {book.title}
                </Link>
                <h3>{book.title}</h3>
                <p>{book.author}</p>
                <div className="sb-price-row">
                  <strong>{asCurrency(book.price)}</strong>
                  <Link to={`/book/${book.id}`} className="sb-mini-btn">+</Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="sb-center">
          <Link className="sb-outline-btn" to="/book/1">Load More Titles</Link>
        </div>
      </section>

      <footer className="sb-footer sb-footer-dark">
        <div>
          <h4>Lumina</h4>
          <p>The world first AI-powered bookstore. We do not just sell books. We build reading journeys.</p>
        </div>
        <div>
          <h5>Shop</h5>
          <p>All Collections</p>
          <p>Gift Cards</p>
          <p>Book Sets</p>
          <p>Merchandise</p>
        </div>
        <div>
          <h5>Support</h5>
          <p>Help Center</p>
          <p>Order Tracking</p>
          <p>Returns & Refunds</p>
          <p>Privacy Policy</p>
        </div>
        <div>
          <h5>Newsletter</h5>
          <p>Get weekly recommendations to your inbox.</p>
          <input placeholder="Email address" />
        </div>
      </footer>
    </div>
  );
}
