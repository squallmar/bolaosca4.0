// Config dinâmico para base da API e Socket sem hardcode de localhost
const host = window.location.hostname;
const currentPort = window.location.port;
// Heurística: se estamos no dev server (3002) apontar API para 3001; caso contrário usar mesma origem
let apiPort;
if (currentPort === '3002') {
	apiPort = 3001; // esperado padrão
} else if (currentPort) {
	apiPort = currentPort; // mesma porta (build servido pelo backend, incluindo fallback alt)
} else {
	apiPort = 80; // sem porta explícita (provavelmente 80/443); deixamos 80 para http
}
export const API_BASE = `${window.location.protocol}//${host}${apiPort && apiPort !== '80' && apiPort !== '443' ? ':'+apiPort : ''}`;
export const SOCKET_URL = API_BASE; // socket.io/chat
export function apiPath(p) { return p.startsWith('/') ? `${API_BASE}${p}` : `${API_BASE}/${p}`; }
export function uploadUrl(folder, filename) { return `${API_BASE}/uploads/${folder}/${filename}`; }
// Helper para decidir se estamos em ambiente local
export const IS_LOCAL = (host === 'localhost' || host.startsWith('192.168.') || host.startsWith('10.') || host === '127.0.0.1');
