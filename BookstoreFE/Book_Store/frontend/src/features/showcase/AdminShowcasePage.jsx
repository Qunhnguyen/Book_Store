import { useEffect, useMemo, useState } from 'react';
import { BooksApi, OrdersApi, CustomersApi, ReviewsApi, CategoriesApi, PaymentsApi, ShipmentsApi, getErrorMessage } from '../../api/client';

function toVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}d`;
}

const menuItems = [
  { id: 'overview', label: 'Tong quan', icon: '◫' },
  { id: 'books', label: 'Quan ly Sach', icon: '▣' },
  { id: 'categories', label: 'Danh muc', icon: '◈' },
  { id: 'customers', label: 'Khach hang', icon: '◉' },
  { id: 'orders', label: 'Don hang', icon: '🛒' },
  { id: 'payments', label: 'Thanh toan', icon: '💳' },
  { id: 'shipments', label: 'Van chuyen', icon: '🚚' },
  { id: 'reviews', label: 'Danh gia', icon: '★' },
  { id: 'settings', label: 'Cai dat', icon: '⚙' },
];

const notices = [
  'Cap nhat chinh sach hoan tien tu ngay 01/11/2023.',
  'Bao tri he thong vao luc 02:00 AM ngay mai.',
];

const initialBookForm = {
  title: '',
  author: '',
  price: '',
  stock: '',
};

function bookCode(id) {
  const safe = Number(id);
  return `B${String(Number.isFinite(safe) ? Math.max(0, Math.trunc(safe)) : 0).padStart(3, '0')}`;
}

function formatBookPrice(value) {
  return `${(Number(value) || 0).toLocaleString('vi-VN')}d`;
}

export default function AdminShowcasePage() {
  const [activeMenu, setActiveMenu] = useState('overview');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [payments, setPayments] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerFilter, setCustomerFilter] = useState('all');
  const [books, setBooks] = useState([]);
  const [bookQuery, setBookQuery] = useState('');
  const [bookPage, setBookPage] = useState(1);
  const [bookLowStockOnly, setBookLowStockOnly] = useState(false);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);
  const [bookForm, setBookForm] = useState(initialBookForm);
  const [bookError, setBookError] = useState('');
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyText, setReplyText] = useState('');

  const dynamicOrders = useMemo(() => {
    return orders.map(order => ({
      id: `#ORD${String(order.id).padStart(3, '0')}`,
      rawId: order.id,
      customer: `Customer ${order.customer_id || 'Unknown'}`,
      initials: 'CU',
      date: new Date(order.created_at || Date.now()).toLocaleDateString('vi-VN'),
      total: Number(order.total_price || 0),
      status: order.status || 'Hoan thanh',
      tone: order.status === 'pending' ? 'info' : 'ok'
    }));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return dynamicOrders;
    return dynamicOrders.filter((order) => `${order.id} ${order.customer} ${order.status}`.toLowerCase().includes(term));
  }, [query, dynamicOrders]);

  const dynamicKpis = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const newCustomers = customers.filter(c => {
      const date = new Date(c.created_at || Date.now());
      const now = new Date();
      return (now - date) / (1000 * 60 * 60 * 24) <= 30; // 30 days
    }).length || customers.length; // Fallback to all if no created_at

    return [
      { id: 1, icon: '⦿', delta: '', label: 'Doanh thu', value: toVnd(revenue), tone: 'up' },
      { id: 2, icon: '◫', delta: '', label: 'Tong don hang', value: orders.length.toLocaleString(), tone: 'up' },
      { id: 3, icon: '▣', delta: '', label: 'Khach hang moi', value: newCustomers.toLocaleString(), tone: 'up' },
      { id: 4, icon: '◈', delta: '', label: 'Tong danh muc', value: categories.length.toLocaleString(), tone: 'up' },
    ];
  }, [orders, customers, categories]);

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();

    return customers.filter((customer) => {
      const textPass = !term || `${customer.name} ${customer.email} ${customer.status}`.toLowerCase().includes(term);
      const statusPass = customerFilter === 'all' || customer.status.toLowerCase() === customerFilter;
      return textPass && statusPass;
    });
  }, [customerFilter, customers, query]);

  const pagedCustomers = useMemo(() => {
    const start = (customerPage - 1) * 5;
    return filteredCustomers.slice(start, start + 5);
  }, [customerPage, filteredCustomers]);

  const totalCustomerPages = Math.max(1, Math.ceil(filteredCustomers.length / 5));

  const filteredBooks = useMemo(() => {
    const term = bookQuery.trim().toLowerCase();

    return books.filter((book) => {
      const stockPass = !bookLowStockOnly || Number(book.stock) <= 20;
      if (!stockPass) {
        return false;
      }

      if (!term) {
        return true;
      }

      const text = `${bookCode(book.id)} ${book.title || ''} ${book.author || ''}`.toLowerCase();
      return text.includes(term);
    });
  }, [bookLowStockOnly, bookQuery, books]);

  const totalBookPages = Math.max(1, Math.ceil(filteredBooks.length / 4));
  const currentBookPage = Math.min(bookPage, totalBookPages);

  const pagedBooks = useMemo(() => {
    const start = (currentBookPage - 1) * 4;
    return filteredBooks.slice(start, start + 4);
  }, [currentBookPage, filteredBooks]);

  const bookInventoryValue = useMemo(
    () => books.reduce((sum, book) => sum + (Number(book.price) || 0) * (Number(book.stock) || 0), 0),
    [books],
  );

  const lowStockCount = useMemo(
    () => books.filter((book) => Number(book.stock) <= 20).length,
    [books],
  );

  // Group reviews by book
  const reviewsByBook = useMemo(() => {
    const grouped = {};
    reviews.forEach(review => {
      const bookId = review.book_id;
      if (!grouped[bookId]) {
        const book = books.find(b => Number(b.id) === Number(bookId));
        grouped[bookId] = {
          book: book || { title: `Unknown Book #${bookId}` },
          reviews: []
        };
      }
      grouped[bookId].reviews.push(review);
    });
    return Object.values(grouped);
  }, [reviews, books]);

  useEffect(() => {
    async function loadData() {
      try {
        setBookError('');
        const [
          booksData,
          ordersData,
          customersData,
          categoriesData,
          reviewsData,
          paymentsData,
          shipmentsData
        ] = await Promise.all([
          BooksApi.list(),
          OrdersApi.list(),
          CustomersApi.list(),
          CategoriesApi.list(),
          ReviewsApi.list(),
          PaymentsApi.list(),
          ShipmentsApi.list()
        ]);

        setBooks(Array.isArray(booksData) ? booksData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setReviews(Array.isArray(reviewsData) ? reviewsData : []);
        
        const paymentsList = Array.isArray(paymentsData) ? paymentsData : [];
        const shipmentsList = Array.isArray(shipmentsData) ? shipmentsData : [];
        
        setPayments(paymentsList);
        setShipments(shipmentsList);
        
        const enrichedOrders = (Array.isArray(ordersData) ? ordersData : []).map(order => {
          const payment = paymentsList.find(p => p.order_id === order.id) || null;
          const shipment = shipmentsList.find(s => s.order_id === order.id) || null;
          return { ...order, payment, shipment };
        });
        setOrders(enrichedOrders);

      } catch (error) {
        setBookError(getErrorMessage(error));
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    setBookPage(1);
  }, [bookLowStockOnly, bookQuery]);

  useEffect(() => {
    if (bookPage > totalBookPages) {
      setBookPage(totalBookPages);
    }
  }, [bookPage, totalBookPages]);

  function openMenu(menuId) {
    setActiveMenu(menuId);
    setQuery('');
    setCustomerFilter('all');
    setCustomerPage(1);
  }

  function openCreateBookModal() {
    setEditingBookId(null);
    setBookForm(initialBookForm);
    setBookModalOpen(true);
  }

  function openEditBookModal(book) {
    setEditingBookId(book.id);
    setBookForm({
      title: book.title || '',
      author: book.author || '',
      price: String(book.price ?? ''),
      stock: String(book.stock ?? ''),
    });
    setBookModalOpen(true);
  }

  function closeBookModal() {
    setBookModalOpen(false);
    setEditingBookId(null);
    setBookForm(initialBookForm);
  }

  async function saveBook(event) {
    event.preventDefault();

    try {
      const price = Number(bookForm.price);
      const stock = Number(bookForm.stock);

      if (!bookForm.title.trim() || !bookForm.author.trim()) {
        setBookError('Vui long nhap day du tieu de va tac gia.');
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        setBookError('Gia ban khong hop le.');
        return;
      }

      if (!Number.isFinite(stock) || stock < 0) {
        setBookError('Ton kho khong hop le.');
        return;
      }

      setBookError('');

      const payload = {
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        price,
        stock: Math.trunc(stock),
      };

      if (editingBookId) {
        await BooksApi.update(editingBookId, payload);
        setBooks((current) => current.map((book) => (book.id === editingBookId ? { ...book, ...payload } : book)));
      } else {
        const created = await BooksApi.create(payload);
        if (created && typeof created === 'object') {
          setBooks((current) => [created, ...current]);
        } else {
          const latest = await BooksApi.list();
          setBooks(Array.isArray(latest) ? latest : []);
        }
      }

      closeBookModal();
    } catch (error) {
      setBookError(getErrorMessage(error));
    }
  }

  async function removeBook(bookId) {
    try {
      setBookError('');
      await BooksApi.remove(bookId);
      setBooks((current) => current.filter((book) => book.id !== bookId));
    } catch (error) {
      setBookError(getErrorMessage(error));
    }
  }

  function toggleCustomerFilter() {
    setCustomerFilter((current) => {
      if (current === 'all') {
        return 'active';
      }

      if (current === 'active') {
        return 'vip';
      }

      return 'all';
    });
    setCustomerPage(1);
  }

  function addNewCustomer() {
    const nextId = customers.length + 1;
    setCustomers((current) => [
      {
        id: nextId,
        initials: 'NC',
        name: `New Customer ${nextId}`,
        email: `new.customer${nextId}@bookstore.vn`,
        registeredAt: 'Mar 11, 2026',
        totalOrders: 0,
        status: 'New',
        tone: 'info',
      },
      ...current,
    ]);
    setCustomerPage(1);
  }

  function exportCustomers() {
    window.alert(`Exported ${filteredCustomers.length} customers.`);
  }

  async function updateOrderStatus(orderId, newStatus) {
    try {
      await OrdersApi.updateStatus(orderId, newStatus);
      setOrders((current) =>
        current.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      window.alert(`Loi khi cap nhat trang thai: ${getErrorMessage(err)}`);
    }
  }

  async function confirmOrder(orderId) {
    try {
      await OrdersApi.confirm(orderId);
      setOrders((current) =>
        current.map((o) => (o.id === orderId ? { ...o, status: 'CONFIRMED' } : o))
      );
    } catch (err) {
      window.alert(`Loi khi duyet don hang: ${getErrorMessage(err)}`);
    }
  }

  async function approvePayment(orderId, isApproved) {
    try {
      await PaymentsApi.approve(orderId, isApproved);
      // Optimistically update
      setOrders(current => current.map(o => {
        if (o.id === orderId && o.payment) {
          return { ...o, payment: { ...o.payment, status: isApproved ? 'PAID' : 'FAILED' } };
        }
        return o;
      }));
      setPayments(current => current.map(p => {
        if (p.order_id === orderId) {
          return { ...p, status: isApproved ? 'PAID' : 'FAILED' };
        }
        return p;
      }));
    } catch (err) {
      window.alert(`Loi khi duyet thanh toan: ${getErrorMessage(err)}`);
    }
  }

  async function approveShipment(orderId, isApproved) {
    try {
      await ShipmentsApi.approve(orderId, isApproved);
      // Optimistically update
      setOrders(current => current.map(o => {
        if (o.id === orderId && o.shipment) {
          return { ...o, shipment: { ...o.shipment, status: isApproved ? 'RESERVED' : 'FAILED' } };
        }
        return o;
      }));
      setShipments(current => current.map(s => {
        if (s.order_id === orderId) {
          return { ...s, status: isApproved ? 'RESERVED' : 'FAILED' };
        }
        return s;
      }));
    } catch (err) {
      window.alert(`Loi khi duyet van chuyen: ${getErrorMessage(err)}`);
    }
  }

  async function submitReplyReview(reviewId) {
    if (!replyText.trim()) {
      window.alert("Vui long nhap noi dung phan hoi.");
      return;
    }
    try {
      await ReviewsApi.reply(reviewId, replyText);
      setReviews(current => current.map(r => r.id === reviewId ? { ...r, admin_reply: replyText } : r));
      setReplyingReviewId(null);
      setReplyText('');
    } catch (err) {
      window.alert(`Loi khi phan hoi: ${getErrorMessage(err)}`);
    }
  }

  function openReplyForm(reviewId, currentReply) {
    setReplyingReviewId(reviewId);
    setReplyText(currentReply || '');
  }

  function renderOrders() {
    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Quan ly Don hang</h1>
            <p className="sb-admin-lite-subtitle">Theo doi va xu ly don hang tu khach hang</p>
          </div>
          <div className="sb-admin-lite-topbar-actions">
            <button type="button" className="sb-admin-lite-primary" onClick={() => window.alert('Exporting orders...')}>
              Export excel
            </button>
          </div>
        </header>

        <section className="sb-admin-lite-panel sb-admin-lite-customers-panel">
          <div className="sb-admin-lite-panel-head sb-admin-lite-panel-head-stack">
            <div className="sb-admin-lite-customers-toolbar">
              <label className="sb-admin-lite-search wide">
                <span>⌕</span>
                <input
                  placeholder="Tim kiem ma don, khach hang..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div style={{ padding: '8px 16px', background: '#f8f9fd', borderRadius: '8px', fontWeight: 'bold' }}>
              Tong cong: {dynamicOrders.length} don hang
            </div>
          </div>

          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table">
              <thead>
                <tr>
                  <th>MA DON</th>
                  <th>KHACH HANG</th>
                  <th>THONG TIN TT/VC</th>
                  <th>TONG TIEN</th>
                  <th>TRANG THAI</th>
                  <th>THAO TAC</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                  <tr key={order.rawId}>
                    <td className="sb-admin-lite-order-id">{order.id}</td>
                    <td>
                      <div className="sb-admin-lite-customer-cell">
                        <span className="sb-admin-lite-initials tone-0">{order.initials}</span>
                        <span>{order.customer}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>
                          <strong>TT:</strong> {order.payment ? (
                            <span className={`sb-admin-lite-status ${order.payment.status === 'PAID' ? 'ok' : order.payment.status === 'FAILED' ? 'warn' : 'info'}`} style={{ transform: 'scale(0.8)', padding: '2px 6px' }}>
                              {order.payment.status}
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>Chua co</span>}
                        </div>
                        <div>
                          <strong>VC:</strong> {order.shipment ? (
                            <span className={`sb-admin-lite-status ${order.shipment.status === 'RESERVED' ? 'ok' : order.shipment.status === 'FAILED' ? 'warn' : 'info'}`} style={{ transform: 'scale(0.8)', padding: '2px 6px' }}>
                              {order.shipment.status}
                            </span>
                          ) : <span style={{ color: '#94a3b8' }}>Chua co</span>}
                        </div>
                      </div>
                    </td>
                    <td><strong>{toVnd(order.total)}</strong></td>
                    <td>
                      <span className={`sb-admin-lite-status ${
                        order.status === 'CONFIRMED' ? 'ok' :
                        order.status === 'AWAITING_CONFIRMATION' ? 'info' :
                        order.status === 'CANCELLED' || order.status === 'FAILED' ? 'warn' : 'info'
                      }`}>{order.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {order.status === 'AWAITING_CONFIRMATION' && (
                          <button
                            type="button"
                            onClick={() => confirmOrder(order.rawId)}
                            style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            ✅ Duyet don
                          </button>
                        )}
                        {order.payment?.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => approvePayment(order.rawId, true)}
                              style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Duyet TT
                            </button>
                            <button
                              type="button"
                              onClick={() => approvePayment(order.rawId, false)}
                              style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Huy TT
                            </button>
                          </>
                        )}
                        {order.shipment?.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => approveShipment(order.rawId, true)}
                              style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#8b5cf6', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Duyet VC
                            </button>
                            <button
                              type="button"
                              onClick={() => approveShipment(order.rawId, false)}
                              style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Huy VC
                            </button>
                          </>
                        )}
                        {order.status !== 'AWAITING_CONFIRMATION' && (!order.payment || order.payment.status !== 'PENDING') && (!order.shipment || order.shipment.status !== 'PENDING') && (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                            {order.status === 'CONFIRMED' ? 'Da xu ly' :
                             order.status === 'CANCELLED' ? 'Da huy' :
                             order.status === 'FAILED' ? 'That bai' : 'Dang xu ly...'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Khong co don hang nao.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderCategories() {
    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Danh muc San pham</h1>
            <p className="sb-admin-lite-subtitle">Quan ly cac danh muc sach</p>
          </div>
          <div className="sb-admin-lite-topbar-actions">
            <button type="button" className="sb-admin-lite-primary" onClick={() => window.alert('Them danh muc chua duoc ho tro trong demo nay.')}>
              + Them Danh muc
            </button>
          </div>
        </header>

        <section className="sb-admin-lite-panel sb-admin-lite-customers-panel">
          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table">
              <thead>
                <tr>
                  <th>MA DANH MUC</th>
                  <th>TEN DANH MUC</th>
                  <th>MO TA</th>
                </tr>
              </thead>
              <tbody>
                {categories.length > 0 ? categories.map((cat) => (
                  <tr key={cat.id}>
                    <td><strong>#{cat.id}</strong></td>
                    <td>{cat.name}</td>
                    <td>{cat.description || 'Khong co mo ta'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>Chua co danh muc nao.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderReviews() {
    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Danh gia & Binh luan</h1>
            <p className="sb-admin-lite-subtitle">Xem chi tiet tat ca nhan xet cua khach hang theo tung dau sach</p>
          </div>
        </header>

        {reviewsByBook.length > 0 ? reviewsByBook.map(group => (
          <section key={group.book.id || Math.random()} className="sb-admin-lite-panel sb-admin-lite-customers-panel" style={{ marginBottom: '24px' }}>
            <div className="sb-admin-lite-panel-head">
              <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>📖</span> 
                {group.book.title}
              </h2>
              <span className="sb-admin-lite-status info">{group.reviews.length} Danh gia</span>
            </div>
            <div className="sb-admin-lite-table-wrap">
              <table className="sb-admin-lite-table">
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>KHACH HANG</th>
                    <th style={{ width: '100px' }}>RATING</th>
                    <th>BINH LUAN</th>
                    <th style={{ width: '120px' }}>THAO TAC</th>
                  </tr>
                </thead>
                <tbody>
                  {group.reviews.map(review => (
                    <tr key={review.id}>
                      <td><strong>KH {review.customer_id}</strong></td>
                      <td><span style={{ color: '#fbbf24', fontSize: '16px' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></td>
                      <td>
                        <p style={{ margin: 0, color: '#454d64', fontStyle: 'italic' }}>"{review.comment || 'Khong co binh luan.'}"</p>
                        {review.admin_reply && replyingReviewId !== review.id && (
                          <div style={{ marginTop: '8px', padding: '8px', background: '#f8f9fd', borderLeft: '3px solid #3b82f6', fontSize: '13px' }}>
                            <strong>Phan hoi tu Admin:</strong> {review.admin_reply}
                          </div>
                        )}
                        {replyingReviewId === review.id && (
                          <div style={{ marginTop: '8px', padding: '8px', background: '#f8f9fd', border: '1px solid #d0d4e8', borderRadius: '4px' }}>
                            <textarea
                              rows="3"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Nhap phan hoi..."
                              style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '8px', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button type="button" onClick={() => submitReplyReview(review.id)} style={{ padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Gửi</button>
                              <button type="button" onClick={() => setReplyingReviewId(null)} style={{ padding: '4px 12px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Hủy</button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                          <button type="button" className="sb-admin-lite-primary" onClick={() => openReplyForm(review.id, review.admin_reply)} style={{ padding: '4px 8px', fontSize: '11px' }}>{review.admin_reply ? 'Sua phan hoi' : 'Tra loi'}</button>
                          <button type="button" className="sb-admin-lite-danger" onClick={() => window.alert('Xoa binh luan...')} style={{ padding: '4px 8px', fontSize: '11px' }}>Xoa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )) : (
          <div className="sb-admin-lite-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Chua co danh gia nao</h2>
            <p>Khach hang be ngoan tu tu roi se binh luan.</p>
          </div>
        )}
      </>
    );
  }

  function renderPayments() {
    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Quan ly Thanh toan</h1>
            <p className="sb-admin-lite-subtitle">Theo doi giao dich thanh toan don hang</p>
          </div>
        </header>

        <section className="sb-admin-lite-panel sb-admin-lite-customers-panel">
          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table">
              <thead>
                <tr>
                  <th>MA TT</th>
                  <th>MA DON HANG</th>
                  <th>PHUONG THUC</th>
                  <th>NHA CUNG CAP</th>
                  <th>TRANG THAI</th>
                  <th>THAO TAC</th>
                </tr>
              </thead>
              <tbody>
                {payments.length > 0 ? payments.map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>#{payment.id}</strong></td>
                    <td>#{payment.order_id}</td>
                    <td>{payment.method || 'Unknown'}</td>
                    <td>{payment.provider || 'N/A'}</td>
                    <td>
                      <span className={`sb-admin-lite-status ${
                        payment.status === 'PAID' ? 'ok' :
                        payment.status === 'FAILED' ? 'warn' : 'info'
                      }`}>{payment.status}</span>
                    </td>
                    <td>
                      {payment.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => approvePayment(payment.order_id, true)}
                            style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Duyet
                          </button>
                          <button
                            type="button"
                            onClick={() => approvePayment(payment.order_id, false)}
                            style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Huy
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Da xu ly</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>Chua co thanh toan nao.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderShipments() {
    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Quan ly Van chuyen</h1>
            <p className="sb-admin-lite-subtitle">Theo doi don vi van chuyen</p>
          </div>
        </header>

        <section className="sb-admin-lite-panel sb-admin-lite-customers-panel">
          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table">
              <thead>
                <tr>
                  <th>MA VC</th>
                  <th>MA DON HANG</th>
                  <th>DIA CHI GIAO</th>
                  <th>TRANG THAI</th>
                  <th>THAO TAC</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length > 0 ? shipments.map((shipment) => (
                  <tr key={shipment.id}>
                    <td><strong>#{shipment.id}</strong></td>
                    <td>#{shipment.order_id}</td>
                    <td>{shipment.address || 'N/A'}</td>
                    <td>
                      <span className={`sb-admin-lite-status ${
                        shipment.status === 'RESERVED' || shipment.status === 'DELIVERED' ? 'ok' :
                        shipment.status === 'FAILED' ? 'warn' : 'info'
                      }`}>{shipment.status}</span>
                    </td>
                    <td>
                      {shipment.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => approveShipment(shipment.order_id, true)}
                            style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#8b5cf6', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Duyet
                          </button>
                          <button
                            type="button"
                            onClick={() => approveShipment(shipment.order_id, false)}
                            style={{ padding: '5px 8px', borderRadius: '4px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Huy
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Da xu ly</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Chua co don van chuyen nao.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function renderOverview() {
    return (
      <>
        <header className="sb-admin-lite-topbar">
          <h1>Tong quan he thong</h1>
          <div className="sb-admin-lite-topbar-actions">
            <label className="sb-admin-lite-search">
              <span>⌕</span>
              <input
                placeholder="Tim kiem sach, don hang..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button type="button" className="sb-admin-lite-icon">🔔</button>
            <button type="button" className="sb-admin-lite-icon">?</button>
          </div>
        </header>

        <section className="sb-admin-lite-kpis">
          {dynamicKpis.map((item) => (
            <article key={item.id} className="sb-admin-lite-kpi">
              <div className="sb-admin-lite-kpi-head">
                <span className="sb-admin-lite-kpi-icon">{item.icon}</span>
                <small className={item.tone}>{item.delta}</small>
              </div>
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="sb-admin-lite-panel">
          <div className="sb-admin-lite-panel-head">
            <h2>Don hang gan day</h2>
            <button type="button">Xem tat ca</button>
          </div>

          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table">
              <thead>
                <tr>
                  <th>MA DON</th>
                  <th>KHACH HANG</th>
                  <th>NGAY DAT</th>
                  <th>TONG TIEN</th>
                  <th>TRANG THAI</th>
                  <th>THAO TAC</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice(0, 5).map((order) => (
                  <tr key={order.rawId || order.id}>
                    <td className="sb-admin-lite-order-id">{order.id}</td>
                    <td>
                      <div className="sb-admin-lite-customer-cell">
                        <span className="sb-admin-lite-initials">{order.initials}</span>
                        <span>{order.customer}</span>
                      </div>
                    </td>
                    <td>{order.date}</td>
                    <td><strong>{toVnd(order.total)}</strong></td>
                    <td>
                      <span className={`sb-admin-lite-status ${order.tone}`}>{order.status}</span>
                    </td>
                    <td>
                      <button type="button" className="sb-admin-lite-view">◉</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sb-admin-lite-bottom-grid">
          <article className="sb-admin-lite-panel sb-admin-lite-highlight">
            <h2>Thong ke ton kho</h2>
            <p>Hien co 15 dau sach sap het hang trong kho. Vui long kiem tra va nhap them hang.</p>
            <button type="button" className="sb-admin-lite-primary">Nhap hang ngay</button>
          </article>

          <article className="sb-admin-lite-panel">
            <h2>Thong bao moi nhat</h2>
            <ul className="sb-admin-lite-notices">
              {notices.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      </>
    );
  }

  function renderCustomers() {
    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Customer Management</h1>
            <p className="sb-admin-lite-subtitle">Customer Directory</p>
            <small>Review and manage your bookstore&apos;s registered members.</small>
          </div>
          <div className="sb-admin-lite-topbar-actions">
            <button type="button" className="sb-admin-lite-icon">🔔</button>
            <div className="sb-admin-lite-profile-chip">
              <div>
                <strong>Admin User</strong>
                <span>System Manager</span>
              </div>
              <span className="sb-admin-lite-user-avatar small" />
            </div>
          </div>
        </header>

        <section className="sb-admin-lite-panel sb-admin-lite-customers-panel">
          <div className="sb-admin-lite-panel-head sb-admin-lite-panel-head-stack">
            <div className="sb-admin-lite-customers-toolbar">
              <label className="sb-admin-lite-search wide">
                <span>⌕</span>
                <input
                  placeholder="Search by name, email or ID..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="sb-admin-lite-inline-actions">
                <button type="button" className="sb-admin-lite-soft-btn" onClick={toggleCustomerFilter}>
                  Filter
                </button>
                <button type="button" className="sb-admin-lite-soft-btn" onClick={exportCustomers}>
                  Export
                </button>
              </div>
            </div>
            <button type="button" className="sb-admin-lite-primary" onClick={addNewCustomer}>+ Add New Customer</button>
          </div>

          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table sb-admin-lite-customers-table">
              <thead>
                <tr>
                  <th>CUSTOMER NAME</th>
                  <th>EMAIL ADDRESS</th>
                  <th>REGISTRATION DATE</th>
                  <th>TOTAL ORDERS</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="sb-admin-lite-customer-row-full">
                        <span className={`sb-admin-lite-initials tone-${customer.id % 5}`}>{customer.initials}</span>
                        <span>{customer.name}</span>
                      </div>
                    </td>
                    <td>{customer.email}</td>
                    <td>{customer.registeredAt}</td>
                    <td>{customer.totalOrders}</td>
                    <td><span className={`sb-admin-lite-status ${customer.tone}`}>{customer.status}</span></td>
                    <td><button type="button" className="sb-admin-lite-dots">⋮</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sb-admin-lite-table-footer">
            <small>Showing 1 to {pagedCustomers.length} of {filteredCustomers.length} customers</small>
            <div className="sb-admin-lite-pagination">
              <button type="button" onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}>‹</button>
              {Array.from({ length: Math.min(3, totalCustomerPages) }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={page === customerPage ? 'active' : ''}
                  onClick={() => setCustomerPage(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => setCustomerPage((page) => Math.min(totalCustomerPages, page + 1))}>›</button>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderBooks() {
    const start = filteredBooks.length ? (currentBookPage - 1) * 4 + 1 : 0;
    const end = Math.min(currentBookPage * 4, filteredBooks.length);

    return (
      <>
        <header className="sb-admin-lite-topbar sb-admin-lite-topbar-customers">
          <div>
            <h1>Danh sach Sach</h1>
            <p className="sb-admin-lite-subtitle">Quan ly kho va danh muc san pham cua ban</p>
          </div>
          <div className="sb-admin-lite-topbar-actions">
            <button type="button" className="sb-admin-lite-primary" onClick={openCreateBookModal}>
              + Them Sach Moi
            </button>
          </div>
        </header>

        {bookError ? <div className="sb-admin-lite-alert">{bookError}</div> : null}

        <section className="sb-admin-lite-panel sb-admin-lite-customers-panel">
          <div className="sb-admin-lite-panel-head sb-admin-lite-panel-head-stack">
            <div className="sb-admin-lite-customers-toolbar">
              <label className="sb-admin-lite-search wide">
                <span>⌕</span>
                <input
                  placeholder="Tim kiem theo tieu de, tac gia hoac ma sach..."
                  value={bookQuery}
                  onChange={(event) => setBookQuery(event.target.value)}
                />
              </label>
              <div className="sb-admin-lite-inline-actions">
                <button
                  type="button"
                  className="sb-admin-lite-soft-btn"
                  onClick={() => setBookLowStockOnly((state) => !state)}
                >
                  {bookLowStockOnly ? 'Bo loc ton thap' : 'Loc ton thap'}
                </button>
              </div>
            </div>
          </div>

          <div className="sb-admin-lite-table-wrap">
            <table className="sb-admin-lite-table sb-admin-lite-books-table">
              <thead>
                <tr>
                  <th>MA SACH</th>
                  <th>TIEU DE</th>
                  <th>TAC GIA</th>
                  <th>GIA BAN</th>
                  <th>TON KHO</th>
                  <th>THAO TAC</th>
                </tr>
              </thead>
              <tbody>
                {pagedBooks.map((book) => (
                  <tr key={book.id}>
                    <td className="sb-admin-lite-order-id">{bookCode(book.id)}</td>
                    <td>{book.title}</td>
                    <td>{book.author}</td>
                    <td><strong>{formatBookPrice(book.price)}</strong></td>
                    <td>
                      <span className={`sb-admin-lite-status ${Number(book.stock) <= 20 ? 'warn' : 'ok'}`}>
                        {Number(book.stock) || 0}
                      </span>
                    </td>
                    <td>
                      <div className="sb-admin-lite-inline-actions">
                        <button type="button" className="sb-admin-lite-view" onClick={() => openEditBookModal(book)}>Sua</button>
                        <button type="button" className="sb-admin-lite-danger" onClick={() => removeBook(book.id)}>Xoa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sb-admin-lite-table-footer">
            <small>Dang xem {start} den {end} trong so {filteredBooks.length} dau sach</small>
            <div className="sb-admin-lite-pagination">
              <button type="button" onClick={() => setBookPage((page) => Math.max(1, page - 1))}>‹</button>
              {Array.from({ length: Math.min(5, totalBookPages) }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={page === currentBookPage ? 'active' : ''}
                  onClick={() => setBookPage(page)}
                >
                  {page}
                </button>
              ))}
              <button type="button" onClick={() => setBookPage((page) => Math.min(totalBookPages, page + 1))}>›</button>
            </div>
          </div>
        </section>

        <section className="sb-admin-lite-kpis sb-admin-lite-books-kpis">
          <article className="sb-admin-lite-kpi">
            <div className="sb-admin-lite-kpi-head">
              <span className="sb-admin-lite-kpi-icon">▣</span>
            </div>
            <p>Tong so dau sach</p>
            <strong>{books.length.toLocaleString('vi-VN')}</strong>
          </article>
          <article className="sb-admin-lite-kpi">
            <div className="sb-admin-lite-kpi-head">
              <span className="sb-admin-lite-kpi-icon">⚠</span>
            </div>
            <p>Sach sap het hang</p>
            <strong>{lowStockCount.toLocaleString('vi-VN')}</strong>
          </article>
          <article className="sb-admin-lite-kpi">
            <div className="sb-admin-lite-kpi-head">
              <span className="sb-admin-lite-kpi-icon">◍</span>
            </div>
            <p>Gia tri ton kho</p>
            <strong>{formatBookPrice(bookInventoryValue)}</strong>
          </article>
        </section>

        {bookModalOpen ? (
          <div className="sb-admin-lite-modal-backdrop" role="presentation" onClick={closeBookModal}>
            <section className="sb-admin-lite-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <h2>{editingBookId ? `Chinh sua ${bookCode(editingBookId)}` : 'Them Sach Moi'}</h2>
              <form className="sb-admin-lite-book-form" onSubmit={saveBook}>
                <label>
                  Tieu de
                  <input
                    required
                    value={bookForm.title}
                    onChange={(event) => setBookForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </label>
                <label>
                  Tac gia
                  <input
                    required
                    value={bookForm.author}
                    onChange={(event) => setBookForm((current) => ({ ...current, author: event.target.value }))}
                  />
                </label>
                <label>
                  Gia ban
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={bookForm.price}
                    onChange={(event) => setBookForm((current) => ({ ...current, price: event.target.value }))}
                  />
                </label>
                <label>
                  Ton kho
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={bookForm.stock}
                    onChange={(event) => setBookForm((current) => ({ ...current, stock: event.target.value }))}
                  />
                </label>
                <div className="sb-admin-lite-modal-actions">
                  <button type="button" className="sb-admin-lite-soft-btn" onClick={closeBookModal}>Huy</button>
                  <button type="submit" className="sb-admin-lite-primary">{editingBookId ? 'Cap nhat' : 'Them sach'}</button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="sb-page sb-admin-lite">
      <div className="sb-admin-lite-layout">
        <aside className="sb-admin-lite-sidebar">
          <div>
            <div className="sb-admin-lite-brand">
              <div className="sb-admin-lite-logo">📘</div>
              <div>
                <strong>BookStore</strong>
                <span>Quan tri he thong</span>
              </div>
            </div>

            <nav className="sb-admin-lite-nav">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={activeMenu === item.id ? 'active' : ''}
                  onClick={() => openMenu(item.id)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="sb-admin-lite-user">
            <div className="sb-admin-lite-user-avatar" />
            <div>
              <strong>Admin User</strong>
              <span>admin@bookstore.vn</span>
            </div>
          </div>
        </aside>

        <main className="sb-admin-lite-main">
          {activeMenu === 'books' ? renderBooks() : null}
          {activeMenu === 'customers' ? renderCustomers() : null}
          {activeMenu === 'orders' ? renderOrders() : null}
          {activeMenu === 'payments' ? renderPayments() : null}
          {activeMenu === 'shipments' ? renderShipments() : null}
          {activeMenu === 'categories' ? renderCategories() : null}
          {activeMenu === 'reviews' ? renderReviews() : null}
          {activeMenu === 'overview' ? renderOverview() : null}
          {activeMenu === 'settings' ? <div className="sb-admin-lite-panel" style={{ padding: '40px', textAlign: 'center' }}><h2>Cai Dat is under construction</h2></div> : null}
        </main>
      </div>
    </div>
  );
}
