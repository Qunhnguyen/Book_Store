import { useEffect, useState } from 'react';
import { del, get, getErrorMessage, post, put, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

const initialForm = { title: '', author: '', price: '', stock: '' };

export default function StaffPage() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function loadBooks() {
    try {
      setError('');
      const data = await get(`${urls.staff}/staff/books/`);
      setBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        title: form.title,
        author: form.author,
        price: form.price,
        stock: Number(form.stock),
      };
      if (editingId) {
        await put(`${urls.staff}/staff/books/${editingId}/`, payload);
      } else {
        await post(`${urls.staff}/staff/books/`, payload);
      }
      setForm(initialForm);
      setEditingId(null);
      await loadBooks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      author: row.author,
      price: row.price,
      stock: String(row.stock),
    });
  }

  async function remove(bookId) {
    try {
      await del(`${urls.staff}/staff/books/${bookId}/`);
      await loadBooks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Staff Console" subtitle="Staff-facing inventory operations via staff-service." />
      <AlertBox message={error} />
      <SectionCard title={editingId ? `Edit Book #${editingId}` : 'Create Book'}>
        <form className="form-grid" onSubmit={submit}>
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input required placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          <input required placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input required placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <button type="submit">{editingId ? 'Update' : 'Create'}</button>
        </form>
      </SectionCard>
      <SectionCard title="Staff Book List">
        {!books.length ? (
          <EmptyState message="No books found." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'title', label: 'Title' },
              { key: 'author', label: 'Author' },
              { key: 'price', label: 'Price' },
              { key: 'stock', label: 'Stock' },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => (
                  <div className="row">
                    <button onClick={() => edit(row)}>Edit</button>
                    <button onClick={() => remove(row.id)}>Delete</button>
                  </div>
                ),
              },
            ]}
            rows={books}
          />
        )}
      </SectionCard>
    </>
  );
}
