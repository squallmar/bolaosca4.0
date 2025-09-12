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

// Configuração de upload
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

// Configuração JWT
const fallbackSecret = 'dev-secret';
const rawSecret = process.env.JWT_SECRET || fallbackSecret;
if (!process.env.JWT_SECRET) {
  console.warn('[SEC] JWT_SECRET não definido. Usando fallback de desenvolvimento.');
}
if (process.env.NODE_ENV === 'production' && rawSecret === fallbackSecret) {
  console.error('[SEC] JWT_SECRET fraco em produção. Abortar.');
  throw new Error('JWT_SECRET fraco – defina variável de ambiente segura.');
}
const JWT_SECRET = rawSecret;
const revokedJti = new Set();

function signToken(payload) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: '8h' });
  return { token, jti };
}

function pegarToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

// MIDDLEWARE DE AUTENTICAÇÃO CORRIGIDO
export async function exigirAutenticacao(req, res, next) {
  try {
    console.log('=== AUTH DEBUG ===');
    console.log('Origin:', req.headers.origin);
    console.log('Cookies:', req.cookies);
    console.log('Auth Header:', req.headers.authorization);

    const token = pegarToken(req);
    if (!token) {
      console.log('DEBUG: Nenhum token encontrado');
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('Erro de verificação JWT:', error.message);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ erro: 'Token expirado' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ erro: 'Token inválido' });
      }
      return res.status(401).json({ erro: 'Erro de autenticação' });
    }

    if (payload?.jti && revokedJti.has(payload.jti)) {
      return res.status(401).json({ erro: 'Sessão expirada' });
    }

    // Buscar usuário no banco
    const { rows } = await pool.query(
      'SELECT id, nome, email, tipo, autorizado FROM usuario WHERE id = $1',
      [payload.id]
    );
    
    if (!rows[0]) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }

    if (!rows[0].autorizado) {
      return res.status(401).json({ erro: 'Usuário não autorizado' });
    }

    req.user = {
      id: rows[0].id,
      role: rows[0].tipo,
      autorizado: rows[0].autorizado,
      email: rows[0].email,
      nome: rows[0].nome
    };
    
    console.log('DEBUG: Autenticação bem-sucedida para usuário:', req.user.id);
    next();
  } catch (error) {
    console.error('Erro geral de autenticação:', error);
    return res.status(500).json({ erro: 'Erro interno de autenticação' });
  }
}

export function exigirRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ erro: 'Sessão expirada' });
    if ((req.user.role || '').toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
  };
}

// Controle de tentativas
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const captchaChallenges = new Map();

function needCaptcha(ip) {
  if (process.env.NODE_ENV !== 'production' && process.env.FORCE_CAPTCHA !== 'true') return false;
  return (loginAttempts[ip] || 0) >= 3;
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
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendDomain = isProduction ? '.vercel.app' : undefined;
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 8,
    path: '/',
    domain: frontendDomain
  });
}

// REGISTRO
router.post('/register', uploadLocalAvatar.single('avatar'), async (req, res) => {
  try {
    const { nome, email, senha, tipo, apelido, contato } = req.body;
    
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

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.connection?.remoteAddress;
    const { email, senha, captcha } = req.body || {};

    if (await isIpBlocked(ip)) {
      return res.status(403).json({ erro: 'Este IP está bloqueado' });
    }

    loginAttempts[ip] = loginAttempts[ip] || 0;
    if (loginAttempts[ip] >= MAX_ATTEMPTS) {
      await blockIp(ip, email, null);
      notifyBlockedIP(ip, email, null);
      return res.status(403).json({ erro: 'Múltiplas tentativas falhas' });
    }

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    if (needCaptcha(ip)) {
      const ch = captchaChallenges.get(ip);
      if (!captcha || !ch || Number(captcha) !== ch.answer) {
        const { a, b } = getOrCreateChallenge(ip);
        return res.status(400).json({ erro: 'Captcha requerido', captchaDesafio: `${a}+${b}` });
      }
    }

    const rows = await safeQuery(pool, 'SELECT * FROM usuario WHERE email = $1', [email]);
    const usuario = rows[0];
    
    if (!usuario) {
      loginAttempts[ip]++;
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const match = await bcrypt.compare(senha, usuario.senha);
    if (!match) {
      loginAttempts[ip]++;
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    // GERAÇÃO DO TOKEN CORRETA - usando JWT_SECRET
    const token = jwt.sign(
      { 
        id: usuario.id, 
        email: usuario.email, 
        tipo: usuario.tipo, 
        autorizado: usuario.autorizado 
      },
      JWT_SECRET, // CORRIGIDO: usar JWT_SECRET, não ACCESS_TOKEN_SECRET
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token, req);
    
    const userOut = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      autorizado: usuario.autorizado,
      avatarUrl: usuario.avatar_url
    };

    loginAttempts[ip] = 0;
    captchaChallenges.delete(ip);
    
    logger.info('login_success', { userId: usuario.id, email, ip });
    return res.json({ token, usuario: userOut });

  } catch (err) {
    logger.warn('login_error', { error: err.message });
    return res.status(500).json({ erro: 'Erro no login' });
  }
});

// ... (restante das rotas permanece igual)

export default router;
