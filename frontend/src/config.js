// Config dinâmico para base da API e Socket sem hardcode de localhost
// Usa variável de ambiente para base da API, permitindo configuração no Vercel
export const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}${window.location.port && window.location.port !== '80' && window.location.port !== '443' ? ':'+window.location.port : ''}`;
export const SOCKET_URL = API_BASE; // socket.io/chat
export function apiPath(p) { return p.startsWith('/') ? `${API_BASE}${p}` : `${API_BASE}/${p}`; }
export function uploadUrl(folder, filename) { return `${API_BASE}/uploads/${folder}/${filename}`; }
// Helper para decidir se estamos em ambiente local
export const IS_LOCAL = (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.') || window.location.hostname === '127.0.0.1');
