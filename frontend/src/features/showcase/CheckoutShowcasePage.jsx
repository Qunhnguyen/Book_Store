import { useEffect, useMemo, useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';

function toVnd(value) {
  return `${Math.round(Number(value || 0) * 1000).toLocaleString('vi-VN')}d`;
}

export default function CheckoutShowcasePage() {
  const customerId = Number(localStorage.getItem('sb_customer_id') || '1');
  const [items, setItems] = useState([]);
  const [books, setBooks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    paymentMethod: 'COD',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, cartData, orderData] = await Promise.all([
          get(`${urls.book}/books/`),
          get(`${urls.cart}/carts/${customerId}/`),
          get(`${urls.order}/orders/${customerId}/`),
        ]);

        setBooks(Array.isArray(bookData) ? bookData : []);
        setItems(Array.isArray(cartData) ? cartData : []);
        setOrders(Array.isArray(orderData) ? orderData : []);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      }
    }

    loadData();
  }, [customerId]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const book = books.find((entry) => Number(entry.id) === Number(item.book_id));
        return sum + Number(book?.price || 0) * Number(item.quantity || 0);
      }, 0),
    [books, items],
  );

  async function confirmOrder() {
    if (!form.fullName || !form.phone || !form.address) {
      setError('Please fill full name, phone and address before placing order.');
      return;
    }

    try {
      setError('');
      setNotice('');
      setLoading(true);

      const order = await post(`${urls.order}/orders/`, { customer_id: customerId });

      if (order?.id) {
        await Promise.allSettled([
          post(`${urls.pay}/payments/`, {
            order_id: Number(order.id),
            payment_method: form.paymentMethod,
          }),
          post(`${urls.ship}/shipments/`, {
            order_id: Number(order.id),
            shipping_method: 'STANDARD',
            address: form.address,
          }),
        ]);
      }

      const updatedOrders = await get(`${urls.order}/orders/${customerId}/`);
      setOrders(Array.isArray(updatedOrders) ? updatedOrders : []);
      setNotice('Order confirmed successfully.');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sb-page sb-checkout">
      <header className="sb-topbar sb-tight">
        <div className="sb-brand">Thanh toan</div>
        <nav>
          <a>Trang chu</a>
          <a>San pham</a>
          <a className="active">Don hang</a>
        </nav>
        <div className="sb-icons">🔔</div>
      </header>

      <main className="sb-checkout-main">
        <section className="sb-checkout-grid">
          <div>
            <div className="sb-panel">
              <h3>Dia chi giao hang</h3>
              <div className="sb-form-grid">
                <input
                  placeholder="Nhap ho ten nguoi nhan"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                />
                <input
                  placeholder="Nhap so dien thoai"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
                <input
                  className="wide"
                  placeholder="So nha, ten duong, phuong/xa..."
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </div>
            </div>

            <div className="sb-panel">
              <h3>Phuong thuc thanh toan</h3>
              <button
                type="button"
                className={`sb-choice ${form.paymentMethod === 'COD' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, paymentMethod: 'COD' })}
              >
                Thanh toan khi nhan hang (COD)
              </button>
              <button
                type="button"
                className={`sb-choice ${form.paymentMethod === 'BANK' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, paymentMethod: 'BANK' })}
              >
                Chuyen khoan ngan hang
              </button>
            </div>

            <div className="sb-panel">
              <div className="sb-row">
                <h3>Lich su don hang</h3>
              </div>
              <table className="sb-mini-table">
                <thead>
                  <tr>
                    <th>MA DON</th>
                    <th>NGAY DAT</th>
                    <th>TONG TIEN</th>
                    <th>TRANG THAI</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 3).map((order) => (
                    <tr key={order.id}>
                      <td>#ORD-{order.id}</td>
                      <td>{new Date().toLocaleDateString('vi-VN')}</td>
                      <td>{toVnd(subtotal || 890)}</td>
                      <td>{order.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside>
            <div className="sb-panel sb-sticky">
              <h3>Tom tat don hang</h3>
              <div className="sb-order-item">
                <span>So luong sach:</span>
                <b>{items.length}</b>
              </div>
              <div className="sb-order-item">
                <span>Tam tinh</span>
                <b>{toVnd(subtotal)}</b>
              </div>
              <div className="sb-order-item">
                <span>Phi van chuyen</span>
                <b>Mien phi</b>
              </div>
              <div className="sb-total-line">
                <span>Tong cong</span>
                <b>{toVnd(subtotal)}</b>
              </div>

              <button type="button" onClick={confirmOrder} disabled={loading || !items.length}>
                Xac nhan dat hang
              </button>
              {notice ? <p className="sb-notice">{notice}</p> : null}
              {error ? <p className="sb-inline-error">{error}</p> : null}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
