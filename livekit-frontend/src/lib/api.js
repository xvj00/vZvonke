import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    Accept: 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const authApi = {
  async getUser() {
    const response = await api.get('/user');
    return response.data;
  },
  async login(payload) {
    const response = await api.post('/login', payload);
    return response.data;
  },
  async register(payload) {
    const response = await api.post('/register', payload);
    return response.data;
  },
  async logout() {
    return api.post('/logout');
  },
  async getLivekitToken(payload) {
    const response = await api.post('/get-token', payload);
    return response.data;
  },
};

export const isValidationError = (error) =>
  error?.response?.status === 422 || error?.response?.status === 419;

export const extractFieldErrors = (error) => {
  const errors = error?.response?.data?.errors;
  if (!errors || typeof errors !== 'object') return {};
  return Object.keys(errors).reduce((acc, key) => {
    const value = errors[key];
    if (Array.isArray(value) && value.length > 0) {
      acc[key] = value[0];
    }
    return acc;
  }, {});
};
