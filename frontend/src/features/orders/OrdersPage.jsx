import { useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function OrdersPage() {
  const [customerId, setCustomerId] = useState('');
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  async function loadOrders() {
    try {
      setError('');
      const data = await get(`${urls.order}/orders/${customerId}/`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createOrder() {
    try {
      setError('');
      await post(`${urls.order}/orders/`, { customer_id: Number(customerId) });
      await loadOrders();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Orders" subtitle="Create and inspect customer orders." />
      <AlertBox message={error} />
      <SectionCard title="Order Actions">
        <div className="row">
          <input placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <button onClick={loadOrders} disabled={!customerId}>Load Orders</button>
          <button onClick={createOrder} disabled={!customerId}>Create Order</button>
        </div>
      </SectionCard>
      <SectionCard title="Orders List">
        {!orders.length ? (
          <EmptyState message="No orders found for this customer." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'Order ID' },
              { key: 'customer_id', label: 'Customer ID' },
              { key: 'status', label: 'Status' },
            ]}
            rows={orders}
          />
        )}
      </SectionCard>
    </>
  );
}
