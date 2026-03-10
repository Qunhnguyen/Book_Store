import { useEffect, useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '' });

  async function loadCustomers() {
    try {
      setError('');
      const data = await get(`${urls.customer}/customers/`);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await post(`${urls.customer}/customers/`, form);
      setForm({ name: '', email: '' });
      await loadCustomers();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="Customer registry and onboarding." />
      <AlertBox message={error} />
      <SectionCard title="Create Customer">
        <form className="form-grid" onSubmit={handleSubmit}>
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <button type="submit">Create Customer</button>
        </form>
      </SectionCard>
      <SectionCard title="Customer List">
        {!customers.length ? (
          <EmptyState message="No customers yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
            ]}
            rows={customers}
          />
        )}
      </SectionCard>
    </>
  );
}
