import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { BooksApi, ReviewsApi, CartApi, getErrorMessage } from '../../api/client';
import BookCover from '../../shared/components/BookCover';
import { useAuth } from '../../app/context/AuthContext';

function asCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const ratingBreakdown = [
  { stars: 5, percent: 85 },
  { stars: 4, percent: 10 },
  { stars: 3, percent: 3 },
  { stars: 2, percent: 1 },
  { stars: 1, percent: 1 },
];

export default function ProductDetailShowcasePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [books, setBooks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const { user } = useAuth();
  const customerId = user ? (user.customer_id || user.id) : null;

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, reviewData] = await Promise.all([
          BooksApi.list(),
          ReviewsApi.listByBook(id),
        ]);

        const safeBooks = Array.isArray(bookData) ? bookData : [];
        const safeReviews = Array.isArray(reviewData) ? reviewData : [];

        setBooks(safeBooks);
        setReviews(safeReviews);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      }
    }

    loadData();
  }, [id]);

  const book = useMemo(
    () => books.find((item) => Number(item.id) === Number(id)) || null,
    [books, id],
  );

  const averageRating = useMemo(() => {
    if (!reviews.length) {
      return 0;
    }

    const total = reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return total / reviews.length;
  }, [reviews]);

  const related = useMemo(
    () => books.filter((item) => Number(item.id) !== Number(id)).slice(0, 5),
    [books, id],
  );

  const detailBook = book
    ? {
      ...book,
      description:
        book.description ||
        'A visually rich title presented with sample data so you can review the product detail UI before the backend is fully connected.',
      publisher: book.publisher || 'Lumina Press',
      releaseDate: book.releaseDate || 'Mar 14, 2024',
      pages: book.pages || 288,
      language: book.language || 'English',
      category: book.category || 'Design',
      reviewsCount: book.reviewsCount || 0,
    }
    : null;

  async function addToCart() {
    try {
      if (!user) {
        navigate('/login', { state: { from: location } });
        return;
      }

      setError('');
      setNotice('');

      const realCustomerId = Number(user.customer_id || user.id || 1);
      const items = await CartApi.listByCustomer(realCustomerId);
      const list = Array.isArray(items) ? items : [];
      const current = list.find((item) => Number(item.book_id) === Number(id));

      if (current) {
        await CartApi.updateItem(current.id, {
          quantity: Number(current.quantity) + 1,
        });
      } else {
        let resolvedCartId = null;

        if (list.length > 0 && list[0].cart) {
          resolvedCartId = Number(list[0].cart);
        } else {
          const created = await CartApi.createCart(realCustomerId);
          resolvedCartId = Number(created?.id || 0);
        }

        if (!resolvedCartId) {
          throw new Error('Cannot resolve cart for this customer.');
        }

        await CartApi.addItem({
          cart: resolvedCartId,
          book_id: Number(id),
          quantity: 1,
        });
      }

      setNotice('Added to cart successfully.');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  async function submitReview() {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    
    if (!reviewRating) {
      setError('Please select a rating.');
      return;
    }

    try {
      setNotice('');
      setError('');
      setReviewLoading(true);

      const realCustomerId = Number(user.customer_id || user.id || 1);

      await ReviewsApi.create({
        customer_id: realCustomerId,
        book_id: Number(id),
        rating: reviewRating,
        comment: reviewComment,
      });

      const updatedReviews = await ReviewsApi.listByBook(id);
      setReviews(Array.isArray(updatedReviews) ? updatedReviews : []);

      setNotice('Review submitted successfully.');
      setShowReviewForm(false);
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReviewLoading(false);
    }
  }

  if (!detailBook) {
    return (
      <div className="sb-page sb-detail">
        <div className="sb-center-box">
          <h2>Book not found</h2>
          <p>The selected title could not be loaded from the Book service.</p>
          <Link className="sb-btn" to="/">Back to Home</Link>
        </div>
      </div>
    );
  }

  const oldPrice = Number(detailBook.price) * 1.3;
  const salePercent = Math.max(1, Math.round(((oldPrice - Number(detailBook.price)) / oldPrice) * 100));

  return (
    <div className="sb-page sb-detail sb-detail-v2">
      <header className="sb-detail-header-shell">
        <div className="sb-detail-topbar">
          <Link className="sb-detail-brand" to="/">
            <span className="sb-detail-brand-mark">📘</span>
            <span>BookStore</span>
          </Link>
          <nav>
            <a href="#">Browse</a>
            <a href="#">Best Sellers</a>
            <a href="#">New Releases</a>
            <a className="active" href="#">Deals</a>
          </nav>
          <div className="sb-detail-search">
            <span>⌕</span>
            <input placeholder="Search books, authors..." readOnly />
          </div>
          <div className="sb-detail-actions">
            <Link to="/cart" aria-label="Open cart">🛒</Link>
            <button type="button" aria-label="Wishlist">♥</button>
            <Link to="/reviews-profile" aria-label="Open profile" className="sb-detail-user">👩</Link>
          </div>
        </div>
      </header>

      <main className="sb-detail-page-shell">
        <p className="sb-breadcrumb sb-breadcrumb-v2">
          <Link to="/">Home</Link>
          <span>›</span>
          <Link to="/">Fiction</Link>
          <span>›</span>
          <strong>{detailBook.category}</strong>
        </p>

        <section className="sb-detail-hero-v2">
          <div className="sb-detail-cover-card">
            <BookCover book={detailBook} style={{ width: '100%', borderRadius: '12px', objectFit: 'cover' }} />
          </div>

          <div className="sb-detail-content-v2">
            <h1>{detailBook.title}</h1>
            <p className="sb-author">by {detailBook.author}</p>
            <p className="sb-rating-row sb-rating-row-v2">
              <span className="sb-stars">★★★★★</span>
              <span>{averageRating ? averageRating.toFixed(1) : '4.8'}</span>
              <span>({detailBook.reviewsCount.toLocaleString()} Reviews)</span>
              <span className="sb-dot">•</span>
              <b>{detailBook.stock > 0 ? `In Stock (${detailBook.stock})` : 'Out of Stock'}</b>
            </p>

            <div className="sb-price-line">
              <strong>{asCurrency(detailBook.price)}</strong>
              <span>{asCurrency(oldPrice)}</span>
              <b>{salePercent}% OFF</b>
            </div>

            <div className="sb-action-row sb-action-row-v2">
              <button type="button" onClick={addToCart} disabled={detailBook.stock <= 0}>🛒 Add to Cart</button>
              <button type="button" className="ghost" onClick={() => navigate('/checkout')}>Buy Now</button>
            </div>

            {notice ? <p className="sb-notice">{notice}</p> : null}
            {error ? <p className="sb-inline-error">{error}</p> : null}

            <div className="sb-description-box sb-description-box-v2">
              <h3>Description</h3>
              {detailBook.description.split('\n\n').map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <div className="sb-meta-grid sb-meta-grid-v2">
                <div>
                  <small>Publisher</small>
                  <b>{detailBook.publisher}</b>
                </div>
                <div>
                  <small>Release Date</small>
                  <b>{detailBook.releaseDate}</b>
                </div>
                <div>
                  <small>Pages</small>
                  <b>{detailBook.pages} pages</b>
                </div>
                <div>
                  <small>Language</small>
                  <b>{detailBook.language}</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sb-reviews-section-v2">
          <div className="sb-row sb-row-v2">
            <div>
              <h2>Reviews & Ratings</h2>
              <p>What our customers are saying</p>
            </div>
            <button type="button" className="sb-outline-btn" onClick={() => setShowReviewForm(!showReviewForm)}>
              {showReviewForm ? 'Cancel Review' : 'Write a Review'}
            </button>
          </div>

          {showReviewForm && (
            <div className="sb-panel" style={{ marginTop: '20px', marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0 }}>Write Your Review</h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Your Rating</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '32px',
                        padding: '0',
                        color: star <= reviewRating ? '#f4a80b' : '#d0d4e8',
                        transition: 'color 0.15s ease, transform 0.15s ease',
                        transform: star <= reviewRating ? 'scale(1.1)' : 'scale(1)',
                      }}
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Comment</label>
                <textarea 
                  rows="4" 
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Tell us what you thought about this book..."
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'inherit' }}
                />
              </div>
              <button 
                type="button" 
                onClick={submitReview} 
                disabled={reviewLoading}
                style={{ background: '#4a4bcf', color: '#fff', padding: '10px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {reviewLoading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          )}

          <div className="sb-reviews-layout-v2">
            <div className="sb-score-card-v2">
              <strong>{averageRating ? averageRating.toFixed(1) : '4.8'}</strong>
              <div className="sb-stars-line">★★★★★</div>
              <p>Based on {detailBook.reviewsCount.toLocaleString()} ratings</p>
              <div className="sb-rating-bars">
                {ratingBreakdown.map((item) => (
                  <div key={item.stars} className="sb-rating-bar-row">
                    <span>{item.stars}</span>
                    <div><i style={{ width: `${item.percent}%` }} /></div>
                    <small>{item.percent}%</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="sb-review-list-v2">
              {reviews.slice(0, 2).map((item) => (
                <article key={item.id} className="sb-review-card-v2">
                  <img src={item.avatar || `https://ui-avatars.com/api/?name=${item.name || 'C'}&background=random`} alt={item.name || `Customer ${item.customer_id}`} />
                  <div>
                    <div className="sb-review-card-head">
                      <div>
                        <h4>{item.name || `Customer #${item.customer_id}`}</h4>
                        <small>{item.age || 'Recently'}</small>
                      </div>
                      <div className="sb-stars-line">★★★★★</div>
                    </div>
                    <p>“{item.comment || 'No comment provided.'}”</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sb-related-v2">
          <div className="sb-row sb-row-v2">
            <h2>People also bought</h2>
            <div className="sb-related-nav">
              <button type="button">‹</button>
              <button type="button">›</button>
            </div>
          </div>
          <div className="sb-related-grid-v2">
            {related.slice(0, 5).map((item) => (
              <article key={item.id} className="sb-related-card-v2">
                <Link className="sb-related-cover-v2" to={`/book/${item.id}`}>
                  <BookCover book={item} style={{ width: '100%', borderRadius: '8px', objectFit: 'cover' }} />
                </Link>
                <h3>{item.title}</h3>
                <p>{item.author}</p>
                <strong>{asCurrency(item.price)}</strong>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="sb-detail-footer-shell">
        <div className="sb-detail-footer">
          <div>
            <div className="sb-detail-brand footer">
              <span className="sb-detail-brand-mark">📘</span>
              <span>BookStore</span>
            </div>
            <p>Your favorite online bookstore. Curating the best stories for every reader.</p>
          </div>
          <div>
            <h5>Shop</h5>
            <p>Best Sellers</p>
            <p>New Releases</p>
            <p>E-books</p>
            <p>Gift Cards</p>
          </div>
          <div>
            <h5>Support</h5>
            <p>Contact Us</p>
            <p>Shipping Info</p>
            <p>Returns</p>
            <p>FAQ</p>
          </div>
          <div>
            <h5>Newsletter</h5>
            <p>Subscribe for bookish news and exclusive deals.</p>
            <div className="sb-newsletter-row">
              <input placeholder="Email address" />
              <button type="button">➜</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
