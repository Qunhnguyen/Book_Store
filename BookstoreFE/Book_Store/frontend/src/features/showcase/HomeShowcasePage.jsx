import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BooksApi, RecommendationsApi, CategoriesApi } from '../../api/client';
import { useAuth } from '../../app/context/AuthContext';
import BookCover from '../../shared/components/BookCover';

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

const INITIAL_VISIBLE_BOOKS = 10;

export default function HomeShowcasePage() {
  const [books, setBooks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [searchText, setSearchText] = useState('');
  const [visibleBookCount, setVisibleBookCount] = useState(INITIAL_VISIBLE_BOOKS);
  const [sortOrder, setSortOrder] = useState('popular');
  const [error, setError] = useState('');

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCartClick = (e, path) => {
    if (!user) {
      e.preventDefault();
      navigate('/login', { state: { from: location } });
    } else if (path) {
      e.preventDefault();
      navigate(path);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, recData, categoryData] = await Promise.all([
          BooksApi.list().catch((err) => { console.error(err); return []; }),
          RecommendationsApi.list().catch((err) => { console.error(err); return []; }),
          CategoriesApi.list().catch((err) => { console.error(err); return []; }),
        ]);

        setBooks(Array.isArray(bookData) ? bookData : []);
        setRecommendations(Array.isArray(recData) ? recData : []);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
      } catch (loadError) {
        setError('Không thể kết nối dịch vụ. Vui lòng thử lại.');
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
    const source = books;

    let result = source.filter((book) => {
      const categoryPass =
        activeCategory === 'All Categories' ||
        (book.categories || []).some((c) => c.name === activeCategory);

      if (!term) return categoryPass;
      return categoryPass && `${book.title} ${book.author}`.toLowerCase().includes(term);
    });

    if (sortOrder === 'price_asc') result = [...result].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sortOrder === 'price_desc') result = [...result].sort((a, b) => Number(b.price) - Number(a.price));
    else if (sortOrder === 'alpha') result = [...result].sort((a, b) => a.title.localeCompare(b.title));

    return result;
  }, [activeCategory, books, recommendations, searchText, sortOrder]);

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
            <Link className="sb-icon-link" to="/cart" aria-label="Open cart" onClick={(e) => handleCartClick(e)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5H5L7.4 15.2C7.5 15.7 8 16 8.5 16H18.2C18.7 16 19.1 15.7 19.2 15.2L21 8H6.2" />
                <circle cx="9" cy="20" r="1.6" />
                <circle cx="18" cy="20" r="1.6" />
              </svg>
              <span>{filteredBooks.length}</span>
            </Link>

            {user ? (
              <Link className="sb-icon-link" to="/reviews-profile" aria-label="Profile">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 19C6.7 15.9 9 14.5 12 14.5C15 14.5 17.3 15.9 19 19" />
                </svg>
              </Link>
            ) : (
              <Link className="sb-icon-link" to="/login" aria-label="Login">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 19C6.7 15.9 9 14.5 12 14.5C15 14.5 17.3 15.9 19 19" />
                </svg>
              </Link>
            )}
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
                <BookCover book={book} style={{ width: '100%', borderRadius: '8px', objectFit: 'cover' }} />
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
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select
                value={sortOrder}
                onChange={(e) => { setSortOrder(e.target.value); setVisibleBookCount(INITIAL_VISIBLE_BOOKS); }}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: '#fff',
                  border: '1.5px solid #c9d0e6',
                  borderRadius: '999px',
                  color: '#2c3558',
                  padding: '8px 36px 8px 16px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(14,24,54,0.06)',
                  fontFamily: 'inherit',
                }}
              >
                <option value="popular">⭐ Sort by: Popularity</option>
                <option value="price_asc">💰 Sort by: Price ↑</option>
                <option value="price_desc">💎 Sort by: Price ↓</option>
                <option value="alpha">🔤 Sort by: Title A–Z</option>
              </select>
              <span style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: '#3b3fb4', fontSize: '12px',
              }}>▼</span>
            </div>
          </div>

          <div className="sb-book-grid">
            {displayedBooks.map((book, idx) => {
              const tag = mapTag(book);
              return (
                <article key={book.id || `${book.title}-${idx}`} className="sb-card">
                  <span className={`sb-stock ${tag !== 'IN STOCK' ? 'warn' : ''}`}>
                    {tag === 'SOLD OUT' ? tag : `${tag} (${book.stock})`}
                  </span>
                  <Link className="sb-cover" to={`/book/${book.id}`}>
                    <BookCover book={book} />
                  </Link>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <div className="sb-price-row">
                    <strong>{asCurrency(book.price)}</strong>
                    <button
                      className="sb-mini-btn"
                      aria-label={`Go to cart from ${book.title}`}
                      onClick={(e) => handleCartClick(e, `/book/${book.id}`)}
                    >
                      <svg viewBox="0 0 24 24" width="15" height="15" stroke="#fff" fill="none" strokeWidth="3" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </button>
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
