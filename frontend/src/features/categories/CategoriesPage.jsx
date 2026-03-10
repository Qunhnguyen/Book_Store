import { useEffect, useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function CategoriesPage() {
  const [name, setName] = useState('');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  async function loadCategories() {
    try {
      setError('');
      const data = await get(`${urls.catalog}/categories/`);
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function createCategory(e) {
    e.preventDefault();
    try {
      setError('');
      await post(`${urls.catalog}/categories/`, { name });
      setName('');
      await loadCategories();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Categories" subtitle="Product grouping catalog." />
      <AlertBox message={error} />
      <SectionCard title="Create Category">
        <form className="row" onSubmit={createCategory}>
          <input required placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit">Create</button>
        </form>
      </SectionCard>
      <SectionCard title="Category List">
        {!categories.length ? (
          <EmptyState message="No categories yet." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'name', label: 'Name' },
            ]}
            rows={categories}
          />
        )}
      </SectionCard>
    </>
  );
}
