import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // necessário se usa sessão/cookie httpOnly
});

// Cache simples em memória para evitar buscar CSRF a cada request
let _csrfToken = null;
let _csrfFetching = null;

async function ensureCsrf() {
  if (_csrfToken) return _csrfToken;
  if (_csrfFetching) return _csrfFetching;
  _csrfFetching = fetch('/api/csrf-token', { credentials: 'include' })
    .then(r => r.json())
    .then(d => { _csrfToken = d.csrfToken; return _csrfToken; })
    .catch(() => null)
    .finally(() => { _csrfFetching = null; });
  return _csrfFetching;
}

api.interceptors.request.use(async (config) => {
  // Não injeta mais Bearer do localStorage; usamos cookie httpOnly
  const protectedMethods = ['post','put','patch','delete'];
  if (protectedMethods.includes((config.method || '').toLowerCase())) {
    const t = await ensureCsrf();
    if (t) {
      config.headers['X-CSRF-Token'] = t; // backend aceita este header
    }
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