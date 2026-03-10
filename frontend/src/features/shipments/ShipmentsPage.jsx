import { useState } from 'react';
import { get, getErrorMessage, post, urls } from '../../api/client';
import AlertBox from '../../shared/components/AlertBox';
import DataTable from '../../shared/components/DataTable';
import EmptyState from '../../shared/components/EmptyState';
import PageHeader from '../../shared/components/PageHeader';
import SectionCard from '../../shared/components/SectionCard';

export default function ShipmentsPage() {
  const [orderId, setOrderId] = useState('');
  const [address, setAddress] = useState('');
  const [shippingMethod, setShippingMethod] = useState('STANDARD');
  const [shipments, setShipments] = useState([]);
  const [error, setError] = useState('');

  async function loadShipments() {
    try {
      setError('');
      const data = await get(`${urls.ship}/shipments/${orderId}/`);
      setShipments(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createShipment() {
    try {
      setError('');
      await post(`${urls.ship}/shipments/`, {
        order_id: Number(orderId),
        shipping_method: shippingMethod,
        address,
      });
      await loadShipments();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Shipments" subtitle="Shipment records by order." />
      <AlertBox message={error} />
      <SectionCard title="Shipment Actions">
        <div className="row">
          <input placeholder="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <select value={shippingMethod} onChange={(e) => setShippingMethod(e.target.value)}>
            <option value="STANDARD">STANDARD</option>
            <option value="EXPRESS">EXPRESS</option>
          </select>
          <button onClick={loadShipments} disabled={!orderId}>Load Shipments</button>
          <button onClick={createShipment} disabled={!orderId}>Create Shipment</button>
        </div>
      </SectionCard>
      <SectionCard title="Shipment List">
        {!shipments.length ? (
          <EmptyState message="No shipment records found." />
        ) : (
          <DataTable
            columns={[
              { key: 'id', label: 'Shipment ID' },
              { key: 'order_id', label: 'Order ID' },
              { key: 'shipping_method', label: 'Method' },
              { key: 'address', label: 'Address' },
              { key: 'status', label: 'Status' },
            ]}
            rows={shipments}
          />
        )}
      </SectionCard>
    </>
  );
}
