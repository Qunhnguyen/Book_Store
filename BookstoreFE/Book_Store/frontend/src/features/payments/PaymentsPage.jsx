import { useState } from 'react';
import { PaymentsApi, getErrorMessage } from '../../api/client';
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
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(null); // Track which payment is being processed

  async function loadByOrder() {
    try {
      setError('');
      setSuccess('');
      const data = await PaymentsApi.listByOrder(orderId);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createPayment() {
    try {
      setError('');
      setSuccess('');
      await PaymentsApi.create({
        order_id: Number(orderId),
        payment_method: method,
      });
      setSuccess('Payment created with status PENDING. Confirm payment below.');
      await loadByOrder();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function processPayment(paymentId, action) {
    try {
      setError('');
      setSuccess('');
      setProcessing(paymentId);
      await PaymentsApi.process(paymentId, action);
      setSuccess(`Payment ${action === 'pay' ? 'confirmed' : 'cancelled'} successfully!`);
      await loadByOrder();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessing(null);
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PAID':
        return '#28a745';
      case 'PENDING':
        return '#ffc107';
      case 'FAILED':
      case 'REFUNDED':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <>
      <PageHeader title="Payments" subtitle="Track and create order payments with manual confirmation." />
      <AlertBox message={error} type="error" />
      {success && <AlertBox message={success} type="success" />}
      
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Payment ID</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Order ID</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Method</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{payment.id}</td>
                    <td style={{ padding: '10px' }}>{payment.order_id}</td>
                    <td style={{ padding: '10px' }}>{payment.payment_method}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        backgroundColor: getStatusColor(payment.status),
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {payment.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {payment.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            onClick={() => processPayment(payment.id, 'pay')}
                            disabled={processing === payment.id}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: processing === payment.id ? 'not-allowed' : 'pointer',
                              opacity: processing === payment.id ? 0.6 : 1
                            }}
                          >
                            {processing === payment.id ? 'Processing...' : 'Confirm Pay'}
                          </button>
                          <button
                            onClick={() => processPayment(payment.id, 'cancel')}
                            disabled={processing === payment.id}
                            style={{
                              padding: '5px 10px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: processing === payment.id ? 'not-allowed' : 'pointer',
                              opacity: processing === payment.id ? 0.6 : 1
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {payment.status !== 'PENDING' && (
                        <span style={{ color: '#6c757d', fontSize: '12px' }}>No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="ℹ️ Payment Flow (Hybrid Saga)">
        <div style={{ padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px', fontSize: '14px', lineHeight: '1.6' }}>
          <p><strong>1. Create Payment:</strong> Payment created with PENDING status (automatic via backend)</p>
          <p><strong>2. Confirm Payment:</strong> Click "Confirm Pay" button to process payment → Status changes to PAID</p>
          <p><strong>3. Shipment Auto-Created:</strong> When payment is PAID, shipment is automatically created in pending state</p>
          <p><strong style={{ color: 'red' }}>⚠️ Failed Payment:</strong> If you click "Cancel" or "Confirm Pay" fails, payment becomes FAILED and order is cancelled</p>
        </div>
      </SectionCard>
    </>
  );
}
