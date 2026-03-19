import { useEffect, useState } from 'react';
import { OrdersApi, PaymentsApi, ShipmentsApi, getErrorMessage } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingPayment, setProcessingPayment] = useState(null);
  const [processingShipment, setProcessingShipment] = useState(null);

  async function loadOrders() {
    try {
      setError('');
      const data = await OrdersApi.list();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadPayments() {
    try {
      setError('');
      const data = await PaymentsApi.list();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function loadShipments() {
    try {
      setError('');
      const data = await ShipmentsApi.list();
      setShipments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadOrders();
    loadPayments();
    loadShipments();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PAID':
      case 'DELIVERED':
        return '#28a745';
      case 'PENDING':
      case 'SHIPPING':
        return '#ffc107';
      case 'CANCELLED':
      case 'FAILED':
      case 'REFUNDED':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  async function processPayment(paymentId, action) {
    try {
      setError('');
      setSuccess('');
      setProcessingPayment(paymentId);
      await PaymentsApi.process(paymentId, action);
      setSuccess(`Payment ${action === 'pay' ? 'confirmed' : 'cancelled'} successfully!`);
      await loadPayments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingPayment(null);
    }
  }

  async function deliverShipment(shipmentId, action) {
    try {
      setError('');
      setSuccess('');
      setProcessingShipment(shipmentId);
      await ShipmentsApi.deliver(shipmentId, action);
      setSuccess(`Shipment ${action === 'confirm' ? 'delivered' : 'cancelled'} successfully!`);
      await loadShipments();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessingShipment(null);
    }
  }

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Manage orders, payments, and shipments." />
      <AlertBox message={error} type="error" />
      {success && <AlertBox message={success} type="success" />}

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '10px 20px',
            borderRadius: '4px 4px 0 0',
            border: activeTab === 'orders' ? '2px solid #0056b3' : '1px solid #ddd',
            backgroundColor: activeTab === 'orders' ? '#0056b3' : '#f8f9fa',
            color: activeTab === 'orders' ? 'white' : 'black',
            cursor: 'pointer',
            fontWeight: activeTab === 'orders' ? 'bold' : 'normal',
          }}
        >
          📋 Orders ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          style={{
            padding: '10px 20px',
            borderRadius: '4px 4px 0 0',
            border: activeTab === 'payments' ? '2px solid #0056b3' : '1px solid #ddd',
            backgroundColor: activeTab === 'payments' ? '#0056b3' : '#f8f9fa',
            color: activeTab === 'payments' ? 'white' : 'black',
            cursor: 'pointer',
            fontWeight: activeTab === 'payments' ? 'bold' : 'normal',
          }}
        >
          💳 Payments ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab('shipments')}
          style={{
            padding: '10px 20px',
            borderRadius: '4px 4px 0 0',
            border: activeTab === 'shipments' ? '2px solid #0056b3' : '1px solid #ddd',
            backgroundColor: activeTab === 'shipments' ? '#0056b3' : '#f8f9fa',
            color: activeTab === 'shipments' ? 'white' : 'black',
            cursor: 'pointer',
            fontWeight: activeTab === 'shipments' ? 'bold' : 'normal',
          }}
        >
          📦 Shipments ({shipments.length})
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <SectionCard title="Order Management">
          {!orders.length ? (
            <EmptyState message="No orders found." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Order ID</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Customer ID</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Order Date</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Total</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px' }}>{order.id}</td>
                      <td style={{ padding: '10px' }}>{order.customer_id}</td>
                      <td style={{ padding: '10px' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '10px' }}>${order.total?.toFixed(2) || 'N/A'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '5px 10px',
                          borderRadius: '4px',
                          backgroundColor: getStatusColor(order.status),
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <SectionCard title="Payment Management">
          {!payments.length ? (
            <EmptyState message="No payments found." />
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
                              disabled={processingPayment === payment.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: processingPayment === payment.id ? 'not-allowed' : 'pointer',
                                opacity: processingPayment === payment.id ? 0.6 : 1,
                                fontSize: '12px'
                              }}
                            >
                              {processingPayment === payment.id ? 'Processing...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => processPayment(payment.id, 'cancel')}
                              disabled={processingPayment === payment.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: processingPayment === payment.id ? 'not-allowed' : 'pointer',
                                opacity: processingPayment === payment.id ? 0.6 : 1,
                                fontSize: '12px'
                              }}
                            >
                              Reject
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
      )}

      {/* Shipments Tab */}
      {activeTab === 'shipments' && (
        <SectionCard title="Shipment Management">
          {!shipments.length ? (
            <EmptyState message="No shipments found." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Shipment ID</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Order ID</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Method</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Address</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px' }}>{shipment.id}</td>
                      <td style={{ padding: '10px' }}>{shipment.order_id}</td>
                      <td style={{ padding: '10px' }}>{shipment.shipping_method}</td>
                      <td style={{ padding: '10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shipment.address || 'N/A'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '5px 10px',
                          borderRadius: '4px',
                          backgroundColor: getStatusColor(shipment.status),
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {shipment.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {(shipment.status === 'PENDING' || shipment.status === 'SHIPPING') && (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                              onClick={() => deliverShipment(shipment.id, 'confirm')}
                              disabled={processingShipment === shipment.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: processingShipment === shipment.id ? 'not-allowed' : 'pointer',
                                opacity: processingShipment === shipment.id ? 0.6 : 1,
                                fontSize: '12px'
                              }}
                            >
                              {processingShipment === shipment.id ? 'Processing...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => deliverShipment(shipment.id, 'cancel')}
                              disabled={processingShipment === shipment.id}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: processingShipment === shipment.id ? 'not-allowed' : 'pointer',
                                opacity: processingShipment === shipment.id ? 0.6 : 1,
                                fontSize: '12px'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {!['PENDING', 'SHIPPING'].includes(shipment.status) && (
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
      )}

      {/* Info Section */}
      <SectionCard title="ℹ️ Admin Management Guide">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
          <div style={{ padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
            <h4>📋 Orders</h4>
            <p>View all customer orders with their current status: CONFIRMED, PENDING, or CANCELLED.</p>
          </div>
          <div style={{ padding: '10px', backgroundColor: '#f3e5f5', borderRadius: '4px' }}>
            <h4>💳 Payments</h4>
            <p>Manage payment confirmations. Click "Confirm" to mark payment as PAID, or "Reject" to mark as FAILED and trigger refund.</p>
          </div>
          <div style={{ padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
            <h4>📦 Shipments</h4>
            <p>Manage shipment deliveries. Click "Confirm" when package delivered (DELIVERED status), or "Cancel" to fail shipment and refund customer.</p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
