import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BooksApi, CartApi, OrdersApi, PaymentsApi, ShipmentsApi, getErrorMessage } from '../../api/client';
import { useAuth } from '../../app/context/AuthContext';
import './Checkout.css';

function toVnd(value) {
  return `${Math.round(Number(value || 0) * 1000).toLocaleString('vi-VN')}d`;
}

export default function CheckoutShowcasePage() {
  const { user } = useAuth();
  const customerId = user ? (user.customer_id || user.id) : 1;
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
          BooksApi.list(),
          CartApi.listByCustomer(customerId),
          OrdersApi.listByCustomer(customerId),
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
      let nextNotice = 'Order confirmed successfully.';

      const order = await OrdersApi.create(customerId);

      if (!order?.id) {
        throw new Error("Failed to create order.");
      }
      
      // In Phase 4/5/6, Payment and Shipment are created automatically 
      // by the Backend via RabbitMQ Saga Orchestrator. 
      // We do not need to call PaymentsApi.create and ShipmentsApi.create manually.

      const updatedOrders = await OrdersApi.listByCustomer(customerId);
      setOrders(Array.isArray(updatedOrders) ? updatedOrders : []);
      setNotice(nextNotice);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  const navigate = useNavigate();

  return (
    <div className="ck-page">
      <header className="ck-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
          <a href="/" className="ck-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Thanh toán
          </a>
          <nav className="ck-nav">
            <a onClick={() => navigate('/')}>Trang chủ</a>
            <a onClick={() => navigate('/')}>Sản phẩm</a>
            <a className="active">Đơn hàng</a>
          </nav>
        </div>
        <button className="ck-icon-btn" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <main className="ck-main">
        <div className="ck-left-col">
          <div className="ck-panel">
            <div className="ck-panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Địa chỉ giao hàng
            </div>
            
            <div className="ck-form-row">
              <div className="ck-form-group">
                <label className="ck-label">Họ và tên</label>
                <input
                  className="ck-input"
                  placeholder="Nhập họ tên người nhận"
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                />
              </div>
              <div className="ck-form-group">
                <label className="ck-label">Số điện thoại</label>
                <input
                  className="ck-input"
                  placeholder="Nhập số điện thoại"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
            </div>
            <div className="ck-form-group">
              <label className="ck-label">Địa chỉ chi tiết</label>
              <input
                className="ck-input"
                placeholder="Số nhà, tên đường, phường/xã..."
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
          </div>

          <div className="ck-panel">
            <div className="ck-panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              Phương thức thanh toán
            </div>

            <div 
              className={`ck-method-option ${form.paymentMethod === 'COD' ? 'selected' : ''}`}
              onClick={() => setForm({ ...form, paymentMethod: 'COD' })}
            >
              <div className="ck-method-radio">
                <div className="ck-radio-circle"></div>
                <div className="ck-method-text">
                  <strong>Thanh toán khi nhận hàng (COD)</strong>
                  <span>Trả tiền mặt khi nhân viên giao hàng đến tận nhà</span>
                </div>
              </div>
              <div className="ck-method-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                  <path d="M15 18H9" />
                  <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                  <circle cx="17" cy="18" r="2" />
                  <circle cx="7" cy="18" r="2" />
                </svg>
              </div>
            </div>

            <div className="ck-method-option disabled">
              <div className="ck-method-radio">
                <div className="ck-radio-circle"></div>
                <div className="ck-method-text">
                  <strong style={{ color: '#64748b' }}>Chuyển khoản ngân hàng</strong>
                  <span>Đang bảo trì</span>
                </div>
              </div>
              <div className="ck-method-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="6" rx="2" />
                  <path d="M12 12h.01" />
                  <path d="M17 12h.01" />
                  <path d="M7 12h.01" />
                </svg>
              </div>
            </div>
          </div>

          <div className="ck-panel">
            <div className="ck-panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Lịch sử đơn hàng
              <a href="#" className="ck-order-history-link">Xem tất cả</a>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ck-table">
                <thead>
                  <tr>
                    <th>MÃ ĐƠN</th>
                    <th>NGÀY ĐẶT</th>
                    <th>TỔNG TIỀN</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có đơn hàng nào</td>
                    </tr>
                  ) : [...orders].reverse().slice(0, 5).map((order) => {
                    const statusClass =
                      order.status === 'CONFIRMED' ? 'success' :
                      order.status === 'AWAITING_CONFIRMATION' ? 'primary' :
                      order.status === 'PENDING' || order.status === 'INVENTORY_RESERVED' || order.status === 'PAYMENT_RESERVED' ? 'warning' :
                      order.status === 'CANCELLED' || order.status === 'FAILED' ? 'danger' : 'primary';

                    return (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 600 }}>#ORD-{order.id}</td>
                        <td>{new Date().toLocaleDateString('vi-VN')}</td>
                        <td style={{ fontWeight: 600, color: '#1e293b' }}>{toVnd(order.total_price || 0)}</td>
                        <td><span className={`ck-status-pill ${statusClass}`}>{order.status || 'CREATED'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="ck-right-col">
          <div className="ck-panel" style={{ position: 'sticky', top: '100px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px', color: '#1e293b' }}>
              Tóm tắt đơn hàng
            </h3>

            {items.map((item) => {
               const book = books.find((entry) => Number(entry.id) === Number(item.book_id));
               return (
                 <div key={item.id} className="ck-summary-item">
                   {book?.display_image_url ? (
                     <img src={book.display_image_url} alt={book.title} className="ck-summary-item-img" />
                   ) : (
                     <div className="ck-summary-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       📖
                     </div>
                   )}
                   <div className="ck-summary-item-info">
                     <p className="ck-summary-item-title">{book?.title || `Book #${item.book_id}`}</p>
                     <p className="ck-summary-item-qty">Số lượng: {item.quantity}</p>
                     <p className="ck-summary-item-price">{toVnd(book?.price || 0)}</p>
                   </div>
                 </div>
               );
            })}

            <div className="ck-summary-row">
              <span>Tạm tính</span>
              <span>{toVnd(subtotal)}</span>
            </div>
            <div className="ck-summary-row">
              <span>Phí vận chuyển</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Miễn phí</span>
            </div>
            
            <div className="ck-summary-row total">
              <span>Tổng cộng</span>
              <strong>{toVnd(subtotal)}</strong>
            </div>

            <button 
              className="ck-submit-btn" 
              onClick={confirmOrder} 
              disabled={loading || !items.length}
            >
              XÁC NHẬN ĐẶT HÀNG
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" x2="19" y1="12" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            <p className="ck-disclaimer">
              Bằng cách đặt hàng, bạn đồng ý với Điều khoản & Chính sách của chúng tôi.
            </p>

            {notice && <p style={{ color: '#10b981', background: '#dcfce3', padding: '10px', borderRadius: '8px', fontSize: '13px', marginTop: '16px' }}>{notice}</p>}
            {error && <p style={{ color: '#ef4444', background: '#fee2e2', padding: '10px', borderRadius: '8px', fontSize: '13px', marginTop: '16px' }}>{error}</p>}
          </div>

          <div className="ck-support-box">
            <div className="ck-support-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            </div>
            <div className="ck-support-info">
              <h4>Cần hỗ trợ?</h4>
              <p>Liên hệ 1900 1234 (8:00 - 21:00) để được giải đáp nhanh nhất.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="ck-footer">
        © 2024 Thanh Toán Online. All rights reserved.
      </footer>
    </div>
  );
}
