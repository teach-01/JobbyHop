import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jobbyhop_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor for auth expiration
API.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('jobbyhop_token');
      localStorage.removeItem('jobbyhop_user');
      sessionStorage.removeItem('jobbyhop_token');
      sessionStorage.removeItem('jobbyhop_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?session_expired=true';
      }
    }
    return Promise.reject(
      error.response?.data?.message || error.message || 'An unexpected error occurred'
    );
  }
);

export default API;
