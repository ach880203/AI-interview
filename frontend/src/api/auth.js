import api from './axios';

/** POST /api/auth/register */
export const register = (body) => api.post('/api/auth/register', body);

/** POST /api/auth/login → { accessToken, refreshToken } */
export const login = (body) => api.post('/api/auth/login', body);

/** POST /api/auth/refresh */
export const refresh = (refreshToken) =>
  api.post('/api/auth/refresh', { refreshToken });

/** POST /api/auth/logout */
export const logout = () => api.post('/api/auth/logout');

/** GET /api/auth/me */
export const getMe = () => api.get('/api/auth/me');

/** PATCH /api/auth/me */
export const updateMe = (body) => api.patch('/api/auth/me', body);
