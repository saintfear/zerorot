import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  // This module is typically used from client components, but guard anyway.
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// If the token is missing/invalid/expired, force re-auth.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const msg = error?.response?.data?.error;
    const looksLikeAuthError =
      status === 401 ||
      status === 403 ||
      (typeof msg === 'string' &&
        (msg.toLowerCase().includes('token') ||
          msg.toLowerCase().includes('access token') ||
          msg.toLowerCase().includes('unauthorized')));

    if (typeof window !== 'undefined' && looksLikeAuthError) {
      window.localStorage.removeItem('token');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: (email: string, password: string, name?: string) =>
    api.post('/auth/signup', { email, password, name }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

export const userAPI = {
  getMe: () => api.get('/users/me'),
  updatePreferences: (preferences: any) =>
    api.put('/users/preferences', { preferences }),
  updateInstagramCookies: (cookies: string) =>
    api.put('/users/instagram-cookies', { cookies }),
};

export const contentAPI = {
  discover: (page?: number) => api.post('/content/discover', page ? { page } : {}),
  getSaved: () => api.get('/content/saved'),
  rate: (itemId: string, rating: 1 | -1) =>
    api.put(`/content/items/${itemId}/rate`, { rating }),
};

export const newsletterAPI = {
  getAll: () => api.get('/newsletters'),
  send: () => api.post('/newsletters/send'),
};

export default api;
