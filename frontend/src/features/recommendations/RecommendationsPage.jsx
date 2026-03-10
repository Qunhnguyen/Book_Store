import { useEffect, useState } from 'react';
import { get, getErrorMessage, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function RecommendationsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      setError('');
      const data = await get(`${urls.recommender}/recommendations/`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader
        title="AI Recommendations"
        subtitle="Top in-stock books returned by recommender service."
        actions={<button onClick={load}>Refresh</button>}
      />
      <AlertBox message={error} />
      <SectionCard title="Suggested Books">
        {!rows.length ? (
          <EmptyState message="No recommendations available." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'title', label: 'Title' },
              { key: 'author', label: 'Author' },
              { key: 'price', label: 'Price' },
              { key: 'stock', label: 'Stock' },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </>
  );
}
