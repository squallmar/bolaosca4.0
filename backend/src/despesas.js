import express from 'express';
import pool from './db.js';
import { exigirAutenticacao, exigirRole } from './auth.js';
import { sanitizeText, getPagination } from './utils.js';

const router = express.Router();

// Garante que a tabela exista (idempotente)
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS despesa (
      id           SERIAL PRIMARY KEY,
      descricao    VARCHAR(255) NOT NULL,
      valor        NUMERIC(10,2) NOT NULL,
      data         DATE NOT NULL,
      recorrente   BOOLEAN NOT NULL DEFAULT FALSE,
      frequencia   VARCHAR(20),
      usuario_id   INTEGER REFERENCES usuario(id) ON DELETE CASCADE,
      criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

ensureTable().catch(e => console.error('[despesas] Falha ao criar tabela:', e.message));

const FREQUENCIAS_VALIDAS = ['diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];

// Lista despesas (admin vê todas; usuário comum vê as suas)
router.get('/', exigirAutenticacao, async (req, res) => {
  try {
    const { page, pageSize, offset } = getPagination(req, 20, 100);
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';

    const params = [];
    let where = '';
    if (!isAdmin) {
      params.push(req.user.id);
      where = 'WHERE d.usuario_id = $1';
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM despesa d ${where}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    params.push(pageSize, offset);
    const rows = await pool.query(
      `SELECT d.id, d.descricao, d.valor, d.data, d.recorrente, d.frequencia,
              d.usuario_id, d.criado_em, u.nome AS usuario_nome
         FROM despesa d
         LEFT JOIN usuario u ON u.id = d.usuario_id
         ${where}
         ORDER BY d.data DESC, d.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ items: rows.rows, total, page, pageSize });
  } catch (err) {
    console.error('GET /despesas', err);
    res.status(500).json({ erro: 'Erro ao listar despesas.' });
  }
});

// Obtém uma despesa pelo id
router.get('/:id', exigirAutenticacao, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';
    const rows = await pool.query(
      `SELECT d.id, d.descricao, d.valor, d.data, d.recorrente, d.frequencia,
              d.usuario_id, d.criado_em, u.nome AS usuario_nome
         FROM despesa d
         LEFT JOIN usuario u ON u.id = d.usuario_id
         WHERE d.id = $1`,
      [id]
    );
    const despesa = rows.rows[0];
    if (!despesa) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    if (!isAdmin && despesa.usuario_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }
    res.json(despesa);
  } catch (err) {
    console.error('GET /despesas/:id', err);
    res.status(500).json({ erro: 'Erro ao obter despesa.' });
  }
});

// Cria uma despesa
router.post('/', exigirAutenticacao, async (req, res) => {
  try {
    let { descricao, valor, data, recorrente, frequencia } = req.body || {};

    descricao = sanitizeText(String(descricao || '')).slice(0, 255);
    if (!descricao) return res.status(400).json({ erro: 'Descrição obrigatória.' });

    valor = parseFloat(valor);
    if (isNaN(valor) || valor < 0) return res.status(400).json({ erro: 'Valor inválido.' });

    if (!data) return res.status(400).json({ erro: 'Data obrigatória.' });

    // Normaliza booleano: aceita true, "true", 1, "1"
    recorrente = recorrente === true || recorrente === 'true' || recorrente === 1 || recorrente === '1';

    if (recorrente) {
      if (!frequencia || !FREQUENCIAS_VALIDAS.includes(frequencia)) {
        return res.status(400).json({ erro: `Frequência inválida. Válidas: ${FREQUENCIAS_VALIDAS.join(', ')}.` });
      }
    } else {
      frequencia = null;
    }

    const result = await pool.query(
      `INSERT INTO despesa (descricao, valor, data, recorrente, frequencia, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, descricao, valor, data, recorrente, frequencia, usuario_id, criado_em`,
      [descricao, valor, data, recorrente, frequencia, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /despesas', err);
    res.status(500).json({ erro: 'Erro ao criar despesa.' });
  }
});

// Atualiza uma despesa
router.put('/:id', exigirAutenticacao, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';

    // Verifica propriedade
    const existing = await pool.query('SELECT usuario_id FROM despesa WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    if (!isAdmin && existing.rows[0].usuario_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    let { descricao, valor, data, recorrente, frequencia } = req.body || {};

    descricao = sanitizeText(String(descricao || '')).slice(0, 255);
    if (!descricao) return res.status(400).json({ erro: 'Descrição obrigatória.' });

    valor = parseFloat(valor);
    if (isNaN(valor) || valor < 0) return res.status(400).json({ erro: 'Valor inválido.' });

    if (!data) return res.status(400).json({ erro: 'Data obrigatória.' });

    recorrente = recorrente === true || recorrente === 'true' || recorrente === 1 || recorrente === '1';

    if (recorrente) {
      if (!frequencia || !FREQUENCIAS_VALIDAS.includes(frequencia)) {
        return res.status(400).json({ erro: `Frequência inválida. Válidas: ${FREQUENCIAS_VALIDAS.join(', ')}.` });
      }
    } else {
      frequencia = null;
    }

    const result = await pool.query(
      `UPDATE despesa
          SET descricao  = $1,
              valor      = $2,
              data       = $3,
              recorrente = $4,
              frequencia = $5
        WHERE id = $6
        RETURNING id, descricao, valor, data, recorrente, frequencia, usuario_id, criado_em`,
      [descricao, valor, data, recorrente, frequencia, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /despesas/:id', err);
    res.status(500).json({ erro: 'Erro ao atualizar despesa.' });
  }
});

// Remove uma despesa
router.delete('/:id', exigirAutenticacao, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = (req.user.role || '').toLowerCase() === 'admin';

    const existing = await pool.query('SELECT usuario_id FROM despesa WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ erro: 'Despesa não encontrada.' });
    if (!isAdmin && existing.rows[0].usuario_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado.' });
    }

    await pool.query('DELETE FROM despesa WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /despesas/:id', err);
    res.status(500).json({ erro: 'Erro ao excluir despesa.' });
  }
});

export default router;
