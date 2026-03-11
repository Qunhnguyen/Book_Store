import { useEffect, useMemo, useState } from 'react';
import { del, get, getErrorMessage, post, put, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

const initialForm = { title: '', author: '', price: '', stock: '' };
const PAGE_SIZE = 4;

function formatBookCode(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 'N/A';
  }

  return `B${String(Math.max(0, Math.trunc(n))).padStart(3, '0')}`;
}

function formatVnd(value) {
  const amount = Number(value) || 0;
  return `${amount.toLocaleString('vi-VN')}đ`;
}

export default function BooksPage() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
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
      price: String(book.price ?? ''),
      stock: String(book.stock),
    });
    setIsModalOpen(true);
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
      const parsedPrice = Number(form.price);
      const parsedStock = Number(form.stock);

      if (!form.title.trim() || !form.author.trim()) {
        setError('Vui long nhap day du tieu de va tac gia.');
        return;
      }

      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        setError('Gia ban phai lon hon 0.');
        return;
      }

      if (!Number.isFinite(parsedStock) || parsedStock < 0) {
        setError('Ton kho khong hop le.');
        return;
      }

      const payload = {
        title: form.title.trim(),
        author: form.author.trim(),
        price: parsedPrice,
        stock: Math.trunc(parsedStock),
      };

      if (editingId) {
        await put(`${urls.book}/books/${editingId}/`, payload);
      } else {
        await post(`${urls.book}/books/`, payload);
      }

      setEditingId(null);
      setForm(initialForm);
      setIsModalOpen(false);
      await loadBooks();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const filteredBooks = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return books.filter((book) => {
      if (lowStockOnly && Number(book.stock) > 20) {
        return false;
      }

      if (!term) {
        return true;
      }

      const code = formatBookCode(book.id).toLowerCase();
      const haystack = `${code} ${book.title || ''} ${book.author || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [books, lowStockOnly, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedBooks = filteredBooks.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchText, lowStockOnly]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const lowStockCount = books.filter((book) => Number(book.stock) <= 20).length;
  const inventoryValue = books.reduce((sum, book) => sum + (Number(book.price) || 0) * (Number(book.stock) || 0), 0);

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(initialForm);
  }

  return (
    <>
      <PageHeader
        title="Danh sach Sach"
        subtitle="Quan ly kho hang va danh muc san pham cua ban"
        actions={(
          <button
            type="button"
            className="bm-primary-btn"
            onClick={() => {
              setEditingId(null);
              setForm(initialForm);
              setIsModalOpen(true);
            }}
          >
            + Them Sach Moi
          </button>
        )}
      />
      <AlertBox message={error} />

      <SectionCard className="bm-panel">
        <div className="bm-toolbar">
          <input
            className="bm-search"
            placeholder="Tim kiem theo tieu de, tac gia hoac ma sach..."
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button
            type="button"
            className={`bm-filter-btn ${lowStockOnly ? 'active' : ''}`}
            onClick={() => setLowStockOnly((prev) => !prev)}
          >
            Loc ton thap
          </button>
        </div>

        {!filteredBooks.length ? (
          <EmptyState message="Khong tim thay sach phu hop bo loc hien tai." />
        ) : (
          <>
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th>Ma sach</th>
                    <th>Tieu de</th>
                    <th>Tac gia</th>
                    <th>Gia ban</th>
                    <th>Ton kho</th>
                    <th>Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBooks.map((book) => {
                    const stock = Number(book.stock) || 0;
                    const stockClass = stock <= 20 ? 'warn' : 'ok';

                    return (
                      <tr key={book.id}>
                        <td className="bm-code">{formatBookCode(book.id)}</td>
                        <td>{book.title}</td>
                        <td>{book.author}</td>
                        <td>{formatVnd(book.price)}</td>
                        <td>
                          <span className={`bm-stock-pill ${stockClass}`}>{stock}</span>
                        </td>
                        <td>
                          <div className="bm-row-actions">
                            <button type="button" onClick={() => editBook(book)}>Sua</button>
                            <button type="button" className="danger" onClick={() => removeBook(book.id)}>Xoa</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bm-pagination-row">
              <p>
                Dang xem {filteredBooks.length ? startIndex + 1 : 0} den {Math.min(startIndex + PAGE_SIZE, filteredBooks.length)}
                {' '}trong so {filteredBooks.length} dau sach
              </p>

              <div className="bm-pagination">
                <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                  {'<'}
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageValue = idx + 1;
                  return (
                    <button
                      key={pageValue}
                      type="button"
                      className={pageValue === currentPage ? 'active' : ''}
                      onClick={() => setPage(pageValue)}
                    >
                      {pageValue}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  {'>'}
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <div className="bm-kpi-grid">
        <article className="bm-kpi-card">
          <p>Tong so dau sach</p>
          <strong>{books.length.toLocaleString('vi-VN')}</strong>
          <small>Danh muc hien co trong he thong</small>
        </article>
        <article className="bm-kpi-card">
          <p>Sach sap het hang</p>
          <strong>{lowStockCount.toLocaleString('vi-VN')}</strong>
          <small>Can nhap them hang ngay</small>
        </article>
        <article className="bm-kpi-card">
          <p>Tong gia tri kho</p>
          <strong>{formatVnd(inventoryValue)}</strong>
          <small>Tinh theo gia ban va ton kho</small>
        </article>
      </div>

      {isModalOpen ? (
        <div className="bm-modal-backdrop" role="presentation" onClick={closeModal}>
          <section className="bm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>{editingId ? `Chinh sua sach #${formatBookCode(editingId)}` : 'Them Sach Moi'}</h2>
            <form className="bm-form-grid" onSubmit={submitBook}>
              <label>
                Tieu de
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Tac gia
                <input
                  required
                  value={form.author}
                  onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
                />
              </label>
              <label>
                Gia ban
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                />
              </label>
              <label>
                Ton kho
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
                />
              </label>
              <div className="bm-modal-actions">
                <button type="button" className="ghost" onClick={closeModal}>Huy</button>
                <button type="submit" className="bm-primary-btn">
                  {editingId ? 'Cap nhat sach' : 'Them sach'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
