import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { get, getErrorMessage, post, put, urls } from '../../api/client';
import cover1 from '../../assets/showcase/cover-1.svg';
import cover2 from '../../assets/showcase/cover-2.svg';

const demoBooks = [
  {
    id: 9001,
    title: 'Dac Nhan Tam',
    author: 'Dale Carnegie',
    price: 80,
    cover: cover1,
  },
  {
    id: 9002,
    title: 'Nha Gia Kim',
    author: 'Paulo Coelho',
    price: 75,
    cover: cover2,
  },
];

const demoCart = [
  { id: 'demo-1', book_id: 9001, quantity: 1, isDemo: true },
  { id: 'demo-2', book_id: 9002, quantity: 2, isDemo: true },
];

function toVnd(value) {
  return `${Math.round(Number(value || 0) * 1000).toLocaleString('vi-VN')}d`;
}

export default function CartShowcasePage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const customerId = Number(localStorage.getItem('sb_customer_id') || '1');

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, cartData] = await Promise.all([
          get(`${urls.book}/books/`),
          get(`${urls.cart}/carts/${customerId}/`),
        ]);
        const safeBooks = Array.isArray(bookData) && bookData.length ? bookData : demoBooks;
        const safeItems = Array.isArray(cartData) && cartData.length ? cartData : demoCart;
        setBooks(safeBooks);
        setItems(safeItems);
        setNotice(safeItems === demoCart ? 'Dang hien thi du lieu mau de ban xem giao dien.' : '');
      } catch (loadError) {
        setBooks(demoBooks);
        setItems(demoCart);
        setNotice('Dang hien thi du lieu mau de ban xem giao dien.');
        setError(getErrorMessage(loadError));
      }
    }

    loadData();
  }, [customerId]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const book = books.find((entry) => Number(entry.id) === Number(item.book_id));
        return {
          ...item,
          title: book?.title || `Book #${item.book_id}`,
          author: book?.author || 'Unknown author',
          price: Number(book?.price || 0),
          cover: book?.cover || cover1,
        };
      }),
    [books, items],
  );

  const subtotal = rows.reduce((sum, row) => sum + row.price * Number(row.quantity || 0), 0);
  const discount = rows.length >= 2 ? 20 : 0;
  const total = Math.max(subtotal - discount, 0);

  async function changeQty(item, nextQty) {
    if (nextQty <= 0) {
      return;
    }

    if (item.isDemo) {
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, quantity: nextQty } : entry)),
      );
      return;
    }

    try {
      setError('');
      setBusy(true);
      await put(`${urls.cart}/cart-items/${item.id}/`, { quantity: nextQty });
      const updated = await get(`${urls.cart}/carts/${customerId}/`);
      setItems(Array.isArray(updated) ? updated : []);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function createOrder() {
    if (rows.some((item) => item.isDemo)) {
      navigate('/checkout');
      return;
    }

    try {
      setError('');
      setBusy(true);
      await post(`${urls.order}/orders/`, { customer_id: customerId });
      navigate('/checkout');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  function removeItem(item) {
    if (item.isDemo) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    }
  }

  const shipping = 0;
  const finalTotal = Math.max(subtotal + shipping - discount, 0);

  return (
    <div className="sb-page sb-cart">
      <header className="sb-topbar-shell">
        <div className="sb-topbar sb-tight sb-store-topbar">
          <Link className="sb-brand sb-store-brand" to="/cart">Book Store</Link>
          <input placeholder="Tim kiem sach..." readOnly />
          <nav>
            <a href="#">Sach moi</a>
            <a href="#">Ban chay</a>
            <a href="#">The loai</a>
          </nav>
          <div className="sb-actions">
            <Link className="sb-icon-link active" to="/cart" aria-label="Open cart">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5H5L7.4 15.2C7.5 15.7 8 16 8.5 16H18.2C18.7 16 19.1 15.7 19.2 15.2L21 8H6.2" />
                <circle cx="9" cy="20" r="1.6" />
                <circle cx="18" cy="20" r="1.6" />
              </svg>
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
        <section className="sb-cart-main sb-cart-showcase">
          <p className="sb-breadcrumb">
            <Link to="/">Trang chu</Link>
            <span>›</span>
            <strong>Gio hang</strong>
          </p>
          <h1>Gio hang cua ban</h1>
          <p>Ban co {rows.length} san pham trong gio hang</p>
          {notice ? <p className="sb-notice">{notice}</p> : null}
          {error ? <p className="sb-inline-error">{error}</p> : null}

          <section className="sb-cart-grid sb-cart-grid-showcase">
            <div className="sb-cart-table sb-cart-table-showcase">
              <div className="sb-cart-head sb-cart-head-showcase">
                <span>SAN PHAM</span>
                <span>GIA</span>
                <span>SO LUONG</span>
                <span>TONG</span>
              </div>

              {rows.map((item) => (
                <div key={item.id} className="sb-cart-row sb-cart-row-showcase">
                  <div className="sb-cart-product">
                    <img src={item.cover} alt={item.title} />
                    <div>
                      <h3>{item.title}</h3>
                      <small>Tac gia: {item.author}</small>
                    </div>
                  </div>
                  <strong>{toVnd(item.price)}</strong>
                  <div className="sb-stepper">
                    <button type="button" onClick={() => changeQty(item, Number(item.quantity) - 1)} disabled={busy}>-</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => changeQty(item, Number(item.quantity) + 1)} disabled={busy}>+</button>
                  </div>
                  <div className="sb-cart-total-cell">
                    <strong>{toVnd(item.price * Number(item.quantity))}</strong>
                    <button type="button" className="sb-trash-btn" onClick={() => removeItem(item)} aria-label={`Remove ${item.title}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 7H19" />
                        <path d="M9 7V5H15V7" />
                        <path d="M8 10V18" />
                        <path d="M12 10V18" />
                        <path d="M16 10V18" />
                        <path d="M6 7L7 19H17L18 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              <div className="sb-cart-footer-row">
                <Link className="sb-back-link" to="/">← Tiep tuc mua sam</Link>
              </div>
            </div>

            <div className="sb-cart-side">
              <aside className="sb-order-box sb-order-box-showcase">
                <h2>Tom tat don hang</h2>
                <div>
                  <p>Tam tinh</p>
                  <b>{toVnd(subtotal)}</b>
                </div>
                <div>
                  <p>Phi van chuyen</p>
                  <b>Mien phi</b>
                </div>
                <div>
                  <p>Giam gia (Voucher)</p>
                  <b className="sb-discount-value">-{toVnd(discount)}</b>
                </div>
                <div className="sb-total-line">
                  <p>Tong cong</p>
                  <b>{toVnd(finalTotal)}</b>
                </div>

                <label className="sb-voucher-label" htmlFor="voucher-code">Ma giam gia</label>
                <div className="sb-voucher-row">
                  <input id="voucher-code" placeholder="Nhap ma..." readOnly />
                  <button type="button" className="sb-voucher-btn">Ap dung</button>
                </div>

                <button type="button" onClick={createOrder} disabled={!rows.length || busy} className="sb-primary-wide">
                  Tien hanh dat hang →
                </button>
              </aside>

              <section className="sb-service-box">
                <article>
                  <div className="sb-service-icon">✓</div>
                  <div>
                    <h3>Thanh toan an toan</h3>
                    <p>Thong tin thanh toan cua ban duoc bao mat tuyet doi.</p>
                  </div>
                </article>
                <article>
                  <div className="sb-service-icon">↺</div>
                  <div>
                    <h3>Giao hang nhanh 24/7</h3>
                    <p>Giao hang tan noi tren toan quoc chi tu 2-3 ngay.</p>
                  </div>
                </article>
              </section>
            </div>
          </section>
        </section>
      </main>

      <footer className="sb-store-footer-shell">
        <div className="sb-store-footer">
          <Link className="sb-store-footer-brand" to="/cart">Book Store</Link>
          <nav>
            <a href="#">Ve chung toi</a>
            <a href="#">Dieu khoan</a>
            <a href="#">Lien he</a>
          </nav>
          <p>© 2024 Book Store. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
