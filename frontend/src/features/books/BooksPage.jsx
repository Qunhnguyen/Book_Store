import { useEffect, useState } from 'react';
import { del, get, getErrorMessage, post, put, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

const initialForm = { title: '', author: '', price: '', stock: '' };

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function loadBooks() {
    try {
      setError('');
      const data = await get(`${urls.book}/books/`);
      setBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  function editBook(book) {
    setEditingId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      price: book.price,
      stock: String(book.stock),
    });
  }

  async function removeBook(bookId) {
    try {
      setError('');
      await del(`${urls.book}/books/${bookId}/`);
      if (editingId === bookId) {
        setEditingId(null);
        setForm(initialForm);
      }
      await loadBooks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function submitBook(e) {
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
        await put(`${urls.book}/books/${editingId}/`, payload);
      } else {
        await post(`${urls.book}/books/`, payload);
      }

      setEditingId(null);
      setForm(initialForm);
      await loadBooks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Books Management"
        subtitle="Create, update and remove books from inventory."
      />
      <AlertBox message={error} />

      <SectionCard title={editingId ? `Edit Book #${editingId}` : 'Create New Book'}>
        <form className="form-grid" onSubmit={submitBook}>
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input required placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          <input required placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input required placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <button type="submit">{editingId ? 'Update Book' : 'Create Book'}</button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
      </SectionCard>

      <SectionCard title="Books List">
        {!books.length ? (
          <EmptyState message="No books found. Add your first one above." />
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
                    <button onClick={() => editBook(row)}>Edit</button>
                    <button onClick={() => removeBook(row.id)}>Delete</button>
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
