// config.js
// Config dinâmico para base da API e Socket

// URL do backend no Render
const RENDER_BACKEND_URL = 'https://bolaosca4-0.onrender.com';

export const API_BASE = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' || 
   window.location.hostname.startsWith('192.168.') || 
   window.location.hostname.startsWith('10.') || 
   window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'  // Desenvolvimento local
    : RENDER_BACKEND_URL);     // Produção (Render)

export const SOCKET_URL = API_BASE;
export function apiPath(p) { return p.startsWith('/') ? `${API_BASE}${p}` : `${API_BASE}/${p}`; }
export function uploadUrl(folder, filename) { return `${API_BASE}/uploads/${folder}/${filename}`; }

// Helper para decidir se estamos em ambiente local
export const IS_LOCAL = (window.location.hostname === 'localhost' || 
  window.location.hostname.startsWith('192.168.') || 
  window.location.hostname.startsWith('10.') || 
  window.location.hostname === '127.0.0.1');