import express from 'express';
import pool from './db.js';
import { exigirAutenticacao } from './auth.js';
import { safeQuery } from './utils.js';
import { logger } from './logger.js';

const router = express.Router();
// util local para normalizar nomes de times
function slugifyLocal(s = '') {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// Helpers de tempo: considerar America/Sao_Paulo usando Intl (não depende do timezone do servidor)
function getBRTimeParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', hour: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric'
  });
  // get parts via separate formatters for reliability
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
  const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false });
  const weekdayShort = dayFmt.format(d).toLowerCase(); // sun, mon, ...
  const hourStr = hourFmt.format(d);
  const hour = Number(hourStr);
  // map to JS getDay style (0=Dom,1=Seg,...)
  const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const day = map[weekdayShort] ?? 0;
  return { day, hour };
}

// Regra global: corta apostas a partir de sábado 14:00 e durante todo o domingo (no horário de Brasília)
function isGlobalLockActive() {
  const { day, hour } = getBRTimeParts();
  if (day === 6) { // Sábado
    return hour >= 14;
  }
  if (day === 0) { // Domingo
    return true;
  }
  return false; // Segunda a Sexta liberado
}

// Segunda-feira: mantém bloqueado apenas se a ÚLTIMA rodada de algum campeonato (que tenha partidas) não estiver finalizada
async function hasPendingFinalization() {
  const { day } = getBRTimeParts(); // 1 = Monday
  if (day !== 1) return false;
  // Na segunda, bloqueia se existe alguma rodada ANTERIOR à última por campeonato que não foi finalizada e tenha partidas
  const rows = await safeQuery(
    pool,
    `WITH last_per_camp AS (
       SELECT campeonato_id, MAX(id) AS last_id
       FROM rodada
       GROUP BY campeonato_id
     )
     SELECT 1
       FROM rodada r
       JOIN last_per_camp l ON l.campeonato_id = r.campeonato_id
      WHERE r.id < l.last_id
        AND COALESCE(r.finalizada,false) = false
        AND EXISTS (SELECT 1 FROM partida p WHERE p.rodada_id = r.id)
      LIMIT 1`
  );
  return rows.length > 0;
}


// helper: garante usuário do token
function getUserId(req, res) {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ erro: 'Sem usuário no token' });
    return null;
  }
  return id;
}

// helper: checa se partida/rodada finalizadas, ou já com resultado
async function partidaBloqueada(partidaId) {
  const rows = await safeQuery(
    pool,
    `SELECT 
  COALESCE(p.finalizada, false) AS p_finalizada,
  p.resultado,
  COALESCE(r.finalizada, false) AS r_finalizada
     FROM partida p
     JOIN rodada r ON r.id = p.rodada_id
     WHERE p.id = $1`,
    [partidaId]
  );
  const p = rows[0];
  if (!p) return 'Partida inexistente';
  if (p.p_finalizada || p.r_finalizada) return 'Partida/rodada finalizada';
  if (p.resultado) return 'Partida já possui resultado';
  return null;
}

// Buscar palpites do usuário por rodada
router.get('/meus/:rodadaId', exigirAutenticacao, async (req, res) => {
  const usuarioId = getUserId(req, res);
  if (!usuarioId) return;
  const { rodadaId } = req.params;
  try {
    // busca palpites do usuário com infos da partida e tentativa de escudos por JOIN exato
    const rows = await safeQuery(
      pool,
      `SELECT 
         p.id, p.partida_id, p.palpite, p.pontos, 
         pa.resultado, pa.time1, pa.time2,
         t1.escudo_url AS time1_escudo,
         t2.escudo_url AS time2_escudo
       FROM palpite p
       JOIN partida pa ON p.partida_id = pa.id
       LEFT JOIN time t1 ON t1.nome = pa.time1
       LEFT JOIN time t2 ON t2.nome = pa.time2
       WHERE pa.rodada_id = $1 AND p.usuario_id = $2
       ORDER BY pa.id`,
      [rodadaId, usuarioId]
    );

    // fallback por slug quando necessário
    if (rows.some(r => !r.time1_escudo || !r.time2_escudo)) {
      const times = await safeQuery(pool, `SELECT nome, escudo_url FROM time WHERE COALESCE(ativo,true)=true`, []);
      const map = new Map(times.map(t => [slugifyLocal(t.nome), t.escudo_url]));
      for (const r of rows) {
        if (!r.time1_escudo && r.time1) r.time1_escudo = map.get(slugifyLocal(r.time1)) || r.time1_escudo || null;
        if (!r.time2_escudo && r.time2) r.time2_escudo = map.get(slugifyLocal(r.time2)) || r.time2_escudo || null;
      }
    }

    // aliases compatíveis com frontend
    const enriched = rows.map(r => ({ ...r, escudo1: r.time1_escudo || null, escudo2: r.time2_escudo || null }));
    res.json(enriched);
  } catch (e) {
    console.error('Erro /palpite/meus:', e);
    res.status(500).json({ erro: 'Falha ao buscar palpites' });
  }
});

// Apostar
router.post('/apostar/:partidaId', exigirAutenticacao, async (req, res) => {
  const usuarioId = getUserId(req, res);
  if (!usuarioId) return;

  const { partidaId } = req.params;
  // Corta globalmente (sab 14:00 até fim de domingo) OU até admin finalizar rodada pendente
  const weekend = isGlobalLockActive();
  const pending = await hasPendingFinalization();
  if (weekend || pending) {
    return res.status(409).json({ 
      erro: weekend 
        ? 'Apostas fechadas (Depois das 14h, não é permitido alterar o palpite).' 
        : 'Apostas bloqueadas: aguardando finalização da rodada pelo admin.'
    });
  }
  const bloqueio = await partidaBloqueada(partidaId);
  if (bloqueio) return res.status(409).json({ erro: bloqueio });

  let { palpite } = req.body || {};
  try {
  const userRows = await safeQuery(pool, 'SELECT autorizado FROM usuario WHERE id = $1', [usuarioId]);
  if (!userRows[0]?.autorizado) return res.status(403).json({ erro: 'Usuário não autorizado para apostar' });

    palpite = String(palpite || '').toLowerCase();
    if (!['time1', 'empate', 'time2'].includes(palpite)) {
      return res.status(400).json({ erro: 'Palpite inválido. Use: time1 | empate | time2' });
    }

    const sql = `
      INSERT INTO palpite (partida_id, usuario_id, palpite, pontos)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (usuario_id, partida_id)
      DO UPDATE SET palpite = EXCLUDED.palpite
      RETURNING *`;
    const rows = await safeQuery(pool, sql, [partidaId, usuarioId, palpite]);
  logger.info('audit_bet_upsert', { userId: usuarioId, partidaId, palpite });
  res.json(rows[0]);
  } catch (e) {
    console.error('Erro apostar:', e);
    res.status(500).json({ erro: 'Falha ao salvar palpite' });
  }
});

// Lançar resultado (admin)
router.post('/resultado/:partidaId', exigirAutenticacao, async (req, res) => {
  const usuarioId = getUserId(req, res);
  if (!usuarioId) return;

  const { partidaId } = req.params;
  const bloqueio = await partidaBloqueada(partidaId);
  if (bloqueio) return res.status(409).json({ erro: bloqueio });

  try {
    if (req.user.role !== 'admin') return res.status(403).json({ erro: 'Apenas admin' });
    let { resultado, gols1, gols2 } = req.body || {};
    if (!resultado && (gols1 != null && gols2 != null)) {
      const g1 = Number(gols1) || 0;
      const g2 = Number(gols2) || 0;
      resultado = g1 === g2 ? 'EMPATE' : (g1 > g2 ? 'TIME1' : 'TIME2');
    }
    if (!resultado || !['TIME1', 'EMPATE', 'TIME2'].includes(String(resultado).toUpperCase())) {
      return res.status(400).json({ erro: 'Resultado inválido. Use TIME1 | EMPATE | TIME2 ou informe gols1/gols2.' });
    }
    resultado = String(resultado).toUpperCase();

    await pool.query('UPDATE partida SET resultado = $1 WHERE id = $2', [resultado, partidaId]);
    await pool.query(
      `UPDATE palpite p
       SET pontos = CASE
         WHEN $2 = 'EMPATE' AND LOWER(p.palpite) = 'empate' THEN 1
         WHEN $2 = 'TIME1'  AND LOWER(p.palpite) = 'time1'  THEN 1
         WHEN $2 = 'TIME2'  AND LOWER(p.palpite) = 'time2'  THEN 1
         ELSE 0 END
       WHERE p.partida_id = $1`,
      [partidaId, resultado]
    );

    const { rows } = await pool.query(
      `SELECT u.nome, p.palpite, p.pontos
       FROM palpite p
       JOIN usuario u ON u.id = p.usuario_id
       WHERE p.partida_id = $1
       ORDER BY u.nome`,
      [partidaId]
    );
  logger.info('audit_result_launch', { adminId: usuarioId, partidaId: Number(partidaId), resultado });
  res.json({ ok: true, partidaId: Number(partidaId), resultado, palpites: rows });
  } catch (e) {
    console.error('Erro ao lançar resultado:', e);
    res.status(500).json({ erro: 'Falha ao lançar resultado' });
  }
});

// Ranking da rodada (com flags)
router.get('/ranking/rodada/:rodadaId', async (req, res) => {
  const { rodadaId } = req.params;
  try {
    const { rows } = await pool.query(
  `SELECT 
     u.id,
     COALESCE(u.apelido, u.nome) AS nome,
     u.avatar_url AS "fotoUrl",
     COALESCE(u.banido,false)  AS banido,
     COALESCE(u.desistiu,false) AS desistiu,
  COALESCE(SUM(CASE WHEN pa.rodada_id = $1 THEN p.pontos ELSE 0 END), 0) AS pontos
   FROM usuario u
   /* Apenas palpites desta rodada */
   LEFT JOIN palpite p ON p.usuario_id = u.id
   LEFT JOIN partida pa ON pa.id = p.partida_id AND pa.rodada_id = $1
   GROUP BY u.id, u.apelido, u.nome, u.avatar_url, u.banido, u.desistiu
   ORDER BY pontos DESC, COALESCE(u.apelido, u.nome) ASC`,
      [rodadaId]
    );
    // Se não autenticado ou não admin, ocultar flags sensíveis
    const role = (req.user?.role || '').toLowerCase();
    const sanitized = rows.map(r => {
      if (!role || role !== 'admin') {
        const { banido, desistiu, ...rest } = r;
        return rest;
      }
      return r;
    });
    return res.json({ ranking: sanitized });
  } catch (e) {
    console.error('GET /palpite/ranking/rodada erro:', e);
    return res.status(500).json({ erro: 'Falha ao carregar ranking da rodada' });
  }
});

// Ranking geral (com flags)
router.get('/ranking/geral', async (req, res) => {
  try {
    const { rows } = await pool.query(
  `SELECT 
     u.id,
     COALESCE(u.apelido, u.nome) AS nome,
     u.avatar_url AS "fotoUrl",
     COALESCE(u.banido,false)  AS banido,
     COALESCE(u.desistiu,false) AS desistiu,
     COALESCE(SUM(p.pontos), 0) AS pontos
   FROM usuario u
   LEFT JOIN palpite p ON p.usuario_id = u.id
   GROUP BY u.id, u.apelido, u.nome, u.avatar_url, u.banido, u.desistiu
   ORDER BY pontos DESC, COALESCE(u.apelido, u.nome) ASC`
    );
    const role = (req.user?.role || '').toLowerCase();
    const sanitized = rows.map(r => {
      if (!role || role !== 'admin') {
        const { banido, desistiu, ...rest } = r;
        return rest;
      }
      return r;
    });
    return res.json({ ranking: sanitized });
  } catch (e) {
    console.error('GET /palpite/ranking/geral erro:', e);
    return res.status(500).json({ erro: 'Falha ao carregar ranking geral' });
  }
});

// Estado de bloqueio global (para UI)
router.get('/lock', async (_req, res) => {
  try {
    const weekend = isGlobalLockActive();
    const pending = await hasPendingFinalization();
    res.json({ locked: weekend || pending, weekend, pending });
  } catch (e) {
    res.json({ locked: false, weekend: false, pending: false });
  }
});

export default router;