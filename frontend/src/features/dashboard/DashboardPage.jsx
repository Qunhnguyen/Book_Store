import { useEffect, useState } from 'react';
import { get, urls } from '../../api/client';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';
import StatCard from '../../shared/components/StatCard';
import AlertBox from '../../shared/components/AlertBox';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    books: 0,
    customers: 0,
    orders: 0,
    reviews: 0,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setError('');
        const [books, customers, orders, reviews] = await Promise.all([
          get(`${urls.book}/books/`),
          get(`${urls.customer}/customers/`),
          get(`${urls.order}/orders/`),
          get(`${urls.review}/reviews/`),
        ]);
        setStats({
          books: Array.isArray(books) ? books.length : 0,
          customers: Array.isArray(customers) ? customers.length : 0,
          orders: Array.isArray(orders) ? orders.length : 0,
          reviews: Array.isArray(reviews) ? reviews.length : 0,
        });
      } catch {
        setError('Cannot fetch one or more services. Please verify docker-compose is running.');
      }
    }

    load();
  }, []);

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Overview of bookstore services and transaction volume."
      />
      <AlertBox message={error} />
      <div className="grid-4">
        <StatCard label="Books" value={stats.books} tone="blue" />
        <StatCard label="Customers" value={stats.customers} tone="teal" />
        <StatCard label="Orders" value={stats.orders} tone="gold" />
        <StatCard label="Reviews" value={stats.reviews} tone="red" />
      </div>
      <SectionCard title="Architecture">
        <p>
          Frontend is split by features, with shared UI components and centralized API client.
          This makes it easier to scale screens and teams.
        </p>
      </SectionCard>
    </>
  );
}
