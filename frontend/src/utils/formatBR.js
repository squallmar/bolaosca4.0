// Utils de data/hora sem fuso horário
// Espera strings "YYYY-MM-DD HH:mm" vindas do backend

export function formatBR(dateStr) {
  if (!dateStr) return 'Não definido ainda';
  const [d, t = '00:00'] = String(dateStr).split(' ');
  if (!d || !d.includes('-')) return String(dateStr);
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y} ${t}`;
}

// Converte "YYYY-MM-DD HH:mm" -> "YYYY-MM-DDTHH:mm" para <input type="datetime-local">
export function toInputValue(dateStr) {
  if (!dateStr) return '';
  const [d, t = '00:00'] = String(dateStr).split(' ');
  return d && t ? `${d}T${t}` : '';
}

// Converte valor do input "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DD HH:mm"
export function fromInputValue(inputVal) {
  if (!inputVal) return '';
  return String(inputVal).replace('T', ' ');
}
