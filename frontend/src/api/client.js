import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const urls = {
  customer: `${apiBaseUrl}/api`,
  book: `${apiBaseUrl}/api`,
  cart: `${apiBaseUrl}/api`,
  staff: `${apiBaseUrl}/api`,
  order: `${apiBaseUrl}/api`,
  pay: `${apiBaseUrl}/api`,
  ship: `${apiBaseUrl}/api`,
  review: `${apiBaseUrl}/api`,
  manager: `${apiBaseUrl}/api`,
  catalog: `${apiBaseUrl}/api`,
  recommender: `${apiBaseUrl}/api`,
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
