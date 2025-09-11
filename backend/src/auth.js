import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from './db.js';
import { safeQuery } from './utils.js';
import multer from 'multer';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { notifyBlockedIP } from './admin.js';

// preparo de upload local para avatar (caso cliente envie direto aqui)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
const storageAvatarLocal = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase();
    const base = path
      .basename(file.originalname || 'avatar', ext)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    cb(null, `${Date.now()}-${base}${ext || '.png'}`);
  },
});
const uploadLocalAvatar = multer({
  storage: storageAvatarLocal,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Arquivo inválido: somente imagens'));
  }
});

const router = express.Router();

// Segredo único e consistente - exigir forte em produção
const fallbackSecret = 'dev-secret';
const rawSecret = process.env.JWT_SECRET || fallbackSecret;
if (!process.env.JWT_SECRET) {
  console.warn('[SEC] JWT_SECRET não definido. Usando fallback de desenvolvimento. Defina um segredo forte em produção.');
}
if (process.env.NODE_ENV === 'production' && rawSecret === fallbackSecret) {
  console.error('[SEC] JWT_SECRET fraco em produção. Abortar.');
  throw new Error('JWT_SECRET fraco – defina variável de ambiente segura.');
}
const JWT_SECRET = rawSecret;
// Lista de JTI revogados (memória volatil). Em produção grande, mover para redis.
const revokedJti = new Set();
function signToken(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: '8h' });
  return { token, jti };
}

// Middleware de autenticação via Bearer ou Cookie
function pegarToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

export async function exigirAutenticacao(req, res, next) {
  try {
    const token = pegarToken(req);
    if (!token) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });

  const payload = jwt.verify(token, JWT_SECRET);
  if (payload?.jti && revokedJti.has(payload.jti)) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    const userId = payload.id || payload.userId || payload.sub;
    if (!userId) return res.status(401).json({ erro: 'Usuário inválido' });

    // role vem de payload.tipo (admin/comum) ou payload.role
    const role = (payload.role || payload.tipo || 'user').toString().toLowerCase();
    req.user = { id: userId, role, autorizado: payload.autorizado === true };
    next();
  } catch {
    return res.status(401).json({ erro: 'Usuário inválido' });
  }
}

export function exigirRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    if ((req.user.role || '').toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
  };
}

// Controle de tentativas e bloqueio permanente
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
// Captcha adaptativo simples
const captchaChallenges = new Map(); // ip -> { a,b,answer, expires }
function needCaptcha(ip) {
  if (process.env.NODE_ENV !== 'production' && process.env.FORCE_CAPTCHA !== 'true') return false;
  return (loginAttempts[ip] || 0) >= 3; // após 3 falhas
}
function getOrCreateChallenge(ip) {
  const now = Date.now();
  const cur = captchaChallenges.get(ip);
  if (cur && cur.expires > now) return { a: cur.a, b: cur.b };
  const a = Math.floor(Math.random()*10)+1;
  const b = Math.floor(Math.random()*10)+1;
  captchaChallenges.set(ip, { a, b, answer: a + b, expires: now + 5*60*1000 });
  return { a, b };
}

async function isIpBlocked(ip) {
  const result = await pool.query('SELECT * FROM login_blocked_ip WHERE ip = $1 AND desbloqueado = false', [ip]);
  return result.rows.length > 0;
}

async function blockIp(ip, email, nome_usuario) {
  await pool.query(
    'INSERT INTO login_blocked_ip (ip, email, nome_usuario) VALUES ($1, $2, $3) ON CONFLICT (ip) DO UPDATE SET bloqueado_em = CURRENT_TIMESTAMP, desbloqueado = false, email = $2, nome_usuario = $3',
    [ip, email, nome_usuario]
  );
}

function setAuthCookie(res, token, req) {
  const rawHost = (req?.headers?.host || '').toLowerCase();
  const originHeader = (req?.headers?.origin || '').toLowerCase();
  let originHost = '';
  try { originHost = new URL(originHeader).hostname.toLowerCase(); } catch { originHost = originHeader.replace(/^[a-z]+:\/\//,'').split('/')?.[0] || originHeader; }
  const privatePattern = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
  const hostOnly = rawHost.split(':')[0];
  const isLocal = privatePattern.test(hostOnly) || privatePattern.test(originHost);
  const isProdEnv = process.env.NODE_ENV === 'production';
  const isProd = isProdEnv && !isLocal;
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase();
  const isHttps = (req.protocol === 'https') || forwardedProto.includes('https');
  // Só marca secure se realmente estiver em HTTPS; em IP público sem TLS precisamos permitir cookie em HTTP
  const secureFlag = isProd && isHttps;
  const sameSite = isProd ? 'strict' : 'lax';
  const cookieOpts = {
    httpOnly: true,
    sameSite,
    secure: secureFlag,
    maxAge: 1000 * 60 * 60 * 8,
    path: '/',
    // Não definir domain para permitir que o browser aplique automaticamente (melhor para IPs)
  };
  res.cookie('token', token, cookieOpts);
  logger.debug('auth_cookie_set', { isProd, isProdEnv, isLocal, sameSite, secure: secureFlag, httpsDetected: isHttps, hostOnly, originHost });
}

// Cadastro de usuário
router.post('/register', uploadLocalAvatar.single('avatar'), async (req, res) => {
  const origin = req.headers.origin || '';
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002').split(',').map(o=>o.trim());
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ erro: 'Origin não permitida' });
  }
  const { nome, email, senha, tipo, apelido, contato } = req.body;
  try {
    if (!senha) {
      return res.status(400).json({ erro: 'Senha ausente' });
    }
    const devRelaxed = process.env.NODE_ENV !== 'production' && process.env.RELAX_PWD === 'true';
    if (!devRelaxed) {
      if (senha.length < 10 || !/[A-Z]/.test(senha) || !/[a-z]/.test(senha) || !/[0-9]/.test(senha)) {
        return res.status(400).json({ erro: 'Senha fraca. Requisitos: mínimo 10 caracteres, incluir maiúscula, minúscula e número.' });
      }
    }
  const cost = Number(process.env.BCRYPT_COST) >= 10 && Number(process.env.BCRYPT_COST) <= 14 ? Number(process.env.BCRYPT_COST) : 12;
  const hash = await bcrypt.hash(senha, cost);
    // se veio arquivo, salva e usa URL local; caso contrário, tenta avatarUrl textual
    let avatarUrl = null;
    if (req.file) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      avatarUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    } else if (req.body.avatarUrl) {
      avatarUrl = req.body.avatarUrl;
    }
    const rows = await safeQuery(
      pool,
      'INSERT INTO usuario (nome, email, senha, tipo, autorizado, avatar_url, apelido, contato) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [nome, email, hash, tipo || 'comum', false, avatarUrl || null, apelido || null, contato || null]
    );
  logger.info('user_registered', { userId: rows[0].id, email });
  return res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ erro: 'Email já cadastrado. Use outro email.' });
    } else {
      res.status(400).json({ erro: 'Erro ao cadastrar usuário', detalhes: err.message });
    }
  }
});

// Login
router.post('/login', async (req, res) => {
  const origin = req.headers.origin || '';
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002').split(',').map(o=>o.trim());
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ erro: 'Origin não permitida' });
  }
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.connection?.remoteAddress;
  const { email, senha, captcha } = req.body || {};
  if (await isIpBlocked(ip)) {
    return res.status(403).json({ erro: 'Este IP está bloqueado. Solicite desbloqueio ao administrador.' });
  }
  loginAttempts[ip] = loginAttempts[ip] || 0;
  if (loginAttempts[ip] >= MAX_ATTEMPTS) {
    await blockIp(ip, email, null);
    notifyBlockedIP(ip, email, null);
    return res.status(403).json({ erro: 'Este IP foi bloqueado após múltiplas tentativas. Solicite desbloqueio ao administrador.' });
  }
  if (!email || !senha) {
    logger.debug('login_missing_fields', { ip, emailProvided: !!email, senhaProvided: !!senha });
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }
  if (needCaptcha(ip)) {
    const ch = captchaChallenges.get(ip);
    if (!captcha || !ch || Number(captcha) !== ch.answer) {
      const { a, b } = getOrCreateChallenge(ip);
      return res.status(400).json({ erro: 'Captcha requerido', captchaDesafio: `${a}+${b}` });
    }
  }
  try {
    const rows = await safeQuery(pool, 'SELECT * FROM usuario WHERE email = $1', [email]);
    const usuario = rows[0];
  if (!usuario) {
      loginAttempts[ip]++;
      logger.debug('login_user_not_found', { ip, email, attempts: loginAttempts[ip] });
      if (loginAttempts[ip] >= MAX_ATTEMPTS) {
        await blockIp(ip, email, null);
        notifyBlockedIP(ip, email, null);
        logger.warn('login_ip_blocked', { ip, email });
        return res.status(403).json({ erro: 'Credenciais inválidas' });
      }
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
    const match = await bcrypt.compare(senha, usuario.senha);
  if (!match) {
      loginAttempts[ip]++;
      logger.debug('login_password_mismatch', { ip, email, attempts: loginAttempts[ip] });
      if (loginAttempts[ip] >= MAX_ATTEMPTS) {
        await blockIp(ip, email, usuario.nome);
        notifyBlockedIP(ip, email, usuario.nome);
        logger.warn('login_ip_blocked', { ip, email, userId: usuario.id });
        return res.status(403).json({ erro: 'Credenciais inválidas' });
      }
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }
  const { token, jti } = signToken({ id: usuario.id, tipo: usuario.tipo, autorizado: usuario.autorizado });
    setAuthCookie(res, token, req);
  const userOut = { ...usuario, avatarUrl: usuario.avatar_url };
  loginAttempts[ip] = 0; // reset ao logar com sucesso
  captchaChallenges.delete(ip);
  logger.info('login_success', { userId: usuario.id, email, ip });
  logger.info('audit_login', { userId: usuario.id, email, ip });
    return res.json({ usuario: userOut });
  } catch (err) {
  logger.warn('login_error', { email, error: err.message, ip });
    loginAttempts[ip]++;
  res.status(400).json({ erro: 'Credenciais inválidas' });
  }
});

// Obter dados do próprio usuário
router.get('/me', exigirAutenticacao, async (req, res) => {
  try {
  logger.debug('auth_me_hit', { hasUser: !!req.user, userId: req.user?.id });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  const rows = await safeQuery(pool, 'SELECT id, nome, email, tipo, autorizado, avatar_url, apelido FROM usuario WHERE id = $1', [userId]);
    const u = rows[0];
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  return res.json({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, autorizado: u.autorizado, avatarUrl: u.avatar_url, apelido: u.apelido });
  } catch (err) {
    console.error('GET /auth/me', err);
    return res.status(500).json({ erro: 'Falha ao obter perfil' });
  }
});

// Atualizar dados do próprio usuário (nome, email)
router.put('/me', exigirAutenticacao, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    const { nome, email, apelido } = req.body || {};
    const rows = await safeQuery(
      pool,
      `UPDATE usuario
         SET nome = COALESCE($1, nome),
             email = COALESCE($2, email),
             apelido = COALESCE($3, apelido)
       WHERE id = $4
       RETURNING id, nome, email, tipo, autorizado, avatar_url, apelido`,
      [nome ?? null, email ?? null, apelido ?? null, userId]
    );
    const u = rows[0];
    return res.json({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, autorizado: u.autorizado, avatarUrl: u.avatar_url, apelido: u.apelido });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ erro: 'Email já cadastrado. Use outro email.' });
    }
    console.error('PUT /auth/me', err);
    return res.status(500).json({ erro: 'Falha ao atualizar perfil' });
  }
});

// Alterar senha do próprio usuário
router.patch('/me/senha', exigirAutenticacao, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    const { senhaAtual, novaSenha } = req.body || {};
    if (!senhaAtual || !novaSenha || novaSenha.length < 10 || !/[A-Z]/.test(novaSenha) || !/[a-z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      return res.status(400).json({ erro: 'Nova senha fraca. Requisitos: mínimo 10 caracteres, incluir maiúscula, minúscula e número.' });
    }
    const rows = await safeQuery(pool, 'SELECT senha FROM usuario WHERE id = $1', [userId]);
    const hash = rows[0]?.senha;
    if (!hash) return res.status(404).json({ erro: 'Usuário não encontrado' });
    const ok = await bcrypt.compare(senhaAtual, hash);
    if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta' });
  const cost = Number(process.env.BCRYPT_COST) >= 10 && Number(process.env.BCRYPT_COST) <= 14 ? Number(process.env.BCRYPT_COST) : 12;
  const newHash = await bcrypt.hash(novaSenha, cost);
  await safeQuery(pool, 'UPDATE usuario SET senha = $1 WHERE id = $2', [newHash, userId]);
  logger.info('audit_password_change', { userId });
  return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /auth/me/senha', err);
    return res.status(500).json({ erro: 'Falha ao alterar senha' });
  }
});

// Atualizar avatar do próprio usuário (autenticado)
router.post('/me/avatar', exigirAutenticacao, uploadLocalAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const url = `${baseUrl}/uploads/avatars/${req.file.filename}`;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    await safeQuery(pool, 'UPDATE usuario SET avatar_url = $1 WHERE id = $2', [url, userId]);
    return res.json({ avatarUrl: url });
  } catch (err) {
    console.error('Erro ao atualizar avatar:', err);
    return res.status(500).json({ erro: 'Falha ao atualizar avatar' });
  }
});

// Remover avatar do próprio usuário
router.delete('/me/avatar', exigirAutenticacao, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    const rows = await safeQuery(pool, 'SELECT avatar_url FROM usuario WHERE id = $1', [userId]);
    const current = rows[0]?.avatar_url || null;
    if (current) {
      try {
        let pathPart = '';
        try { pathPart = new URL(current).pathname; } catch { pathPart = current; }
        const filename = path.basename(pathPart);
        const full = path.join(avatarsDir, filename);
        // só apaga se estiver dentro da pasta avatars
        if (full.startsWith(avatarsDir) && fs.existsSync(full)) {
          fs.unlinkSync(full);
        }
      } catch (e) {
        // loga mas segue com limpeza no banco
        console.warn('Falha ao remover arquivo de avatar:', e?.message);
      }
    }
    await safeQuery(pool, 'UPDATE usuario SET avatar_url = NULL WHERE id = $1', [userId]);
    return res.json({ avatarUrl: null });
  } catch (err) {
    console.error('Erro ao remover avatar:', err);
    return res.status(500).json({ erro: 'Falha ao remover avatar' });
  }
});

export default router;
// Logout (invalida cookie)
router.post('/logout', (req, res) => {
  try {
  const isProd = process.env.NODE_ENV === 'production';
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.jti) revokedJti.add(decoded.jti);
      } catch {}
    }
  const rawHost = (req?.headers?.host || '').toLowerCase();
  const originHeader = (req?.headers?.origin || '').toLowerCase();
  let originHost = '';
  try { originHost = new URL(originHeader).hostname.toLowerCase(); } catch { originHost = originHeader.replace(/^[a-z]+:\/\//,'').split('/')?.[0] || originHeader; }
  const privatePattern = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
  const hostOnly = rawHost.split(':')[0];
  const isLocal = privatePattern.test(hostOnly) || privatePattern.test(originHost);
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase();
  const isHttps = (req.protocol === 'https') || forwardedProto.includes('https');
  const secureFlag = isProd && !isLocal && isHttps;
  res.clearCookie('token', { httpOnly: true, sameSite: secureFlag ? 'strict' : 'lax', secure: secureFlag, path: '/' });
    return res.json({ ok: true });
  } catch (err) {
  logger.error('logout_error', { error: err.message });
    return res.status(500).json({ erro: 'Falha ao encerrar sessão' });
  }
});

// Refresh de sessão: se token válido e faltando < 2h para expirar, renova
router.post('/refresh', (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const token = req.cookies?.token;
    if (!token) {
      logger.debug('refresh_no_cookie');
      return res.status(401).json({ erro: 'Sem sessão' });
    }
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: false });
    } catch {
  logger.debug('refresh_token_expired');
  return res.status(401).json({ erro: 'Sessão expirada' });
    }
    // exp em segundos
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp || 0;
    const remaining = exp - now;
    // só renova se faltando menos de 2h (7200s)
    if (remaining > 7200) {
      logger.debug('refresh_not_needed', { remaining });
      return res.json({ ok: true, refreshed: false });
    }
  const { token: newToken, jti: newJti } = signToken({ id: payload.id, tipo: payload.tipo, autorizado: payload.autorizado });
  setAuthCookie(res, newToken, req);
    return res.json({ ok: true, refreshed: true });
  } catch (err) {
  logger.error('refresh_error', { error: err.message });
    return res.status(500).json({ erro: 'Falha ao renovar sessão' });
  }
});

// Rota de debug para verificar recebimento de cookie e decodificação
function handleDebugCookie(req, res) {
  const token = req.cookies?.token;
  if (!token) return res.status(200).json({ hasCookie: false });
  try {
    const payload = jwt.decode(token) || null;
    res.json({ hasCookie: true, payload });
  } catch {
    res.json({ hasCookie: true, payload: null });
  }
}
router.get('/debug-cookie', handleDebugCookie);
export { handleDebugCookie };