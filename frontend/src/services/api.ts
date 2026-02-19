import axios, { AxiosInstance } from 'axios';
import Cookie from 'js-cookie';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = Cookie.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      Cookie.remove('token');
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
