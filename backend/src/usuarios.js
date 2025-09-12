import express from 'express';
import pool from './db.js';
import { exigirAutenticacao, exigirRole } from './auth.js';
import bcrypt from 'bcrypt';
import { logger } from './logger.js';
import { getPagination, safeQuery } from './utils.js';

const auth = exigirAutenticacao;
const router = express.Router();

// >>> ADICIONE ESTE HELPER <<<
async function ensureAdmin(req) {
  const role = (req.user?.role || req.user?.tipo || '').toLowerCase();
  if (!req.user) return { ok: false, status: 401, msg: 'Sessão expirada. Faça login' };
  if (role !== 'admin') return { ok: false, status: 403, msg: 'Acesso negado' };
  if (req.user.autorizado === false) return { ok: false, status: 403, msg: 'Usuário não autorizado' };
  return { ok: true };
}

// Lista de usuários (somente admin)
router.get('/', auth, exigirRole('admin'), async (req, res) => {
  try {
    const { page, pageSize, offset } = getPagination(req, 30, 100);
    // monte seus filtros atuais
    const params = [];
    const where = [];
    if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(u.nome ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
    if (req.query.pendentes === 'true') where.push(`u.autorizado = false`);
    if (req.query.autorizados === 'true') where.push(`u.autorizado = true`);
    if (req.query.administradores === 'true') where.push(`u.tipo = 'admin'`);
    if (req.query.banidos === 'true') where.push(`COALESCE(u.banido,false) = true`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // total
    const rCount = await safeQuery(pool, `SELECT COUNT(*)::int AS total FROM usuario u ${whereSql}`, params);
    const total = rCount[0]?.total || 0;

    // página
    params.push(pageSize, offset);
    const rows = await safeQuery(
      pool,
      `SELECT u.id, u.nome, u.email, u.tipo, u.autorizado,
              COALESCE(u.banido,false)   AS banido,
              COALESCE(u.desistiu,false) AS desistiu,
              COALESCE(u.foto_url, u.avatar_url) AS foto_url
       FROM usuario u
       ${whereSql}
       ORDER BY u.nome ASC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );

    return res.json({ items: rows, total, page, pageSize });
  } catch (e) {
    console.error('Lista usuarios pag:', e);
    res.status(500).json({ erro: 'Falha ao listar usuários' });
  }
});

// Obter um usuário por id (inclua apelido)
router.get('/:id', auth, async (req, res) => {
  const perm = await ensureAdmin(req, res);
  if (!perm.ok) return res.status(perm.status).json({ erro: perm.msg });
  try {
    const { id } = req.params;
    const rows = await safeQuery(
      pool,
      `SELECT id, nome, email, tipo, autorizado,
              COALESCE(banido,false)   AS banido,
              COALESCE(desistiu,false) AS desistiu,
              apelido,
              COALESCE(foto_url, avatar_url) AS foto_url
       FROM usuario
       WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
  logger.info('audit_user_update', { adminId: req.user.id, targetUserId: id });
  res.json(rows[0]);
  } catch (e) {
    console.error('Erro obter usuario:', e);
    res.status(500).json({ erro: 'Falha ao obter usuário' });
  }
});

// Atualizar usuário (inclua apelido aqui)
router.put('/:id', auth, async (req, res) => {
  const perm = await ensureAdmin(req, res);
  if (!perm.ok) return res.status(perm.status).json({ erro: perm.msg });
  try {
    const { id } = req.params;
    const { nome, apelido, tipo, autorizado, banido, foto_url } = req.body || {};
    if (tipo && !['admin', 'user'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido' });

    const rows = await safeQuery(
      pool,
  `UPDATE usuario
         SET nome       = COALESCE($1, nome),
             apelido    = COALESCE($2, apelido),
             tipo       = COALESCE($3, tipo),
             autorizado = COALESCE($4, autorizado),
             banido     = COALESCE($5, banido),
             foto_url   = COALESCE($6, foto_url)
       WHERE id = $7
   RETURNING id, nome, email, tipo, autorizado,
         COALESCE(banido,false)   AS banido,
         COALESCE(desistiu,false) AS desistiu,
         apelido,
         COALESCE(foto_url, avatar_url) AS foto_url`,
      [nome ?? null, apelido ?? null, tipo ?? null, autorizado ?? null, banido ?? null, foto_url ?? null, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
    logger.info('audit_user_ban', { adminId: req.user.id, targetUserId: id, banido: !!(banido ?? rows[0].banido) });
  res.json(rows[0]);
  } catch (e) {
    console.error('Erro atualizar usuario:', e);
    res.status(500).json({ erro: 'Falha ao atualizar usuário' });
  }
});

// Banir usuário (somente admin)
router.post('/:id/banir', auth, exigirRole('admin'), async (req, res) => {
  const perm = await ensureAdmin(req, res);
  if (!perm.ok) return res.status(perm.status).json({ erro: perm.msg });
  try {
    const { id } = req.params;
    const { banir } = req.body || {};
  const { rows } = await pool.query(
      `UPDATE usuario
         SET banido = $1
       WHERE id = $2
     RETURNING id, nome, email, tipo, autorizado,
         COALESCE(banido,false)   AS banido,
         COALESCE(desistiu,false) AS desistiu,
         COALESCE(foto_url, avatar_url) AS foto_url`,
      [!!banir, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
  logger.info('audit_user_ban', { adminId: req.user.id, targetUserId: id, banido: !!banir });
  res.json(rows[0]);
  } catch (e) {
    console.error('Erro banir usuario:', e);
    res.status(500).json({ erro: 'Falha ao banir/desbanir usuário' });
  }
});

// Marcar desistência usuário (somente admin)
router.post('/:id/desistir', auth, exigirRole('admin'), async (req, res) => {
  const perm = await ensureAdmin(req, res);
  if (!perm.ok) return res.status(perm.status).json({ erro: perm.msg });
  try {
    const { id } = req.params;
    const { desistiu } = req.body || {};
  const { rows } = await pool.query(
      `UPDATE usuario
         SET desistiu = $1
       WHERE id = $2
     RETURNING id, nome, email, tipo, autorizado,
         COALESCE(banido,false)  AS banido,
         COALESCE(desistiu,false) AS desistiu,
         COALESCE(foto_url, avatar_url) AS foto_url`,
      [!!desistiu, id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('Erro marcar desistiu:', e);
    res.status(500).json({ erro: 'Falha ao marcar desistência' });
  }
});

// Remover usuário (somente admin)
router.delete('/:id', auth, exigirRole('admin'), async (req, res) => {
  const perm = await ensureAdmin(req, res);
  if (!perm.ok) return res.status(perm.status).json({ erro: perm.msg });
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM usuario WHERE id = $1', [id]);
    if (del.rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado' });
  logger.info('audit_user_delete', { adminId: req.user.id, targetUserId: id });
  res.json({ ok: true });
  } catch (e) {
    console.error('Erro excluir usuario:', e);
    res.status(500).json({ erro: 'Falha ao excluir usuário' });
  }
});

// Alterar senha usuário (somente admin)
router.patch('/:id/senha', auth, async (req, res) => {
  const perm = await ensureAdmin(req);
  if (!perm.ok) return res.status(perm.status).json({ error: perm.msg });
  try {
    const { id } = req.params;
    const { senha } = req.body || {};
    if (!senha || senha.length < 6) return res.status(400).json({ error: 'Senha inválida' });
  const cost = Number(process.env.BCRYPT_COST) >= 10 && Number(process.env.BCRYPT_COST) <= 14 ? Number(process.env.BCRYPT_COST) : 12;
  const hash = await bcrypt.hash(senha, cost);
    const { rowCount } = await pool.query(`UPDATE usuario SET senha = $1 WHERE id = $2`, [hash, id]);
    if (!rowCount) return res.status(404).json({ error: 'Usuário não encontrado' });
  logger.info('audit_user_password_reset', { adminId: req.user.id, targetUserId: id });
  res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /usuario/:id/senha', e);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

export { exigirAutenticacao, exigirRole };
export default router;