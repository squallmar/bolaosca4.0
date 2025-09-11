import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/db.js';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escudosDir = path.join(__dirname, '..', 'uploads', 'escudos');
const baseUrl = 'http://localhost:3001/uploads/escudos/';

function slugify(nome = '') {
  return String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function atualizaEscudos() {
  const { rows: times } = await pool.query('SELECT id, nome FROM times');
  for (const t of times) {
    const slug = slugify(t.nome || '');
    const escudoFile = fs.readdirSync(escudosDir).find(f =>
      f.endsWith('.png') && f.includes(slug)
    );
    const escudo_url = escudoFile ? baseUrl + escudoFile : baseUrl + '_default.png';
    await pool.query('UPDATE times SET escudo_url = $1 WHERE id = $2', [escudo_url, t.id]);
    console.log(`Time: ${t.nome} -> ${escudo_url}`);
  }
  await pool.end();
  console.log('Escudos atualizados no banco!');
}

atualizaEscudos();

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
const uploadEscudo = multer({ storage });