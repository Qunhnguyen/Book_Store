import axios from 'axios';

export const urls = {
  customer: import.meta.env.VITE_CUSTOMER_API || 'http://localhost:8001',
  book: import.meta.env.VITE_BOOK_API || 'http://localhost:8002',
  cart: import.meta.env.VITE_CART_API || 'http://localhost:8003',
  staff: import.meta.env.VITE_STAFF_API || 'http://localhost:8004',
  order: import.meta.env.VITE_ORDER_API || 'http://localhost:8005',
  pay: import.meta.env.VITE_PAY_API || 'http://localhost:8006',
  ship: import.meta.env.VITE_SHIP_API || 'http://localhost:8007',
  review: import.meta.env.VITE_REVIEW_API || 'http://localhost:8008',
  manager: import.meta.env.VITE_MANAGER_API || 'http://localhost:8009',
  catalog: import.meta.env.VITE_CATALOG_API || 'http://localhost:8010',
  recommender: import.meta.env.VITE_RECOMMENDER_API || 'http://localhost:8011',
};

export async function get(url) {
  const response = await axios.get(url);
  return response.data;
}

export async function post(url, data) {
  const response = await axios.post(url, data);
  return response.data;
}

export async function put(url, data) {
  const response = await axios.put(url, data);
  return response.data;
}

export async function del(url) {
  const response = await axios.delete(url);
  return response.data;
}

export function getErrorMessage(error) {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (typeof error.response?.data === 'object' && error.response?.data) {
    return JSON.stringify(error.response.data);
  }

  return error.message || 'Request failed';
}
