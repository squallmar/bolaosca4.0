import express from 'express';
import pool from './db.js';
import { safeQuery, sanitizeText } from './utils.js';
import { logger } from './logger.js';
import { exigirAutenticacao } from './auth.js';

const router = express.Router();

// Listar posts (público)
router.get('/', async (req, res) => {
  try {
    let rows = await safeQuery(
      pool,
      `SELECT p.id, p.titulo, p.conteudo, p.criado_em, p.atualizado_em,
              u.id as autor_id, u.nome as autor_nome
         FROM post p
         JOIN usuario u ON u.id = p.autor_id
        WHERE TRUE
        ORDER BY p.criado_em DESC`
    );
    // Sanitiza saída (defensivo) – o conteúdo já foi sanitizado na entrada
    rows = rows.map(r => ({
      ...r,
      titulo: sanitizeText(r.titulo),
      conteudo: sanitizeText(r.conteudo)
    }));
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar posts:', err);
    res.status(500).json({ error: 'Erro ao listar posts' });
  }
});

// Obter um post (público)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
  const rows = await safeQuery(pool, `SELECT * FROM post WHERE id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Post não encontrado' });
  const r = rows[0];
  r.titulo = sanitizeText(r.titulo);
  r.conteudo = sanitizeText(r.conteudo);
  res.json(r);
  } catch (err) {
    console.error('Erro ao obter post:', err);
    res.status(500).json({ error: 'Erro ao obter post' });
  }
});

// Criar post (autenticado)
router.post('/', exigirAutenticacao, async (req, res) => {
  try {
    const { titulo, conteudo } = req.body || {};
    if (!titulo || !conteudo) {
      return res.status(400).json({ error: 'Campos obrigatórios: titulo, conteudo' });
    }
    const autorId = req.user?.id;
    const rows = await safeQuery(
      pool,
      `INSERT INTO post (autor_id, titulo, conteudo) VALUES ($1, $2, $3) RETURNING *`,
      [autorId, sanitizeText(titulo), sanitizeText(conteudo)]
    );
  logger.info('audit_blog_create', { postId: rows[0].id, autorId: autorId });
  res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erro ao criar post:', err);
    res.status(500).json({ error: 'Erro ao criar post' });
  }
});

// Atualizar post (autor ou admin)
router.put('/:id', exigirAutenticacao, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, conteudo } = req.body || {};
    const me = req.user;
    const atual = await safeQuery(pool, `SELECT autor_id FROM post WHERE id = $1`, [id]);
    if (!atual[0]) return res.status(404).json({ error: 'Post não encontrado' });
    const isOwner = String(atual[0].autor_id) === String(me.id);
    const isAdmin = (me.role || '') === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Sem permissão' });
    const rows = await safeQuery(
      pool,
      `UPDATE post SET titulo = COALESCE($1, titulo), conteudo = COALESCE($2, conteudo), atualizado_em = NOW() WHERE id = $3 RETURNING *`,
      [titulo ? sanitizeText(titulo) : null, conteudo ? sanitizeText(conteudo) : null, id]
    );
  logger.info('audit_blog_update', { postId: rows[0].id, userId: me.id });
  res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar post:', err);
    res.status(500).json({ error: 'Erro ao atualizar post' });
  }
});

// Excluir post (autor ou admin)
router.delete('/:id', exigirAutenticacao, async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user;
    const atual = await safeQuery(pool, `SELECT autor_id FROM post WHERE id = $1`, [id]);
    if (!atual[0]) return res.status(404).json({ error: 'Post não encontrado' });
    const isOwner = String(atual[0].autor_id) === String(me.id);
    const isAdmin = (me.role || '') === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Sem permissão' });
    await safeQuery(pool, `DELETE FROM post WHERE id = $1`, [id]);
  logger.info('audit_blog_delete', { postId: id, userId: me.id });
  res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir post:', err);
    res.status(500).json({ error: 'Erro ao excluir post' });
  }
});

export default router;