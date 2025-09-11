import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de times (ajuste conforme seu backend)
const timesPath = path.join(__dirname, '..', 'data', 'times.json'); // exemplo
const escudosDir = path.join(__dirname, '..', 'uploads', 'escudos');
const baseUrl = 'http://localhost:3001/uploads/escudos/';

// Função para encontrar escudo pelo nome do time
function slugify(nome = '') {
  return String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Carrega times
const times = JSON.parse(fs.readFileSync(timesPath, 'utf8'));

// Atualiza escudo_url para cada time
for (const t of times) {
  const slug = slugify(t.nome || t.name || '');
  // Procura arquivo que começa com slug (com ou sem timestamp)
  const escudoFile = fs.readdirSync(escudosDir).find(f =>
    f.endsWith('.png') && f.includes(slug)
  );
  t.escudo_url = escudoFile ? baseUrl + escudoFile : baseUrl + '_default.png';
}

// Salva de volta
fs.writeFileSync(timesPath, JSON.stringify(times, null, 2), 'utf8');
console.log('Escudos atualizados!');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, escudosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase();
    const base = path
      .basename(file.originalname || 'escudo', ext)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    cb(null, `${Date.now()}-${base}${ext || '.png'}`);
  },
});
export const uploadEscudo = multer({ storage });