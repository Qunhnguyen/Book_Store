import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, getErrorMessage, post, put, urls } from '../../api/client';
import cover1 from '../../assets/showcase/cover-1.svg';
import cover2 from '../../assets/showcase/cover-2.svg';
import cover3 from '../../assets/showcase/cover-3.svg';
import cover4 from '../../assets/showcase/cover-4.svg';
import cover5 from '../../assets/showcase/cover-5.svg';
import cover6 from '../../assets/showcase/cover-6.svg';
import midnightCover from '../../assets/showcase/midnight-library.svg';
import avatarSarah from '../../assets/showcase/avatar-sarah.svg';
import avatarMichael from '../../assets/showcase/avatar-michael.svg';

const demoBooks = [
  {
    id: 101,
    title: 'The Midnight Library',
    author: 'Matt Haig',
    price: 18.99,
    stock: 14,
    category: 'Contemporary',
    cover: midnightCover,
    description:
      'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices. Would you have done anything different, if you had the chance to undo your regrets?\n\nA dazzling novel about all the choices that go into a life well lived, from the internationally bestselling author of Reasons to Stay Alive and How to Stop Time.',
    publisher: 'Viking',
    releaseDate: 'Sept 29, 2020',
    pages: 304,
    language: 'English',
    reviewsCount: 12450,
  },
  {
    id: 102,
    title: 'The Comfort Book',
    author: 'Matt Haig',
    price: 16.5,
    stock: 7,
    category: 'Self-Improvement',
    cover: cover1,
  },
  {
    id: 103,
    title: 'Anxious People',
    author: 'Fredrik Backman',
    price: 17.99,
    stock: 9,
    category: 'Fiction',
    cover: cover5,
  },
  {
    id: 104,
    title: 'The Overstory',
    author: 'Richard Powers',
    price: 15.25,
    stock: 11,
    category: 'Fiction',
    cover: cover3,
  },
  {
    id: 105,
    title: 'Normal People',
    author: 'Sally Rooney',
    price: 14.99,
    stock: 8,
    category: 'Fiction',
    cover: cover6,
  },
  {
    id: 106,
    title: 'Where the Crawdads Sing',
    author: 'Delia Owens',
    price: 12.5,
    stock: 10,
    category: 'Fiction',
    cover: cover4,
  },
];

const demoReviewsByBook = {
  101: [
    {
      id: 3001,
      customer_id: 21,
      name: 'Sarah Jenkins',
      avatar: avatarSarah,
      age: '2 weeks ago',
      rating: 5,
      comment: 'A profound and touching book. It made me reflect so much on my own life choices and the idea of regret. Truly a life-changing read.',
    },
    {
      id: 3002,
      customer_id: 8,
      name: 'Michael Chen',
      avatar: avatarMichael,
      age: '1 month ago',
      rating: 5,
      comment: 'Great concept and very well written. Matt Haig has a way of explaining complex human emotions that is very accessible.',
    },
    {
      id: 3003,
      customer_id: 14,
      name: 'Elena Ford',
      avatar: avatarSarah,
      age: '2 months ago',
      rating: 4,
      comment: 'Thoughtful, elegant, and comforting. A book that quietly stays with you.',
    },
  ],
};

const coverMap = {
  101: cover1,
  102: cover2,
  103: cover3,
  104: cover4,
};

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
  const [books, setBooks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const customerId = Number(localStorage.getItem('sb_customer_id') || '1');
  const cartId = Number(localStorage.getItem('sb_cart_id') || '1');

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, reviewData] = await Promise.all([
          get(`${urls.book}/books/`),
          get(`${urls.review}/reviews/book/${id}/`),
        ]);

        const safeBooks = Array.isArray(bookData) && bookData.length ? bookData : demoBooks;
        const safeReviews = Array.isArray(reviewData) && reviewData.length
          ? reviewData
          : demoReviewsByBook[Number(id)] || [];

        setBooks(safeBooks);
        setReviews(safeReviews);
      } catch (loadError) {
        setBooks(demoBooks);
        setReviews(demoReviewsByBook[Number(id)] || []);
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
        cover: book.cover || coverMap[Number(book.id)] || cover1,
        description:
          book.description ||
          'A visually rich title presented with sample data so you can review the product detail UI before the backend is fully connected.',
        publisher: book.publisher || 'Lumina Press',
        releaseDate: book.releaseDate || 'Mar 14, 2024',
        pages: book.pages || 288,
        language: book.language || 'English',
        category: book.category || 'Design',
        reviewsCount: book.reviewsCount || 245,
      }
    : null;

  async function addToCart() {
    try {
      setError('');
      setNotice('');
      const items = await get(`${urls.cart}/carts/${customerId}/`);
      const list = Array.isArray(items) ? items : [];
      const current = list.find((item) => Number(item.book_id) === Number(id));

      if (current) {
        await put(`${urls.cart}/cart-items/${current.id}/`, {
          quantity: Number(current.quantity) + 1,
        });
      } else {
        await post(`${urls.cart}/cart-items/`, {
          cart: cartId,
          book_id: Number(id),
          quantity: 1,
        });
      }

      setNotice('Added to cart successfully.');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
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
            <img src={detailBook.cover} alt={detailBook.title} />
          </div>

          <div className="sb-detail-content-v2">
            <h1>{detailBook.title}</h1>
            <p className="sb-author">by {detailBook.author}</p>
            <p className="sb-rating-row sb-rating-row-v2">
              <span className="sb-stars">★★★★★</span>
              <span>{averageRating ? averageRating.toFixed(1) : '4.8'}</span>
              <span>({detailBook.reviewsCount.toLocaleString()} Reviews)</span>
              <span className="sb-dot">•</span>
              <b>{detailBook.stock > 0 ? 'In Stock' : 'Out of Stock'}</b>
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
            <button type="button" className="sb-outline-btn">Write a Review</button>
          </div>

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
                  <img src={item.avatar || avatarSarah} alt={item.name || `Customer ${item.customer_id}`} />
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
                  <img src={item.cover || coverMap[Number(item.id)] || cover1} alt={item.title} />
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
