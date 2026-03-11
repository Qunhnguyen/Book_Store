import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { get, urls } from '../../api/client';
import cover1 from '../../assets/showcase/cover-1.svg';
import cover2 from '../../assets/showcase/cover-2.svg';
import cover3 from '../../assets/showcase/cover-3.svg';
import cover4 from '../../assets/showcase/cover-4.svg';
import cover5 from '../../assets/showcase/cover-5.svg';
import cover6 from '../../assets/showcase/cover-6.svg';

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

const showcaseImages = [cover1, cover2, cover3, cover4, cover5, cover6];

const demoCategories = [
  { id: 1, name: 'Programming' },
  { id: 2, name: 'Fiction' },
  { id: 3, name: 'Design' },
  { id: 4, name: 'Self-Improvement' },
  { id: 5, name: 'Science' },
];

const demoBooks = [
  { id: 101, title: 'The Art of Minimal', author: 'Elena Rivers', price: 24.99, stock: 18 },
  { id: 102, title: 'Future Visions', author: 'Marcus Thorne', price: 19.5, stock: 7 },
  { id: 103, title: 'History Reimagined', author: 'Sarah J. Miller', price: 28.0, stock: 9 },
  { id: 104, title: 'Systemic Design', author: 'Linda M. Chen', price: 34.99, stock: 15 },
  { id: 105, title: 'The Quiet Deep', author: 'James Oswald', price: 22.5, stock: 11 },
  { id: 106, title: 'Urban Botany', author: 'Dr. Clara Vale', price: 41.0, stock: 4 },
  { id: 107, title: 'Algorithmic Soul', author: 'P.K. Henderson', price: 31.25, stock: 12 },
  { id: 108, title: 'Stoic Pathways', author: 'Marcus Aurelius Jr.', price: 18.99, stock: 0 },
  { id: 109, title: 'Pythonic Ways', author: 'Olivia Von Rossum', price: 49.99, stock: 10 },
  { id: 110, title: 'Typography Essentials', author: 'Sarah Dresner', price: 45.0, stock: 6 },
  { id: 111, title: 'Midnight Woods', author: 'T. S. Knight', price: 19.95, stock: 3 },
];

const demoRecommendations = demoBooks.slice(0, 8);
const INITIAL_VISIBLE_BOOKS = 10;

function getCoverImage(index) {
  return showcaseImages[index % showcaseImages.length];
}

export default function HomeShowcasePage() {
  const [books, setBooks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [searchText, setSearchText] = useState('');
  const [visibleBookCount, setVisibleBookCount] = useState(INITIAL_VISIBLE_BOOKS);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, recData, categoryData] = await Promise.all([
          get(`${urls.book}/books/`),
          get(`${urls.recommender}/recommendations/`),
          get(`${urls.catalog}/categories/`),
        ]);

        setBooks(Array.isArray(bookData) && bookData.length ? bookData : demoBooks);
        setRecommendations(Array.isArray(recData) && recData.length ? recData : demoRecommendations);
        setCategories(Array.isArray(categoryData) && categoryData.length ? categoryData : demoCategories);
      } catch (loadError) {
        setBooks(demoBooks);
        setRecommendations(demoRecommendations);
        setCategories(demoCategories);
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

  useEffect(() => {
    setVisibleBookCount(INITIAL_VISIBLE_BOOKS);
  }, [activeCategory, searchText]);

  const displayedBooks = useMemo(
    () => filteredBooks.slice(0, visibleBookCount),
    [filteredBooks, visibleBookCount],
  );
  const hasMoreBooks = displayedBooks.length < filteredBooks.length;

  const sourceBooks = recommendations.length ? recommendations : books;
  const heroBooks = sourceBooks.slice(0, 3);
  const featuredHeroBooks = heroBooks.length
    ? heroBooks
    : [
        { id: 101, title: 'The Art of Minimal', author: 'Elena Rivers' },
        { id: 102, title: 'Future Visions', author: 'Marcus Thorne' },
        { id: 103, title: 'History Reimagined', author: 'Sarah J. Miller' },
      ];

  return (
    <div className="sb-page sb-home">
      <header className="sb-topbar-shell">
        <div className="sb-topbar">
          <Link className="sb-brand" to="/">Lumina</Link>
          <input
            placeholder="Search across 10,000+ titles, authors, or genres..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <nav>
            <NavLink to="/" end>Home</NavLink>
            <a href="#popular-books">Best Sellers</a>
            <a href="#popular-books">New Releases</a>
            <a href="#popular-books">Deals</a>
          </nav>
          <div className="sb-actions">
            <Link className="sb-icon-link" to="/cart" aria-label="Open cart">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5H5L7.4 15.2C7.5 15.7 8 16 8.5 16H18.2C18.7 16 19.1 15.7 19.2 15.2L21 8H6.2" />
                <circle cx="9" cy="20" r="1.6" />
                <circle cx="18" cy="20" r="1.6" />
              </svg>
              <span>{displayedBooks.length}</span>
            </Link>
            <Link className="sb-icon-link" to="/reviews-profile" aria-label="Open account">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 19C6.7 15.9 9 14.5 12 14.5C15 14.5 17.3 15.9 19 19" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="sb-main-shell">
        <section className="sb-hero">
          <div>
            <span className="sb-chip">AI PERSONALIZED RECOMMENDATIONS</span>
            <h1>
              Discover Your Next
              <br />
              <span>Great Read</span>
            </h1>
            <p>Our AI analyzes your reading habits to curate a collection of books you will actually love.</p>
            <Link className="sb-btn" to={featuredHeroBooks[0] ? `/book/${featuredHeroBooks[0].id}` : '/book/1'}>
              Explore Now
            </Link>
            {error ? <p className="sb-inline-error">{error}</p> : null}
          </div>
          <div className="sb-hero-grid">
            {featuredHeroBooks.map((book, idx) => (
              <article key={book.id || idx} className="sb-hero-book">
                <img src={getCoverImage(idx)} alt={book.title} />
                <div className="sb-hero-book-copy">
                  <p>{book.title}</p>
                  <span>{book.author}</span>
                  <strong>{asCurrency(book.price || 19.5 + idx * 4.75)}</strong>
                </div>
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

        <section className="sb-section" id="popular-books">
          <div className="sb-row">
            <h2>Popular Books</h2>
            <button type="button" className="sb-filter-btn">Sort by: Popularity</button>
          </div>

          <div className="sb-book-grid">
            {displayedBooks.map((book, idx) => {
              const tag = mapTag(book);
              return (
                <article key={book.id || `${book.title}-${idx}`} className="sb-card">
                  <span className={`sb-stock ${tag !== 'IN STOCK' ? 'warn' : ''}`}>{tag}</span>
                  <Link className="sb-cover" to={`/book/${book.id}`}>
                    <img src={getCoverImage(idx)} alt={book.title} />
                  </Link>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <div className="sb-price-row">
                    <strong>{asCurrency(book.price)}</strong>
                    <Link to="/cart" className="sb-mini-btn" aria-label={`Go to cart from ${book.title}`}>
                      +
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="sb-center">
            {hasMoreBooks ? (
              <button
                type="button"
                className="sb-outline-btn"
                onClick={() => setVisibleBookCount(filteredBooks.length)}
              >
                Load More Titles
              </button>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="sb-footer-shell">
        <div className="sb-footer sb-footer-dark">
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
        </div>
      </footer>
    </div>
  );
}
