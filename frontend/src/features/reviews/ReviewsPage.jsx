import { useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function ReviewsPage() {
  const [bookId, setBookId] = useState('');
  const [form, setForm] = useState({ customer_id: '', rating: '5', comment: '' });
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState('');

  async function loadReviews() {
    try {
      setError('');
      const data = await get(`${urls.review}/reviews/book/${bookId}/`);
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createReview(e) {
    e.preventDefault();
    try {
      setError('');
      await post(`${urls.review}/reviews/`, {
        customer_id: Number(form.customer_id),
        book_id: Number(bookId),
        rating: Number(form.rating),
        comment: form.comment,
      });
      setForm({ ...form, comment: '' });
      await loadReviews();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Reviews" subtitle="Book rating and customer feedback." />
      <AlertBox message={error} />
      <SectionCard title="Load Reviews">
        <div className="row">
          <input placeholder="Book ID" value={bookId} onChange={(e) => setBookId(e.target.value)} />
          <button onClick={loadReviews} disabled={!bookId}>Load Reviews</button>
        </div>
      </SectionCard>
      <SectionCard title="Create Review">
        <form className="form-grid" onSubmit={createReview}>
          <input required placeholder="Customer ID" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} />
          <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <textarea placeholder="Comment" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          <button type="submit" disabled={!bookId}>Submit Review</button>
        </form>
      </SectionCard>
      <SectionCard title="Review List">
        {!reviews.length ? (
          <EmptyState message="No review data loaded." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'customer_id', label: 'Customer' },
              { key: 'book_id', label: 'Book' },
              { key: 'rating', label: 'Rating' },
              { key: 'comment', label: 'Comment' },
            ]}
            rows={reviews}
          />
        )}
      </SectionCard>
    </>
  );
}
