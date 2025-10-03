import express from 'express';
import PDFDocument from 'pdfkit';
import pool from './db.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { sanitizeText, sanitizeMediaUrl } from './utils.js';
import { v2 as cloudinary } from 'cloudinary';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const router = express.Router();

// Função baseada no modelo do usuário
async function extrairJogosDoPDF(caminhoPDF, opts = {}) {
  const { maxPages = 300, debug = false } = opts;
  const data = new Uint8Array(fs.readFileSync(caminhoPDF));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const nPages = Math.min(pdfDoc.numPages, maxPages);
  const jogosExtraidos = [];
  for (let i = 1; i <= nPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    let linhas = [];
    let linhaAtual = '';
    let ultimaY = null;
    content.items.forEach(item => {
      const y = item.transform[5];
      const str = (item.str || '').trim();
      if (!str) return;
      if (ultimaY !== null && Math.abs(ultimaY - y) > 6) {
        if (linhaAtual.trim()) linhas.push(linhaAtual.trim());
        linhaAtual = str;
      } else {
        linhaAtual += ' ' + str;
      }
      ultimaY = y;
    });
    if (linhaAtual.trim()) linhas.push(linhaAtual.trim());
    // Regex e parsing conforme modelo do usuário (resumido)
    const date = '(?:\\d{2}\\/\\d{2}\\/(?:\\d{2}|\\d{4}))';
    const time = '(?:\\d{2}:\\d{2}|\\d{2}h\\d{2})';
    const sep = '(?:x|X|vs\\.?)';
    const patterns = [
      new RegExp(`^(${date})\\s+(${time})\\s+(.+?)\\s+(${sep})\\s+(.+)$`, 'i'),
      new RegExp(`^(${date})\\s*-\\s*(${time})\\s*-\\s*(.+?)\\s+(${sep})\\s+(.+)$`, 'i'),
      new RegExp(`^(.+?)\\s+(${sep})\\s+(.+?)\\s*-\\s*(${time})\\s*-\\s*(${date})$`, 'i'),
      new RegExp(`^[A-Za-zçÇéÉáÁíÍõÕúÚâÂêÊôÔ]{2,}\\s+(${date})\\s+(${time})\\s+(.+?)\\s+(${sep})\\s+(.+)$`, 'i'),
    ];
    linhas.forEach(linha => {
      const l = linha.replace(/[\u2012-\u2015\u2212\u2010]/g, '-').replace(/\s+/g, ' ').trim();
      for (const re of patterns) {
        const m = l.match(re);
        if (m) {
          let dataJogo, horaJogo, casa, fora;
          if (re === patterns[0] || re === patterns[1] || re === patterns[3]) {
            dataJogo = m[1];
            horaJogo = m[2];
            casa = m[3];
            fora = m[5];
          } else if (re === patterns[2]) {
            casa = m[1];
            fora = m[3];
            horaJogo = m[4];
            dataJogo = m[5];
          }
          if (/^\d{2}h\d{2}$/i.test(horaJogo)) horaJogo = horaJogo.replace('h', ':');
          jogosExtraidos.push({
            time_casa: (casa || '').trim(),
            time_fora: (fora || '').trim(),
            data: (dataJogo || '').trim(),
            hora: (horaJogo || '').trim(),
          });
          break;
        }
      }
    });
  }
  return jogosExtraidos;
}

// Endpoint para upload e processamento automático do PDF de jogos
router.post('/upload-jogos-pdf', isAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'PDF não enviado' });
    // Salva PDF temporariamente
    const tempPath = path.join('/tmp', `jogos_${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, req.file.buffer);
    // Extrai jogos
    const jogos = await extrairJogosDoPDF(tempPath);
    fs.unlinkSync(tempPath);
    if (!jogos.length) return res.status(400).json({ erro: 'Nenhum jogo extraído do PDF' });
    // Busca última rodada existente
    const rodadasRes = await pool.query('SELECT id, nome FROM rodada ORDER BY id DESC LIMIT 1');
    let rodadaNum = rodadasRes.rows.length ? parseInt(rodadasRes.rows[0].nome) || rodadasRes.rows[0].id : 0;
    let rodadaId = null;
    let rodadaAtual = null;
    let criadas = 0, jogosCriados = 0, jogosIgnorados = 0;
    for (const [idx, jogo] of jogos.entries()) {
      // Cria nova rodada a cada 10 jogos
      if (!rodadaAtual || rodadaAtual.count >= 10) {
        rodadaNum++;
        const nome = `${rodadaNum}ª Rodada`;
        const rodadaRes = await pool.query('INSERT INTO rodada (nome) VALUES ($1) RETURNING id', [nome]);
        rodadaId = rodadaRes.rows[0].id;
        rodadaAtual = { id: rodadaId, count: 0 };
        criadas++;
      }
      rodadaAtual.count++;
      // Verifica se partida já existe (mesmo times e data)
      const existe = await pool.query('SELECT id FROM partida WHERE rodada_id = $1 AND time1 = $2 AND time2 = $3 AND data_partida = $4', [
        rodadaId, jogo.time_casa, jogo.time_fora, `${jogo.data} ${jogo.hora}`
      ]);
      if (existe.rows.length) { jogosIgnorados++; continue; }
      await pool.query('INSERT INTO partida (rodada_id, time1, time2, data_partida) VALUES ($1, $2, $3, $4)', [
        rodadaId, jogo.time_casa, jogo.time_fora, `${jogo.data} ${jogo.hora}`
      ]);
      jogosCriados++;
    }
    return res.json({ ok: true, rodadas_criadas: criadas, jogos_criados: jogosCriados, jogos_ignorados: jogosIgnorados });
  } catch (err) {
    console.error('Erro upload-jogos-pdf:', err);
    return res.status(500).json({ erro: 'Falha ao processar PDF.' });
  }
});


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

// Gera relatório PDF de desempate do campeonato
router.get('/relatorio-campeonato/:campeonatoId', isAdmin, async (req, res) => {
  const { campeonatoId } = req.params;
  try {
    // Busca todos os usuários participantes do campeonato
    const usersRes = await pool.query(`
      SELECT u.id, u.nome, u.apelido, u.email
      FROM usuario u
      JOIN palpite p ON p.usuario_id = u.id
      JOIN partida pa ON pa.id = p.partida_id
      JOIN rodada r ON r.id = pa.rodada_id
      WHERE r.campeonato_id = $1
      GROUP BY u.id
    `, [campeonatoId]);
    const users = usersRes.rows;

    // Busca todas as rodadas do campeonato
    const rodadasRes = await pool.query('SELECT id, nome FROM rodada WHERE campeonato_id = $1', [campeonatoId]);
    const rodadas = rodadasRes.rows;

    // Busca todos os palpites e pontos por rodada
    const pontosRes = await pool.query(`
      SELECT p.usuario_id, r.id as rodada_id, SUM(p.pontos) as pontos
      FROM palpite p
      JOIN partida pa ON pa.id = p.partida_id
      JOIN rodada r ON r.id = pa.rodada_id
      WHERE r.campeonato_id = $1
      GROUP BY p.usuario_id, r.id
    `, [campeonatoId]);
    // Estrutura: { usuario_id, rodada_id, pontos }
    const pontosPorRodada = {};
    for (const row of pontosRes.rows) {
      if (!pontosPorRodada[row.usuario_id]) pontosPorRodada[row.usuario_id] = [];
      pontosPorRodada[row.usuario_id].push({ rodada_id: row.rodada_id, pontos: Number(row.pontos) });
    }

    // Calcula rodadas vencidas por usuário
    const rodadasVencidas = {};
    for (const rodada of rodadas) {
      // Para cada rodada, encontra o(s) usuário(s) com maior pontuação
      let max = -Infinity;
      let vencedores = [];
      for (const user of users) {
        const pontos = pontosPorRodada[user.id]?.find(r => r.rodada_id === rodada.id)?.pontos || 0;
        if (pontos > max) {
          max = pontos;
          vencedores = [user.id];
        } else if (pontos === max) {
          vencedores.push(user.id);
        }
      }
      for (const uid of vencedores) {
        rodadasVencidas[uid] = (rodadasVencidas[uid] || 0) + 1;
      }
    }

    // Monta ranking final com critérios de desempate
    const ranking = users.map(u => {
      const pontosTotais = (pontosPorRodada[u.id] || []).reduce((acc, r) => acc + r.pontos, 0);
      return {
        ...u,
        rodadasVencidas: rodadasVencidas[u.id] || 0,
        pontosTotais,
        pontosPorRodada: pontosPorRodada[u.id] || [],
      };
    });
    // Ordena por pontos totais, depois rodadas vencidas, depois maior pontuação em uma rodada
    ranking.sort((a, b) => {
      if (b.pontosTotais !== a.pontosTotais) return b.pontosTotais - a.pontosTotais;
      if ((b.rodadasVencidas || 0) !== (a.rodadasVencidas || 0)) return (b.rodadasVencidas || 0) - (a.rodadasVencidas || 0);
      const maxA = Math.max(...(a.pontosPorRodada.map(r => r.pontos)));
      const maxB = Math.max(...(b.pontosPorRodada.map(r => r.pontos)));
      return maxB - maxA;
    });

    // Gera PDF com layout melhorado
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-campeonato-${campeonatoId}.pdf"`);
    doc.pipe(res);

    // Título
    doc.font('Courier-Bold').fontSize(18).text('Relatório Final do Campeonato', { align: 'center' });
    doc.moveDown();
    doc.font('Courier').fontSize(12).text(`Campeonato ID: ${campeonatoId}`);
    doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`);
    doc.moveDown();
    doc.font('Courier-Bold').fontSize(14).text('Critérios de Desempate:', { underline: true });
    doc.font('Courier').fontSize(12).text('1) Maior pontuação total');
    doc.text('2) Maior número de rodadas vencidas');
    doc.text('3) Maior pontuação em uma rodada');
    doc.moveDown();

    doc.font('Courier-Bold').fontSize(14).text('Ranking Final:', { underline: true });
    doc.moveDown(0.5);

    // Cabeçalho da tabela
    const startX = 40;
    let y = doc.y;
    const colWidths = [60, 180, 90, 90, 110]; // soma = 530, cabe em A4
    const headers = ['Posição', 'Nome', 'Rodadas', 'Pontos', 'Maior Rodada'];
    let x = startX;
    doc.font('Courier-Bold').fontSize(12);
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
      x += colWidths[i];
    });
    y += 20;
    doc.moveTo(startX, y-5).lineTo(startX + colWidths.reduce((a,b)=>a+b,0), y-5).stroke();

    // Linhas da tabela
    doc.font('Courier').fontSize(12);
    ranking.forEach((u, idx) => {
      x = startX;
      const maxRodada = Math.max(...(u.pontosPorRodada.map(r => r.pontos)));
      const row = [
        `${idx + 1}º`,
        u.nome.length > 25 ? u.nome.slice(0,22)+'...' : u.nome,
        u.rodadasVencidas,
        u.pontosTotais,
        maxRodada
      ];
      row.forEach((val, i) => {
        doc.text(String(val), x, y, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
        x += colWidths[i];
      });
      y += 18;
      // Quebra de página se necessário
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 50;
        x = startX;
        doc.font('Courier-Bold').fontSize(12);
        headers.forEach((h, i) => {
          doc.text(h, x, y, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
          x += colWidths[i];
        });
        y += 20;
        doc.moveTo(startX, y-5).lineTo(startX + colWidths.reduce((a,b)=>a+b,0), y-5).stroke();
        doc.font('Courier').fontSize(12);
      }
    });

    doc.end();
  } catch (err) {
    console.error('Erro ao gerar relatório PDF:', err);
    res.status(500).json({ erro: 'Erro ao gerar relatório PDF.' });
  }
});
// Configuração do multer para uploads de imagem (apenas uma declaração)
// Usar memoryStorage para produção (Vercel/Render não tem filesystem)
const storage = multer.memoryStorage();
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
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'anuncios' }, (error, result) => {
            if (error || !result) return reject(error || new Error('Falha no upload Cloudinary'));
            resolve(result);
          });
          stream.end(req.file.buffer);
        });
        imagem_url = uploadResult.secure_url;
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
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'anuncios' }, (error, result) => {
            if (error || !result) return reject(error || new Error('Falha no upload Cloudinary'));
            resolve(result);
          });
          stream.end(req.file.buffer);
        });
        imagem_url = uploadResult.secure_url;
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