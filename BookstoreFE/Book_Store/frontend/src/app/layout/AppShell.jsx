import { NavLink } from 'react-router-dom';

const navItems = [
  ['/', 'Dashboard'],
  ['/books', 'Books'],
  ['/customers', 'Customers'],
  ['/cart', 'Cart'],
  ['/orders', 'Orders'],
  ['/payments', 'Payments'],
  ['/shipments', 'Shipments'],
  ['/reviews', 'Reviews'],
  ['/categories', 'Categories'],
  ['/managers', 'Managers'],
  ['/staff', 'Staff'],
  ['/recommendations', 'AI Picks'],
];

export default function AppShell({ children }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <h2>Book Store Ops</h2>
        <p>Scalable admin frontend</p>
        <nav>
          {navItems.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
