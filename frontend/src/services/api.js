import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '';
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true // garante envio de cookies
});

// Permite configurar Authorization Bearer globalmente (fallback quando cookie cross-site for bloqueado)
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// Cache simples em memória para evitar buscar CSRF a cada request
let _csrfToken = null;
let _csrfFetching = null;

async function ensureCsrf() {
  if (_csrfToken) return _csrfToken;
  if (_csrfFetching) return _csrfFetching;
  _csrfFetching = fetch(`${API_BASE}/csrf-token`, { credentials: 'include' })
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
    // Sempre pega o valor do cookie XSRF-TOKEN
    let xsrf = null;
    try {
      xsrf = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
    } catch {}
    if (xsrf) {
      const val = decodeURIComponent(xsrf.split('=')[1] || '');
      if (val) config.headers['X-CSRF-Token'] = val;
    } else {
      // fallback: busca do endpoint se não houver cookie
      const t = await ensureCsrf();
      if (t) config.headers['X-CSRF-Token'] = t;
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