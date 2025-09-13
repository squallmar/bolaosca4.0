import express from 'express';
import pool from './db.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sanitizeText, sanitizeMediaUrl } from './utils.js';

const router = express.Router();

// Middleware para verificar admin (aceita cookie httpOnly ou Bearer)
async function isAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  let token = null;
  if (header.startsWith('Bearer ')) token = header.slice(7);
  if (!token && req.cookies?.token) token = req.cookies.token;
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Revalida no banco: tipo admin e autorizado
    const { rows } = await pool.query('SELECT id, tipo, autorizado FROM usuario WHERE id = $1', [decoded.id]);
    const u = rows[0];
    if (!u || u.tipo !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
    if (!u.autorizado) return res.status(403).json({ erro: 'Admin não autorizado' });
    req.adminId = u.id;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

// Configuração do multer para uploads de imagem (apenas uma declaração)
// Usar memoryStorage para produção (Vercel/Render não tem filesystem)
const storage = multer.memoryStorage();
// ...existing code...

const upload = multer({ storage });

// Listar usuários não autorizados
router.get('/usuarios-pendentes', isAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usuario WHERE autorizado = false');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuários pendentes.' });
  }
});

// Autorizar usuário
router.post('/autorizar/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE usuario SET autorizado = true WHERE id = $1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao autorizar usuário.' });
  }
});

// Cadastrar anúncio para TV com imagem
router.post('/anuncio', isAdmin, upload.single('imagem'), async (req, res) => {
  let { titulo, descricao } = req.body || {};
  titulo = sanitizeText(titulo || '').slice(0, 200);
  descricao = sanitizeText(descricao || '').slice(0, 2000);
  if (!titulo || !descricao) return res.status(400).json({ erro: 'Título e descrição obrigatórios.' });
  try {
    let imagem_url = null;
    if (req.file) {
      // Envia para Cloudinary na pasta 'anuncios'
      const { v2: cloudinary } = await import('cloudinary');
      try {
        const result = await cloudinary.uploader.upload_stream({ folder: 'anuncios' }, (error, result) => {
          if (error || !result) throw error || new Error('Falha no upload Cloudinary');
          imagem_url = result.secure_url;
        });
        // Como estamos usando memoryStorage, precisamos enviar o buffer
        result.end(req.file.buffer);
      } catch (err) {
        return res.status(500).json({ erro: 'Falha ao enviar imagem para Cloudinary.' });
      }
    }
    await pool.query('INSERT INTO anuncio_tv (titulo, descricao, admin_id, imagem_url) VALUES ($1, $2, $3, $4)', [titulo, descricao, req.adminId, imagem_url]);
    return res.json({ sucesso: true });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao cadastrar anúncio.' });
  }
});

// Listar anúncios para TV
router.get('/anuncios', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, titulo, descricao, criado_em, imagem_url FROM anuncio_tv ORDER BY criado_em DESC LIMIT 20'
    );
    const rows = result.rows.map(r => ({
      ...r,
      imagem_url: sanitizeMediaUrl(r.imagem_url, 'anuncio')
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar anúncios.' });
  }
});

// Atualizar anúncio para TV
router.put('/anuncios/:id', isAdmin, upload.single('imagem'), async (req, res) => {
  const { id } = req.params;
  let { titulo, descricao } = req.body || {};
  titulo = sanitizeText(titulo || '').slice(0, 200);
  descricao = sanitizeText(descricao || '').slice(0, 2000);
  if (!titulo || !descricao) return res.status(400).json({ erro: 'Título e descrição obrigatórios.' });
  try {
    let imagem_url = undefined;
    if (req.file) {
      // Envia para Cloudinary na pasta 'anuncios'
      const { v2: cloudinary } = await import('cloudinary');
      try {
        const result = await cloudinary.uploader.upload_stream({ folder: 'anuncios' }, (error, result) => {
          if (error || !result) throw error || new Error('Falha no upload Cloudinary');
          imagem_url = result.secure_url;
        });
        result.end(req.file.buffer);
      } catch (err) {
        return res.status(500).json({ erro: 'Falha ao enviar imagem para Cloudinary.' });
      }
    }
    if (typeof imagem_url !== 'undefined') {
      await pool.query('UPDATE anuncio_tv SET titulo = $1, descricao = $2, imagem_url = $3 WHERE id = $4', [titulo, descricao, imagem_url, id]);
    } else {
      await pool.query('UPDATE anuncio_tv SET titulo = $1, descricao = $2 WHERE id = $3', [titulo, descricao, id]);
    }
    return res.json({ sucesso: true });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao atualizar anúncio.' });
  }
});

// Excluir anúncio para TV
router.delete('/anuncio/:id', isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM anuncio_tv WHERE id = $1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir anúncio.' });
  }
});

// Desbloquear IP bloqueado (admin)
router.post('/desbloquear-ip', isAdmin, async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ erro: 'IP não informado' });
  await pool.query('UPDATE login_blocked_ip SET desbloqueado = true WHERE ip = $1', [ip]);
  res.json({ ok: true });
});

// Listar IPs bloqueados
router.get('/blocked-ips', isAdmin, async (req, res) => {
  try {
    // Descobre colunas realmente existentes (para evitar erro em bancos antigos)
    const { rows: colsRows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'login_blocked_ip'
    `);
    const cols = colsRows.map(r => r.column_name);
    const hasEmail = cols.includes('email');
    const hasNome = cols.includes('nome_usuario');
    const selectCols = ['ip', 'bloqueado_em'];
    if (hasEmail) selectCols.push('email');
    if (hasNome) selectCols.push('nome_usuario');
    const sql = `SELECT ${selectCols.join(', ')} FROM login_blocked_ip WHERE COALESCE(desbloqueado,false) = false ORDER BY bloqueado_em DESC`;
    const result = await pool.query(sql);
    // Se colunas faltam, sinaliza no payload
    if (!hasEmail || !hasNome) {
      return res.json({ items: result.rows, aviso: 'Colunas ausentes adicionáveis com: ALTER TABLE login_blocked_ip ADD COLUMN email VARCHAR(100); ALTER TABLE login_blocked_ip ADD COLUMN nome_usuario VARCHAR(100);' });
    }
    res.json({ items: result.rows });
  } catch (e) {
    console.error('Erro /admin/blocked-ips:', e);
    res.status(500).json({ erro: 'Falha ao listar IPs bloqueados' });
  }
});

// SSE para notificar admin sobre IPs bloqueados
let sseClients = [];
router.get('/blocked-ips-events', isAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

function notifyBlockedIP(ip, email, nome_usuario) {
  const msg = `IP bloqueado: ${ip}${email ? ' | Email: ' + email : ''}${nome_usuario ? ' | Nome: ' + nome_usuario : ''}`;
  sseClients.forEach(client => {
    client.write(`data: ${msg}\n\n`);
  });
}

export { notifyBlockedIP };
export default router;