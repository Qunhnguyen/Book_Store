import { useEffect, useState } from 'react';
import { ReviewsApi, getErrorMessage } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function ReviewsPage() {
  const replyStorageKey = 'bookstore-ops-review-replies';
  const [bookId, setBookId] = useState('');
  const [form, setForm] = useState({ customer_id: '', rating: '5', comment: '' });
  const [reviews, setReviews] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyThreads, setReplyThreads] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const rawData = localStorage.getItem(replyStorageKey);
      if (!rawData) {
        setReplyThreads({});
        return;
      }

      const parsedData = JSON.parse(rawData);
      setReplyThreads(parsedData && typeof parsedData === 'object' ? parsedData : {});
    } catch (_error) {
      setReplyThreads({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(replyStorageKey, JSON.stringify(replyThreads));
    } catch (_error) {
      return;
    }
  }, [replyThreads]);

  async function loadReviews() {
    try {
      setError('');
      const data = await ReviewsApi.listByBook(bookId);
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createReview(e) {
    e.preventDefault();
    try {
      setError('');
      await ReviewsApi.create({
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

  function getLocalReplies(reviewId) {
    return Array.isArray(replyThreads[reviewId]) ? replyThreads[reviewId] : [];
  }

  function updateReplyDraft(reviewId, content) {
    setReplyDrafts((current) => ({
      ...current,
      [reviewId]: content,
    }));
  }

  function submitReply(reviewId) {
    const content = String(replyDrafts[reviewId] || '').trim();
    if (!content) {
      return;
    }

    const nextReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: 'Admin',
      content,
      created_at: new Date().toISOString(),
    };

    setReplyThreads((current) => ({
      ...current,
      [reviewId]: [...(Array.isArray(current[reviewId]) ? current[reviewId] : []), nextReply],
    }));

    setReplyDrafts((current) => ({
      ...current,
      [reviewId]: '',
    }));
  }

  function formatReplyDate(value) {
    if (!value) {
      return 'Vua xong';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Vua xong';
    }

    return date.toLocaleString('vi-VN');
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
          <div className="sb-review-replies" style={{ gap: 14 }}>
            {reviews.map((review) => (
              <article key={review.id} className="panel">
                <div className="sb-review-top" style={{ marginBottom: 8 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Review #{review.id}</h3>
                    <small>Customer: {review.customer_id} · Book: {review.book_id}</small>
                  </div>
                  <div className="sb-review-stars-wrap">
                    <span className="sb-review-stars">{'★★★★★'.slice(0, Number(review.rating || 0))}</span>
                    <small>{Number(review.rating || 0).toFixed(1)}</small>
                  </div>
                </div>

                <p style={{ margin: '0 0 10px' }}>{review.comment || 'No comment from this review.'}</p>

                {getLocalReplies(review.id).length ? (
                  <ul className="sb-review-reply-list">
                    {getLocalReplies(review.id).map((item) => (
                      <li key={item.id} className="sb-review-reply-item">
                        <div className="sb-review-reply-head">
                          <strong>{item.author || 'Admin'}</strong>
                          <small>{formatReplyDate(item.created_at)}</small>
                        </div>
                        <p>{item.content}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="sb-review-reply-form" style={{ marginTop: 10 }}>
                  <input
                    placeholder="Tra loi review nay..."
                    value={replyDrafts[review.id] || ''}
                    onChange={(event) => updateReplyDraft(review.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitReply(review.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => submitReply(review.id)}
                    disabled={!String(replyDrafts[review.id] || '').trim()}
                  >
                    Tra loi
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
