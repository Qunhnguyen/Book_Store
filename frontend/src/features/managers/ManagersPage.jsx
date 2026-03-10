import { useEffect, useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function ManagersPage() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [managers, setManagers] = useState([]);
  const [error, setError] = useState('');

  async function loadManagers() {
    try {
      setError('');
      const data = await get(`${urls.manager}/managers/`);
      setManagers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadManagers();
  }, []);

  async function createManager(e) {
    e.preventDefault();
    try {
      setError('');
      await post(`${urls.manager}/managers/`, form);
      setForm({ name: '', email: '' });
      await loadManagers();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Managers" subtitle="Internal manager profiles." />
      <AlertBox message={error} />
      <SectionCard title="Create Manager">
        <form className="form-grid" onSubmit={createManager}>
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <button type="submit">Create</button>
        </form>
      </SectionCard>
      <SectionCard title="Manager List">
        {!managers.length ? (
          <EmptyState message="No manager records." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
            ]}
            rows={managers}
          />
        )}
      </SectionCard>
    </>
  );
}
