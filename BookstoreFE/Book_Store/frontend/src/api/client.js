import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
});

// Response interceptor to unwrap data, keeping the same behavior as the old get/post functions
api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export function getErrorMessage(error) {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (typeof error.response?.data === 'object' && error.response?.data) {
    return JSON.stringify(error.response.data);
  }

  return error.message || 'Request failed';
}

// -----------------------------------------------------------------------------
// Domain APIs
// -----------------------------------------------------------------------------

export const BooksApi = {
  list: () => api.get('/api/books/'),
  create: (payload) => api.post('/api/books/', payload),
  update: (id, payload) => api.put(`/api/books/${id}/`, payload),
  remove: (id) => api.delete(`/api/books/${id}/`),
};

export const AuthApi = {
  register: (payload) => api.post('/api/register/', payload),
  login: (payload) => api.post('/api/login/', payload),
};

export const CustomersApi = {
  list: () => api.get('/api/customers/'),
  create: (payload) => api.post('/api/customers/', payload),
};

export const CartApi = {
  createCart: (customer_id) => api.post('/api/carts/', { customer_id }),
  listByCustomer: (customerId) => api.get(`/api/carts/${customerId}/`),
  addItem: (payload) => api.post('/api/cart-items/', payload),
  updateItem: (itemId, payload) => api.put(`/api/cart-items/${itemId}/`, payload),
  removeItem: (itemId) => api.delete(`/api/cart-items/${itemId}/`),
};

export const OrdersApi = {
  list: () => api.get('/api/orders/'),
  create: (customer_id) => api.post('/api/orders/', { customer_id }),
  listByCustomer: (customerId) => api.get(`/api/orders/${customerId}/`),
};

export const PaymentsApi = {
  list: () => api.get('/api/payments/'),
  create: (payload) => api.post('/api/payments/', payload),
  listByOrder: (orderId) => api.get(`/api/payments/${orderId}/`),
};

export const ShipmentsApi = {
  list: () => api.get('/api/shipments/'),
  create: (payload) => api.post('/api/shipments/', payload),
  listByOrder: (orderId) => api.get(`/api/shipments/${orderId}/`),
};

export const ReviewsApi = {
  list: () => api.get('/api/reviews/'),
  create: (payload) => api.post('/api/reviews/', payload),
  listByBook: (bookId) => api.get(`/api/reviews/book/${bookId}/`),
};

export const ManagersApi = {
  list: () => api.get('/api/managers/'),
  create: (payload) => api.post('/api/managers/', payload),
};

export const CategoriesApi = {
  list: () => api.get('/api/categories/'),
  create: (payload) => api.post('/api/categories/', payload),
};

export const StaffBooksApi = {
  list: () => api.get('/api/staff/books/'),
  create: (payload) => api.post('/api/staff/books/', payload),
  update: (id, payload) => api.put(`/api/staff/books/${id}/`, payload),
  remove: (id) => api.delete(`/api/staff/books/${id}/`),
};

export const RecommendationsApi = {
  list: () => api.get('/api/recommendations/'),
};

// -----------------------------------------------------------------------------
// Legacy Exports (Retained for backward compatibility during refactoring)
// -----------------------------------------------------------------------------

export const get = (url) => api.get(url);
export const post = (url, data) => api.post(url, data);
export const put = (url, data) => api.put(url, data);
export const del = (url) => api.delete(url);

export const urls = {
  customer: '/api',
  book: '/api',
  cart: '/api',
  staff: '/api',
  order: '/api',
  pay: '/api',
  ship: '/api',
  review: '/api',
  manager: '/api',
  catalog: '/api',
  recommender: '/api',
};
