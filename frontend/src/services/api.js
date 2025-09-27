import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // necessário se usa sessão/cookie httpOnly
});

// Permite configurar Authorization Bearer globalmente (fallback quando cookie cross-site for bloqueado)
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}


// Sempre injeta Bearer Token se existir
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // sessão/token inválido
      localStorage.removeItem('token');
    }
    return Promise.reject(err);
  }
);

export default api;