import { useState } from 'react';
import { get, getErrorMessage, post, put, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function CartPage() {
  const [customerId, setCustomerId] = useState('');
  const [cartId, setCartId] = useState('');
  const [bookId, setBookId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  async function loadCart() {
    try {
      setError('');
      const data = await get(`${urls.cart}/carts/${customerId}/`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function addItem(e) {
    e.preventDefault();
    try {
      setError('');
      await post(`${urls.cart}/cart-items/`, {
        cart: Number(cartId),
        book_id: Number(bookId),
        quantity: Number(quantity),
      });
      if (customerId) {
        await loadCart();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function increase(item) {
    try {
      await put(`${urls.cart}/cart-items/${item.id}/`, { quantity: item.quantity + 1 });
      await loadCart();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Cart" subtitle="Inspect and update cart items by customer." />
      <AlertBox message={error} />
      <SectionCard title="Load Cart By Customer">
        <div className="row">
          <input placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <button onClick={loadCart} disabled={!customerId}>Load Cart</button>
        </div>
      </SectionCard>
      <SectionCard title="Add Item">
        <form className="form-grid" onSubmit={addItem}>
          <input required placeholder="Cart ID" value={cartId} onChange={(e) => setCartId(e.target.value)} />
          <input required placeholder="Book ID" value={bookId} onChange={(e) => setBookId(e.target.value)} />
          <input required placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <button type="submit">Add Item</button>
        </form>
      </SectionCard>
      <SectionCard title="Cart Items">
        {!items.length ? (
          <EmptyState message="No cart item loaded." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'Item ID' },
              { key: 'cart', label: 'Cart ID' },
              { key: 'book_id', label: 'Book ID' },
              { key: 'quantity', label: 'Qty' },
              {
                key: 'actions',
                label: 'Actions',
                render: (row) => <button onClick={() => increase(row)}>+1 Qty</button>,
              },
            ]}
            rows={items}
          />
        )}
      </SectionCard>
    </>
  );
}
