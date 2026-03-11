import { useMemo, useState } from 'react';

function toVnd(value) {
  return `${Math.round(Number(value || 0) * 1000).toLocaleString('vi-VN')}d`;
}

const menuItems = [
  { id: 'overview', label: 'Tong quan', icon: '◫' },
  { id: 'books', label: 'Quan ly Sach', icon: '▣' },
  { id: 'categories', label: 'Danh muc', icon: '◈' },
  { id: 'customers', label: 'Khach hang', icon: '◉' },
  { id: 'orders', label: 'Don hang', icon: '🛒' },
  { id: 'reviews', label: 'Danh gia', icon: '★' },
  { id: 'settings', label: 'Cai dat', icon: '⚙' },
];

const kpis = [
  { id: 1, icon: '⦿', delta: '+12.5%', label: 'Doanh thu', value: '45.000.000d', tone: 'up' },
  { id: 2, icon: '◫', delta: '+8.2%', label: 'Tong don hang', value: '1,250', tone: 'up' },
  { id: 3, icon: '▣', delta: '-2.4%', label: 'Sach trong kho', value: '3,420', tone: 'down' },
  { id: 4, icon: '◔', delta: '+15.0%', label: 'Khach hang moi', value: '128', tone: 'up' },
];

const orders = [
  { id: '#BK001', initials: 'NA', customer: 'Nguyen Van A', date: '10/10/2023', total: 450, status: 'Hoan thanh', tone: 'ok' },
  { id: '#BK002', initials: 'TB', customer: 'Tran Thi B', date: '10/10/2023', total: 1200, status: 'Dang xu ly', tone: 'info' },
  { id: '#BK003', initials: 'LC', customer: 'Le Van C', date: '09/10/2023', total: 320, status: 'Da huy', tone: 'muted' },
  { id: '#BK004', initials: 'PD', customer: 'Pham Thi D', date: '09/10/2023', total: 890, status: 'Hoan thanh', tone: 'ok' },
  { id: '#BK005', initials: 'HE', customer: 'Hoang Van E', date: '08/10/2023', total: 560, status: 'Dang giao', tone: 'warn' },
];

const notices = [
  'Cap nhat chinh sach hoan tien tu ngay 01/11/2023.',
  'Bao tri he thong vao luc 02:00 AM ngay mai.',
];

const initialCustomers = [
  { id: 1, initials: 'AJ', name: 'Alice Johnson', email: 'alice.j@example.com', registeredAt: 'Oct 12, 2023', totalOrders: 24, status: 'Active', tone: 'ok' },
  { id: 2, initials: 'BS', name: 'Bob Smith', email: 'bob.smith@provider.net', registeredAt: 'Nov 05, 2023', totalOrders: 12, status: 'Active', tone: 'ok' },
  { id: 3, initials: 'CB', name: 'Charlie Brown', email: 'charles.b@webmail.com', registeredAt: 'Dec 01, 2023', totalOrders: 0, status: 'New', tone: 'info' },
  { id: 4, initials: 'DP', name: 'Diana Prince', email: 'diana.p@service.com', registeredAt: 'Jan 15, 2024', totalOrders: 42, status: 'VIP', tone: 'vip' },
  { id: 5, initials: 'EN', name: 'Edward Norton', email: 'ed.norton@email.com', registeredAt: 'Feb 20, 2024', totalOrders: 2, status: 'Inactive', tone: 'muted' },
  { id: 6, initials: 'FM', name: 'Fiona Miller', email: 'fiona.miller@store.com', registeredAt: 'Mar 01, 2024', totalOrders: 8, status: 'Active', tone: 'ok' },
];

export default function AdminShowcasePage() {
  const [activeMenu, setActiveMenu] = useState('overview');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerFilter, setCustomerFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return orders;
    }

    return orders.filter((order) => `${order.id} ${order.customer} ${order.status}`.toLowerCase().includes(term));
  }, [query]);

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

  function openMenu(menuId) {
    setActiveMenu(menuId);
    setQuery('');
    setCustomerFilter('all');
    setCustomerPage(1);
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
    window.alert(`Exported ${filteredCustomers.length} customers (demo).`);
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
          {kpis.map((item) => (
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
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
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
          {activeMenu === 'customers' ? renderCustomers() : renderOverview()}
        </main>
      </div>
    </div>
  );
}
