import { useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function PaymentsPage() {
  const [orderId, setOrderId] = useState('');
  const [method, setMethod] = useState('COD');
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  async function loadByOrder() {
    try {
      setError('');
      const data = await get(`${urls.pay}/payments/${orderId}/`);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createPayment() {
    try {
      setError('');
      await post(`${urls.pay}/payments/`, {
        order_id: Number(orderId),
        payment_method: method,
      });
      await loadByOrder();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Payments" subtitle="Track and create order payments." />
      <AlertBox message={error} />
      <SectionCard title="Payment Actions">
        <div className="row">
          <input placeholder="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="COD">COD</option>
            <option value="CARD">CARD</option>
          </select>
          <button onClick={loadByOrder} disabled={!orderId}>Load Payments</button>
          <button onClick={createPayment} disabled={!orderId}>Create Payment</button>
        </div>
      </SectionCard>
      <SectionCard title="Payment List">
        {!payments.length ? (
          <EmptyState message="No payments available." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'Payment ID' },
              { key: 'order_id', label: 'Order ID' },
              { key: 'payment_method', label: 'Method' },
              { key: 'status', label: 'Status' },
            ]}
            rows={payments}
          />
        )}
      </SectionCard>
    </>
  );
}
