import express from 'express';
import pool from './db.js';
import { safeQuery } from './utils.js';
import { exigirAutenticacao, exigirRole } from './auth.js';

const router = express.Router();

// Listar todos os campeonatos
router.get('/campeonatos-todos', async (req, res) => {
  try {
    const rows = await safeQuery(pool, 'SELECT * FROM campeonato');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar campeonatos', detalhes: err.message });
  }
});

// Rodada atual baseada em datas das partidas (horário de São Paulo)
router.get('/rodada-atual', async (req, res) => {
  try {
    const campeonatoId = req.query?.campeonatoId ? Number(req.query.campeonatoId) : null;
    // Regra: rodada atual = próxima depois da última rodada COMPLETA (todas partidas com resultado/placar)
    const sql = `
      WITH rodadas AS (
        SELECT r.id, r.nome, r.campeonato_id,
               COUNT(p.id) FILTER (WHERE p.id IS NOT NULL) AS total,
               COUNT(p.id) FILTER (WHERE (p.resultado IS NOT NULL OR p.placar IS NOT NULL)) AS finalizadas,
               MIN(p.data_partida) AS start_at
          FROM rodada r
          LEFT JOIN partida p ON p.rodada_id = r.id
         ${campeonatoId ? 'WHERE r.campeonato_id = $1' : ''}
         GROUP BY r.id
      ), ultima_completa AS (
        SELECT id, nome, campeonato_id, start_at
          FROM rodadas
         WHERE total > 0 AND finalizadas = total
         ORDER BY start_at DESC NULLS LAST, id DESC
         LIMIT 1
      )
      SELECT r.id, r.nome
        FROM rodada r
        JOIN (${campeonatoId ? 'SELECT * FROM rodada WHERE campeonato_id = $1' : 'SELECT * FROM rodada'}) rr ON rr.id = r.id
       WHERE r.campeonato_id = COALESCE((SELECT campeonato_id FROM ultima_completa), r.campeonato_id)
       ORDER BY r.id ASC`;
    const params = campeonatoId ? [campeonatoId] : [];
    const { rows: all } = await pool.query(sql, params);
    if (!all.length) return res.json({ id: null, nome: null });
    // encontra a próxima depois da última completa
    let lastCompleteIdx = -1;
    if (campeonatoId) {
      const { rows: lc } = await pool.query(
        `SELECT id FROM rodada r
          WHERE r.campeonato_id = $1 AND EXISTS (
            SELECT 1 FROM partida p WHERE p.rodada_id = r.id
          )
          ORDER BY r.id ASC`, [campeonatoId]
      );
      // pega a última do conjunto que está completa
      const compRows = await pool.query(
        `SELECT r.id
           FROM rodada r
           JOIN partida p ON p.rodada_id = r.id
          WHERE r.campeonato_id = $1
          GROUP BY r.id
         HAVING COUNT(p.id) FILTER (WHERE p.id IS NOT NULL) > 0
            AND COUNT(p.id) FILTER (WHERE (p.resultado IS NOT NULL OR p.placar IS NOT NULL)) = COUNT(p.id)
          ORDER BY r.id ASC`, [campeonatoId]
      );
      if (compRows.rows.length) {
        const lastCompleteId = compRows.rows[compRows.rows.length - 1].id;
        lastCompleteIdx = all.findIndex(r => r.id === lastCompleteId);
      }
    } else {
      // sem filtro: detecta globalmente
      const { rows: comp } = await pool.query(
        `SELECT r.id
           FROM rodada r
           JOIN partida p ON p.rodada_id = r.id
          GROUP BY r.id
         HAVING COUNT(p.id) FILTER (WHERE p.id IS NOT NULL) > 0
            AND COUNT(p.id) FILTER (WHERE (p.resultado IS NOT NULL OR p.placar IS NOT NULL)) = COUNT(p.id)
          ORDER BY r.id ASC`
      );
      if (comp.length) {
        const lastCompleteId = comp[comp.length - 1].id;
        lastCompleteIdx = all.findIndex(r => r.id === lastCompleteId);
      }
    }
    const nextIdx = Math.min(all.length - 1, Math.max(0, lastCompleteIdx + 1));
    return res.json(all[nextIdx]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao calcular rodada atual', detalhes: err.message });
  }
});

// Jogos atuais (janela em horas, horário de São Paulo)
router.get('/jogos-atuais', async (req, res) => {
  try {
    const janelaHoras = req.query?.janelaHoras ? Number(req.query.janelaHoras) : 48;
    const campeonatoId = req.query?.campeonatoId ? Number(req.query.campeonatoId) : null;
    const j = (!Number.isFinite(janelaHoras) || janelaHoras <= 0 || janelaHoras > 336) ? 48 : Math.floor(janelaHoras);
    // Constrói janela em America/Sao_Paulo usando AT TIME ZONE para evitar drift
    const params = [];
    let where = 'WHERE 1=1';
    if (campeonatoId) {
      where += ' AND r.campeonato_id = $1';
      params.push(campeonatoId);
    }
    const sql = `
      WITH base AS (
        SELECT 
          p.id, p.rodada_id, p.time1, p.time2, p.resultado,
          p.data_partida,
          p.local, p.transmissao, p.placar,
          COALESCE(p.finalizada,false) AS finalizada,
          r.campeonato_id,
          t1.escudo_url AS time1_escudo,
          t2.escudo_url AS time2_escudo
        FROM partida p
        JOIN rodada r ON r.id = p.rodada_id
        LEFT JOIN time t1 ON t1.nome = p.time1
        LEFT JOIN time t2 ON t2.nome = p.time2
        ${where}
      )
      SELECT * FROM base
      WHERE data_partida IS NOT NULL
        AND (data_partida AT TIME ZONE 'America/Sao_Paulo') >= (NOW() AT TIME ZONE 'America/Sao_Paulo')
        AND (data_partida AT TIME ZONE 'America/Sao_Paulo') <= ((NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '${j} hours')
      ORDER BY data_partida ASC, id ASC`;
    const { rows } = await pool.query(sql, params);

    // Fallback de escudo por slug quando faltar
    const precisa = rows.some(r => !r.time1_escudo || !r.time2_escudo);
    if (precisa) {
      const times = await safeQuery(pool, `SELECT nome, escudo_url FROM time WHERE COALESCE(ativo,true)=true`, []);
      const map = new Map(times.map(t => [slugifyLocal(t.nome), t.escudo_url]));
      for (const r of rows) {
        if (!r.time1_escudo && r.time1) r.time1_escudo = map.get(slugifyLocal(r.time1)) || r.time1_escudo || null;
        if (!r.time2_escudo && r.time2) r.time2_escudo = map.get(slugifyLocal(r.time2)) || r.time2_escudo || null;
      }
    }

    const enriched = rows.map(r => ({
      ...r,
      data_jogo: r.data_partida, // alias para compatibilidade
      escudo1: r.time1_escudo || null,
      escudo2: r.time2_escudo || null
    }));
    res.json({ janelaHoras: j, items: enriched });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar jogos atuais', detalhes: err.message });
  }
});

// Excluir partida (apenas admin)
router.delete('/partida/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await safeQuery(pool, 'DELETE FROM partida WHERE id = $1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao excluir partida', detalhes: err.message });
  }
});

// Editar partida (apenas admin) - inclui data/hora do jogo
router.put('/partida/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { time1, time2, dataJogo, local, transmissao, placar } = req.body; // dataJogo: "YYYY-MM-DDTHH:mm"

  try {
    await safeQuery(
      pool,
      'UPDATE partida SET time1 = $1, time2 = $2, data_partida = $3, local = $4, transmissao = $5, placar = $6 WHERE id = $7',
      [time1, time2, dataJogo || null, local || null, transmissao || null, placar || null, id]
    );
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar partida', detalhes: err.message });
  }
});

// Finalizar partida (apenas admin)
router.post('/partida/:id/finalizar', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await safeQuery(pool, 'UPDATE partida SET finalizada = true WHERE id = $1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao finalizar partida', detalhes: err.message });
  }
});

// Excluir rodada (apenas admin) - apaga partidas primeiro para respeitar FKs
router.delete('/rodada/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Apagar palpites das partidas desta rodada (FK palpite -> partida)
    await client.query(
      `DELETE FROM palpite WHERE partida_id IN (
         SELECT id FROM partida WHERE rodada_id = $1
       )`,
      [id]
    );
    await client.query('DELETE FROM partida WHERE rodada_id = $1', [id]);
    await client.query('DELETE FROM rodada WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ sucesso: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao excluir rodada', detalhes: err.message });
  } finally {
    client.release();
  }
});

// Editar rodada (apenas admin)
router.put('/rodada/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  try {
    await safeQuery(pool, 'UPDATE rodada SET nome = $1 WHERE id = $2', [nome, id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar rodada', detalhes: err.message });
  }
});

// Finalizar rodada (apenas admin)
router.post('/rodada/:id/finalizar', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await safeQuery(pool, 'UPDATE rodada SET finalizada = true WHERE id = $1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao finalizar rodada', detalhes: err.message });
  }
});

// Excluir campeonato (apenas admin) - apaga rodadas e partidas relacionadas antes
router.delete('/campeonato/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Apagar palpites de todas as partidas das rodadas deste campeonato
    await client.query(
      `DELETE FROM palpite
       WHERE partida_id IN (
         SELECT p.id FROM partida p
         JOIN rodada r ON r.id = p.rodada_id
         WHERE r.campeonato_id = $1
       )`,
      [id]
    );
    // Apagar partidas de todas as rodadas deste campeonato
    await client.query(
      `DELETE FROM partida
       WHERE rodada_id IN (
         SELECT id FROM rodada WHERE campeonato_id = $1
       )`,
      [id]
    );
    // Apagar rodadas do campeonato
    await client.query('DELETE FROM rodada WHERE campeonato_id = $1', [id]);
    // Apagar o campeonato
    await client.query('DELETE FROM campeonato WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ sucesso: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao excluir campeonato', detalhes: err.message });
  } finally {
    client.release();
  }
});

// Editar campeonato (apenas admin)
router.put('/campeonato/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  try {
    await safeQuery(pool, 'UPDATE campeonato SET nome = $1 WHERE id = $2', [nome, id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar campeonato', detalhes: err.message });
  }
});

// Finalizar campeonato (apenas admin)
router.post('/campeonato/:id/finalizar', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await safeQuery(pool, 'UPDATE campeonato SET finalizado = true WHERE id = $1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao finalizar campeonato', detalhes: err.message });
  }
});

// Excluir bolão (apenas admin) - apaga campeonatos, rodadas e partidas relacionadas antes
router.delete('/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Apagar palpites de todas as partidas de todas as rodadas de todos os campeonatos deste bolão
    await client.query(
      `DELETE FROM palpite
       WHERE partida_id IN (
         SELECT p.id FROM partida p
         JOIN rodada r ON r.id = p.rodada_id
         JOIN campeonato c ON c.id = r.campeonato_id
         WHERE c.bolao_id = $1
       )`,
      [id]
    );
    // Apagar partidas de todas as rodadas de todos os campeonatos deste bolão
    await client.query(
      `DELETE FROM partida
       WHERE rodada_id IN (
         SELECT r.id FROM rodada r
         JOIN campeonato c ON c.id = r.campeonato_id
         WHERE c.bolao_id = $1
       )`,
      [id]
    );
    // Apagar rodadas de todos os campeonatos deste bolão
    await client.query(
      `DELETE FROM rodada
       WHERE campeonato_id IN (
         SELECT id FROM campeonato WHERE bolao_id = $1
       )`,
      [id]
    );
    // Apagar campeonatos deste bolão
    await client.query('DELETE FROM campeonato WHERE bolao_id = $1', [id]);
    // Finalmente apagar o bolão
    await client.query('DELETE FROM bolao WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ sucesso: true });
  } catch (err) {
    await client.query('ROLLBACK');
    // Se ainda sobrou FK, informar de forma amigável
    if (err && err.code === '23503') {
      return res.status(409).json({
        erro: 'Não é possível excluir o bolão porque há registros relacionados (campeonatos/rodadas/partidas).',
        detalhes: err.detail || err.message
      });
    }
    res.status(500).json({ erro: 'Erro ao excluir bolão', detalhes: err.message });
  } finally {
    client.release();
  }
});

// Editar bolão (apenas admin)
router.put('/:id', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  await pool.query('UPDATE bolao SET nome = $1 WHERE id = $2', [nome, id]);
  res.json({ sucesso: true });
});

// Finalizar bolão (apenas admin)
router.post('/:id/finalizar', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { id } = req.params;
  // Exemplo: marca como finalizado (adicionar coluna se necessário)
  await pool.query('UPDATE bolao SET finalizado = true WHERE id = $1', [id]);
  res.json({ sucesso: true });
});

// Listar bolões
router.get('/listar', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bolao');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar bolões', detalhes: err.message });
  }
});

// Removido middleware auth local em favor de exigirAutenticacao/exigirRole

// Criar bolão (apenas admin)
router.post('/criar', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { nome } = req.body;
  const result = await pool.query('INSERT INTO bolao (nome, admin_id) VALUES ($1, $2) RETURNING *', [nome, req.user.id]);
  res.json(result.rows[0]);
});

// Criar campeonato
router.post('/:bolaoId/campeonato', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { nome } = req.body;
  const { bolaoId } = req.params;
  const result = await pool.query('INSERT INTO campeonato (nome, bolao_id) VALUES ($1, $2) RETURNING *', [nome, bolaoId]);
  res.json(result.rows[0]);
});

// Criar rodada
router.post('/campeonato/:campeonatoId/rodada', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { nome } = req.body;
  const { campeonatoId } = req.params;
  const result = await pool.query('INSERT INTO rodada (nome, campeonato_id) VALUES ($1, $2) RETURNING *', [nome, campeonatoId]);
  res.json(result.rows[0]);
});

// Criar partida - inclui data/hora do jogo
router.post('/rodada/:rodadaId/partida', exigirAutenticacao, exigirRole('admin'), async (req, res) => {
  const { time1, time2, dataJogo } = req.body; // recebe dataJogo
  const { rodadaId } = req.params;
  
  const result = await pool.query(
    // Usa data_partida (compatível com schema atual)
    'INSERT INTO partida (rodada_id, time1, time2, data_partida) VALUES ($1, $2, $3, $4) RETURNING *', 
    [rodadaId, time1, time2, dataJogo || null]
  );
  res.json(result.rows[0]);
});

// Listar todas as rodadas
router.get('/rodadas-todas', async (req, res) => {
  try {
    const sql = `
      SELECT r.id, r.nome, r.campeonato_id,
             CASE 
               WHEN COUNT(p.id) > 0 
                    AND COUNT(CASE WHEN p.resultado IS NOT NULL THEN 1 END) = COUNT(p.id) 
               THEN true ELSE false END AS finalizada
        FROM rodada r
        LEFT JOIN partida p ON p.rodada_id = r.id
        GROUP BY r.id
        ORDER BY r.id ASC`;
    const { rows } = await pool.query(sql);
    // adiciona alias 'finalizado' para compatibilidade
    const enriched = rows.map(r => ({ ...r, finalizado: r.finalizada }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar rodadas', detalhes: err.message });
  }
});

// Listar rodadas de um campeonato específico
router.get('/campeonato/:campeonatoId/rodadas', async (req, res) => {
  const { campeonatoId } = req.params;
  try {
    const sql = `
      SELECT r.id, r.nome, r.campeonato_id,
             CASE 
               WHEN COUNT(p.id) > 0 
                    AND COUNT(CASE WHEN p.resultado IS NOT NULL THEN 1 END) = COUNT(p.id) 
               THEN true ELSE false END AS finalizada
        FROM rodada r
        LEFT JOIN partida p ON p.rodada_id = r.id
        WHERE r.campeonato_id = $1
        GROUP BY r.id
        ORDER BY r.id ASC`;
    const { rows } = await pool.query(sql, [campeonatoId]);
    const enriched = rows.map(r => ({ ...r, finalizado: r.finalizada }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar rodadas do campeonato', detalhes: err.message });
  }
});

// Listar partidas de uma rodada
// util local para normalizar nomes (sem acento, minúsculo, sem pontuação)
function slugifyLocal(s = '') {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.get('/rodada/:rodadaId/partidas', async (req, res) => {
  const { rodadaId } = req.params;
  try {
    // Inclui data da partida, aliando para data_jogo para compatibilidade com o frontend
    const sql = `
      SELECT 
        p.id,
        p.rodada_id,
        p.time1,
        p.time2,
        p.resultado,
        p.data_partida AS data_jogo,
        p.local,
        p.transmissao,
        p.placar,
        COALESCE(p.finalizada, false) AS finalizada,
        t1.escudo_url AS time1_escudo,
        t2.escudo_url AS time2_escudo
      FROM partida p
      LEFT JOIN time t1 ON t1.nome = p.time1
      LEFT JOIN time t2 ON t2.nome = p.time2
      WHERE p.rodada_id = $1
      ORDER BY p.id ASC
    `;
    const { rows } = await pool.query(sql, [rodadaId]);

    // Verifica se falta algum escudo; se sim, carrega times e faz casamento por slug
    const precisaResolver = rows.some(r => !r.time1_escudo || !r.time2_escudo);
    if (precisaResolver) {
      const timesRows = await safeQuery(pool, `SELECT nome, escudo_url FROM time WHERE COALESCE(ativo,true) = true`, []);
      const map = new Map(timesRows.map(t => [slugifyLocal(t.nome), t.escudo_url]));
      for (const r of rows) {
        if (!r.time1_escudo) {
          const k1 = slugifyLocal(r.time1);
          r.time1_escudo = map.get(k1) || r.time1_escudo || null;
        }
        if (!r.time2_escudo) {
          const k2 = slugifyLocal(r.time2);
          r.time2_escudo = map.get(k2) || r.time2_escudo || null;
        }
      }
    }

    // Adiciona aliases esperados pelo frontend
    const enriched = rows.map(r => ({
      ...r,
      escudo1: r.time1_escudo || null,
      escudo2: r.time2_escudo || null,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar partidas', detalhes: err.message });
  }
});

export default router;
