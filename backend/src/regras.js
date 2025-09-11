import express from 'express';
import fs from 'fs';
import path from 'path';
import { exigirAutenticacao } from './auth.js';
import { sanitizeText } from './utils.js';

const router = express.Router();

// Diretório e arquivo onde o regulamento será armazenado
const regrasDir = path.join(process.cwd(), 'uploads', 'regras');
const regrasFile = path.join(regrasDir, 'regulamento.txt');
if (!fs.existsSync(regrasDir)) fs.mkdirSync(regrasDir, { recursive: true });

// Se não existir arquivo ainda, cria com texto padrão mínimo
if (!fs.existsSync(regrasFile)) {
  fs.writeFileSync(regrasFile, 'REGULAMENTO BOLÃO SCA 2025\n\n(editar via painel admin)', 'utf8');
}

function isAdmin(req, res, next) {
  const role = (req.user?.role || req.user?.tipo || '').toLowerCase();
  if (role !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  next();
}

// GET /regras -> retorna conteúdo
router.get('/', (req, res) => {
  try {
  const original = fs.readFileSync(regrasFile, 'utf8');
  const texto = sanitizeText(original);
    const stats = fs.statSync(regrasFile);
    res.json({ texto, updatedAt: stats.mtime });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao ler regras' });
  }
});

// PUT /regras -> atualiza conteúdo (admin)
router.put('/', exigirAutenticacao, isAdmin, (req, res) => {
  const { texto } = req.body || {};
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ erro: 'Texto obrigatório' });
  }
  if (texto.length > 20000) {
    return res.status(400).json({ erro: 'Limite de 20000 caracteres excedido' });
  }
  try {
  fs.writeFileSync(regrasFile, sanitizeText(texto), 'utf8');
    const stats = fs.statSync(regrasFile);
    res.json({ ok: true, updatedAt: stats.mtime });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao salvar regras' });
  }
});

export default router;
