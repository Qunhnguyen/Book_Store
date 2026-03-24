# FE - Saga Order Workflow Implementation Guide

## 📚 Table of Contents
1. [Workflow Overview](#workflow-overview)
2. [Implementation Steps](#implementation-steps)
3. [Code Examples](#code-examples)
4. [State Management](#state-management)
5. [Error Handling](#error-handling)
6. [Testing Scenarios](#testing-scenarios)

---

## 🎯 Workflow Overview

### Saga Pattern Flow (Orchestration-based)

```
Client POST /orders/ 
    ↓ (force_payment_failure, force_shipping_failure)
Order Created (status: PENDING)
    ↓
Inventory Reserve → Payment Reserve → Shipping Reserve → Commit
    ↓ (fail at any step)
Compensation: Release Inventory → Refund Payment → Cancel Order
```

**Timeline:**
- Status: PENDING → INVENTORY_RESERVED → PAYMENT_RESERVED → CONFIRMED
- If fail: → COMPENSATING → CANCELLED or FAILED

---

## 🛠️ Implementation Steps

### Step 1: Create Order with Saga Flags

**FE Action:** User clicks "Place Order"

**API Call:**
```typescript
POST http://localhost:8000/api/orders/
{
  "customer_id": 1,
  "force_payment_failure": false,      // Test flag
  "force_shipping_failure": false      // Test flag
}
```

**Response:**
```json
{
  "id": 1,
  "customer_id": 1,
  "status": "PENDING",
  "total_price": "500000.00",
  "saga_id": "xxx-xxx-xxx",
  "correlation_id": "yyy-yyy-yyy"
}
```

**⚠️ Important:**
- If cart is empty → HTTP 400 error
- If service is down → HTTP 503 error
- Capture `order_id` for next steps

---

### Step 2: Poll Order Status (Wait for Saga)

**FE Action:** Display loading state while saga executes

**API Call (Polling every 1-2 sec):**
```typescript
GET http://localhost:8000/api/orders/{customer_id}/
```

**Watch for status changes:**
```
PENDING 
  ↓ (some failures)
INVENTORY_RESERVED 
  ↓
PAYMENT_RESERVED 
  ↓
CONFIRMED  ✅ (All success)

OR

CANCELLED  ❌ (Inventory or payment fails → auto compensation)
FAILED     ❌ (Compensation itself fails)
```

**Expected timeline:** 2-5 seconds if all succeed

---

### Step 3: Get Payment Details

**FE Action:** After order created, fetch payment info

**API Call:**
```typescript
GET http://localhost:8000/api/payments/{order_id}/
```

**Response:**
```json
[
  {
    "id": 1,
    "order_id": 1,
    "payment_method": "COD",
    "status": "PENDING"  // or PAID, FAILED, REFUNDED
  }
]
```

**Payment Status Meanings:**
- `PENDING` → Waiting for saga result
- `PAID` → Payment approved (auto or manual)
- `FAILED` → Payment failed (auto or manual reject)
- `REFUNDED` → Refund executed during compensation

---

### Step 4: Approve/Reject Payment (Manual Override - Optional)

**FE Action:** Client manually approve/reject payment

**API Call:**
```typescript
POST http://localhost:8000/api/payments/{order_id}/approve/
{
  "approved": true   // true=PAID, false=FAILED
}
```

**Effect:**
- `approved: true` → Publish payment success event → Saga continues
- `approved: false` → Publish payment fail event → Trigger compensation

---

### Step 5: Get Shipment Details

**FE Action:** After order created, fetch shipment info

**API Call:**
```typescript
GET http://localhost:8000/api/shipments/{order_id}/
```

**Response:**
```json
[
  {
    "id": 1,
    "order_id": 1,
    "shipping_method": "STANDARD",
    "address": "Customer 1 address",
    "status": "PENDING"  // or RESERVED, FAILED, CANCELLED
  }
]
```

**Shipment Status Meanings:**
- `PENDING` → Waiting for saga result
- `RESERVED` → Shipment approved (auto or manual)
- `FAILED` → Shipment failed (auto or manual reject)
- `CANCELLED` → Shipment cancelled during compensation

---

### Step 6: Approve/Reject Shipment (Manual Override - Optional)

**FE Action:** Client manually approve/reject shipment

**API Call:**
```typescript
POST http://localhost:8000/api/shipments/{order_id}/approve/
{
  "approved": true   // true=RESERVED, false=FAILED
}
```

**Effect:**
- `approved: true` → Publish shipment success event → Saga continues
- `approved: false` → Publish shipment fail event → Trigger compensation

---

## 💻 Code Examples

### React Hook - Order Creation & Status Polling

```typescript
// src/hooks/useOrderSaga.ts
import { useState, useEffect } from 'react';
import { api } from '@/services/api';

type OrderStatus = 'PENDING' | 'INVENTORY_RESERVED' | 'PAYMENT_RESERVED' | 'CONFIRMED' | 'CANCELLED' | 'FAILED';

interface Order {
  id: number;
  customer_id: number;
  status: OrderStatus;
  total_price: string;
  saga_id: string;
  correlation_id: string;
}

export const useOrderSaga = () => {
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Create Order
  const createOrder = async (
    customerId: number,
    forcePaymentFailure = false,
    forceShippingFailure = false
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/orders/', {
        customer_id: customerId,
        force_payment_failure: forcePaymentFailure,
        force_shipping_failure: forceShippingFailure,
      });
      setOrder(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to create order';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 2. Poll Order Status
  const pollOrderStatus = async (customerId: number, maxAttempts = 30) => {
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const response = await api.get(`/api/orders/${customerId}/`);
        const orders = response.data;
        
        if (orders.length > 0) {
          const latestOrder = orders[orders.length - 1];
          setOrder(latestOrder);
          
          // Check if saga is complete (CONFIRMED, CANCELLED, or FAILED)
          if (['CONFIRMED', 'CANCELLED', 'FAILED'].includes(latestOrder.status)) {
            clearInterval(pollInterval);
            return;
          }
        }
      } catch (err) {
        console.error('Error polling order status:', err);
      }

      // Stop polling after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setError('Order status update timeout');
      }
    }, 1000); // Poll every 1 second
  };

  // 3. Fetch Payment
  const fetchPayment = async (orderId: number) => {
    try {
      const response = await api.get(`/api/payments/${orderId}/`);
      setPayment(response.data[0] || null);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch payment:', err);
    }
  };

  // 4. Approve Payment
  const approvePayment = async (orderId: number, approved = true) => {
    try {
      const response = await api.post(`/api/payments/${orderId}/approve/`, {
        approved,
      });
      setPayment(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to approve payment';
      setError(message);
      throw err;
    }
  };

  // 5. Fetch Shipment
  const fetchShipment = async (orderId: number) => {
    try {
      const response = await api.get(`/api/shipments/${orderId}/`);
      setShipment(response.data[0] || null);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch shipment:', err);
    }
  };

  // 6. Approve Shipment
  const approveShipment = async (orderId: number, approved = true) => {
    try {
      const response = await api.post(`/api/shipments/${orderId}/approve/`, {
        approved,
      });
      setShipment(response.data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to approve shipment';
      setError(message);
      throw err;
    }
  };

  return {
    order,
    payment,
    shipment,
    loading,
    error,
    createOrder,
    pollOrderStatus,
    fetchPayment,
    approvePayment,
    fetchShipment,
    approveShipment,
  };
};
```

### React Component - Order Checkout

```typescript
// src/components/CheckoutFlow.tsx
import { useEffect } from 'react';
import { useOrderSaga } from '@/hooks/useOrderSaga';

export const CheckoutFlow = ({ customerId }: { customerId: number }) => {
  const {
    order,
    payment,
    shipment,
    loading,
    error,
    createOrder,
    pollOrderStatus,
    fetchPayment,
    approvePayment,
    fetchShipment,
    approveShipment,
  } = useOrderSaga();

  // Step 1: Create Order
  const handleCreateOrder = async () => {
    try {
      const newOrder = await createOrder(customerId);
      console.log('Order created:', newOrder);
      
      // Step 2: Start polling for saga updates
      await pollOrderStatus(customerId);
      
      // Step 3: Fetch payment & shipment once order status changes
      await fetchPayment(newOrder.id);
      await fetchShipment(newOrder.id);
    } catch (err) {
      console.error('Order creation failed:', err);
    }
  };

  const handleApprovePayment = async () => {
    if (!order) return;
    try {
      await approvePayment(order.id, true);
      console.log('Payment approved');
    } catch (err) {
      console.error('Failed to approve payment:', err);
    }
  };

  const handleRejectPayment = async () => {
    if (!order) return;
    try {
      await approvePayment(order.id, false);
      console.log('Payment rejected - saga will compensate');
    } catch (err) {
      console.error('Failed to reject payment:', err);
    }
  };

  const handleApproveShipment = async () => {
    if (!order) return;
    try {
      await approveShipment(order.id, true);
      console.log('Shipment approved');
    } catch (err) {
      console.error('Failed to approve shipment:', err);
    }
  };

  const handleRejectShipment = async () => {
    if (!order) return;
    try {
      await approveShipment(order.id, false);
      console.log('Shipment rejected - saga will compensate');
    } catch (err) {
      console.error('Failed to reject shipment:', err);
    }
  };

  return (
    <div className="checkout-flow">
      <h2>Order Checkout</h2>

      {error && <div className="error-banner">{error}</div>}

      {/* Step 1: Create Order */}
      <section className="step step-1">
        <h3>1. Place Order</h3>
        <button onClick={handleCreateOrder} disabled={loading || !!order}>
          {loading ? 'Creating...' : 'Create Order'}
        </button>
      </section>

      {/* Step 2: Order Status & Saga Progress */}
      {order && (
        <section className="step step-2">
          <h3>2. Order Status</h3>
          <p>Order ID: <strong>{order.id}</strong></p>
          <p>Saga ID: <strong>{order.saga_id.substring(0, 8)}...</strong></p>
          <p>Status: <strong className={`status-${order.status}`}>{order.status}</strong></p>
          
          {/* Show saga progress */}
          <div className="saga-progress">
            <div className={order.status !== 'PENDING' ? 'completed' : 'pending'}>
              ✓ Inventory Reserved
            </div>
            <div className={order.status === 'PAYMENT_RESERVED' || order.status === 'CONFIRMED' ? 'completed' : 'pending'}>
              ✓ Payment Reserved
            </div>
            <div className={order.status === 'CONFIRMED' ? 'completed' : 'pending'}>
              ✓ Shipping Reserved
            </div>
            <div className={order.status === 'CONFIRMED' ? 'completed' : 'pending'}>
              ✓ Order Confirmed
            </div>
          </div>

          {order.status === 'CANCELLED' && (
            <div className="alert alert-danger">
              Order cancelled due to saga failure (inventory/payment/shipment issue)
            </div>
          )}
          {order.status === 'FAILED' && (
            <div className="alert alert-danger">
              Order failed - compensation also failed. Manual intervention needed.
            </div>
          )}
        </section>
      )}

      {/* Step 3: Payment Approval (Manual Override) */}
      {order && payment && order.status === 'INVENTORY_RESERVED' && (
        <section className="step step-3">
          <h3>3. Payment Approval (Optional Manual Override)</h3>
          <p>Payment Status: <strong>{payment.status}</strong></p>
          <button onClick={handleApprovePayment} className="btn btn-success">
            Approve Payment
          </button>
          <button onClick={handleRejectPayment} className="btn btn-danger">
            Reject Payment (Trigger Compensation)
          </button>
        </section>
      )}

      {/* Step 4: Shipment Approval (Manual Override) */}
      {order && shipment && order.status === 'PAYMENT_RESERVED' && (
        <section className="step step-4">
          <h3>4. Shipment Approval (Optional Manual Override)</h3>
          <p>Shipment Status: <strong>{shipment.status}</strong></p>
          <button onClick={handleApproveShipment} className="btn btn-success">
            Approve Shipment
          </button>
          <button onClick={handleRejectShipment} className="btn btn-danger">
            Reject Shipment (Trigger Compensation)
          </button>
        </section>
      )}

      {/* Step 5: Confirmation */}
      {order && order.status === 'CONFIRMED' && (
        <section className="step step-5 success">
          <h3>✅ Order Confirmed!</h3>
          <p>Your order has been successfully placed and all services are activated.</p>
          <button onClick={() => window.location.href = `/orders/${customerId}`}>
            View Order Details
          </button>
        </section>
      )}
    </div>
  );
};
```

---

## 🎛️ State Management

### Recommended Structure (Zustand/Redux)

```typescript
// src/store/orderStore.ts
import { create } from 'zustand';

interface OrderStore {
  currentOrder: Order | null;
  payment: Payment | null;
  shipment: Shipment | null;
  sagaStatus: 'idle' | 'loading' | 'polling' | 'completed' | 'failed';
  
  setOrder: (order: Order) => void;
  setPayment: (payment: Payment) => void;
  setShipment: (shipment: Shipment) => void;
  setSagaStatus: (status: OrderStore['sagaStatus']) => void;
  resetOrder: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  currentOrder: null,
  payment: null,
  shipment: null,
  sagaStatus: 'idle',
  
  setOrder: (order) => set({ currentOrder: order }),
  setPayment: (payment) => set({ payment }),
  setShipment: (shipment) => set({ shipment }),
  setSagaStatus: (status) => set({ sagaStatus: status }),
  resetOrder: () => set({
    currentOrder: null,
    payment: null,
    shipment: null,
    sagaStatus: 'idle',
  }),
}));
```

---

## ⚠️ Error Handling

### HTTP Status Codes & Meanings

| Status | Meaning | FE Action |
|--------|---------|-----------|
| 201 | Order created successfully | Show order ID, start polling |
| 400 | Bad request (empty cart, invalid data) | Show validation error |
| 404 | Order/Payment/Shipment not found | Retry or show error |
| 503 | Service unavailable (backend down) | Show "System temporarily unavailable" + retry option |
| 500 | Server error | Show generic error + log saga_id |

### Error Recovery Strategy

```typescript
const handleOrderError = (err: any, orderId: number) => {
  const status = err.response?.status;
  const message = err.response?.data?.error;

  if (status === 400) {
    // Validation error - show to user
    showToast('error', `Validation Error: ${message}`);
  } else if (status === 503) {
    // Service down - show retry option
    showToast('warning', 'System temporarily unavailable. Retrying in 5s...');
    setTimeout(() => pollOrderStatus(orderId), 5000);
  } else if (status === 500) {
    // Server error - log saga_id for debugging
    console.error(`Order failed. Saga ID: ${orderId}`);
    showToast('error', 'Order processing failed. Please contact support.');
  }
};
```

---

## 🧪 Testing Scenarios

### Scenario 1: Happy Path (All Success)

```typescript
const testHappyPath = async () => {
  const order = await createOrder(1, false, false);
  // Expected: status = CONFIRMED after 2-5 seconds
  assert(order.status === 'CONFIRMED');
};
```

### Scenario 2: Payment Failure (Auto)

```typescript
const testPaymentFailure = async () => {
  const order = await createOrder(1, true, false);  // force_payment_failure=true
  // Expected: status = CANCELLED after saga compensation
  assert(order.status === 'CANCELLED');
};
```

### Scenario 3: Shipment Failure (Auto)

```typescript
const testShippingFailure = async () => {
  const order = await createOrder(1, false, true);  // force_shipping_failure=true
  // Expected: status = CANCELLED after saga compensation
  assert(order.status === 'CANCELLED');
};
```

### Scenario 4: Manual Payment Rejection

```typescript
const testManualPaymentRejection = async () => {
  const order = await createOrder(1, false, false);
  await pollOrderStatus(1);
  await sleep(2000); // Wait for AUTO payment success
  await approvePayment(order.id, false);  // Manually reject
  // Expected: Payment.status = FAILED → saga triggers compensation
  assert(order.status === 'CANCELLED');
};
```

### Scenario 5: Both Failures

```typescript
const testBothFailures = async () => {
  const order = await createOrder(1, true, true);
  // Expected: status = CANCELLED (payment fails first, never reaches shipping)
  assert(order.status === 'CANCELLED');
};
```

---

## 📋 Checklist - FE Implementation

- [ ] Created custom hook `useOrderSaga()` with all 6 methods
- [ ] Implement polling logic with timeout (30s max)
- [ ] Show saga progress UI (Inventory → Payment → Shipping → Confirm)
- [ ] Handle 400/503/500 errors with user-friendly messages
- [ ] Add manual approval endpoints for payment & shipment
- [ ] Test all 5 scenarios above
- [ ] Display order status badges with proper styling
- [ ] Show saga_id in logs for debugging
- [ ] Add retry button for failed orders
- [ ] Clear cart after order is CONFIRMED

---

## 🔗 Related Endpoints

See [hd.md](./hd.md) for complete API reference:
- Orders: `/api/orders/`
- Payments: `/api/payments/{order_id}/` and `/api/payments/{order_id}/approve/`
- Shipments: `/api/shipments/{order_id}/` and `/api/shipments/{order_id}/approve/`

---

## 📞 Troubleshooting

**Order stuck in PENDING?**
- Inventory service down - check `/api/health/` for all services
- Check RabbitMQ is running (docker logs)

**Payment not transitioning to PAID?**
- Check if `force_payment_failure=true` was set - if yes, auto fails
- Otherwise manually call `/payments/{id}/approve/`

**Order stuck in COMPENSATING?**
- Compensation is in progress - wait 5-10 seconds
- If stuck longer, backend consumer may have crashed

**Saga_id for debugging:**
- Always log `order.saga_id` when order fails
- Use it to correlate with backend logs: `docker logs book_store_be-order-service-1 | grep saga_id`

