import express from 'express';
import cloudinary from 'cloudinary';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from './db.js';
import { safeQuery, sanitizeMediaUrl } from './utils.js';
import multer from 'multer';
import { logger } from './logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { notifyBlockedIP } from './admin.js';

// Configuração Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuração de upload
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

// Usar memoryStorage para produção (Vercel/Render não tem filesystem)
const storageAvatarLocal = multer.memoryStorage();

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
async function exigirAutenticacao(req, res, next) {
  try {
    console.log('=== AUTH DEBUG ===');
    console.log('Origin:', req.headers.origin);
    console.log('Cookies:', req.cookies);
    console.log('Auth Header:', req.headers.authorization);
    console.log('Session:', req.session);
    const token = pegarToken(req);
    if (!token) {
      console.log('DEBUG: Nenhum token encontrado');
      return res.status(401).json({ erro: 'Token não fornecido' });
    }
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
      console.log('DEBUG: Payload JWT:', payload);
    } catch (error) {
      console.error('Erro de verificação JWT:', error.message, error);
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ erro: 'Token expirado' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ erro: 'Token inválido' });
      }
      return res.status(401).json({ erro: 'Erro de autenticação' });
    }
    if (payload?.jti && revokedJti.has(payload.jti)) {
      console.log('DEBUG: Sessão expirada pelo jti:', payload.jti);
      return res.status(401).json({ erro: 'Sessão expirada' });
    }
    // Buscar usuário no banco
    const { rows } = await pool.query(
      'SELECT id, nome, email, tipo, autorizado FROM usuario WHERE id = $1',
      [payload.id]
    );
    if (!rows[0]) {
      console.log('DEBUG: Usuário não encontrado no banco:', payload.id);
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }
    if (!rows[0].autorizado) {
      console.log('DEBUG: Usuário não autorizado:', rows[0]);
      return res.status(401).json({ erro: 'Usuário não autorizado' });
    }
    req.user = {
      id: rows[0].id,
      role: rows[0].tipo,
      autorizado: rows[0].autorizado,
      email: rows[0].email,
      nome: rows[0].nome
    };
    console.log('DEBUG: Autenticação bem-sucedida para usuário:', req.user);
    next();
  } catch (error) {
    console.error('Erro geral de autenticação:', error);
    return res.status(500).json({ erro: 'Erro interno de autenticação' });
  }
}

function exigirRole(role) {
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
  // Não force o domínio; permita que o navegador aceite como cookie de site cruzado via SameSite=None
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  partitioned: isProduction ? true : undefined,
    maxAge: 1000 * 60 * 60 * 8,
    path: '/'
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
      // Em produção sem FS persistente, gravamos uma URL relativa que o frontend prefixa com API_BASE
      avatarUrl = '/uploads/avatars/avatar_default.jpg';
    } else if (req.body.avatarUrl) {
      // Aceita apenas caminhos relativos seguros; evita URLs com múltiplos hosts concatenados
      const val = String(req.body.avatarUrl || '').trim();
      avatarUrl = val.startsWith('http://') || val.startsWith('https://') ? val : ('/' + val.replace(/^\/+/, ''));
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
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    setAuthCookie(res, token, req);
    
    const userOut = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      autorizado: usuario.autorizado,
      avatarUrl: sanitizeMediaUrl(usuario.avatar_url || '/uploads/avatars/avatar_default.jpg', 'avatar')
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

// Obter dados do próprio usuário
router.get('/me', exigirAutenticacao, async (req, res) => {
  try {
    logger.debug('auth_me_hit', { hasUser: !!req.user, userId: req.user?.id });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  const rows = await safeQuery(pool, 'SELECT id, nome, email, tipo, autorizado, avatar_url, apelido FROM usuario WHERE id = $1', [userId]);
    const u = rows[0];
    if (!u) return res.status(404).json({ erro: 'Usuário não encontrado' });
  return res.json({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, autorizado: u.autorizado, avatarUrl: sanitizeMediaUrl(u.avatar_url || '/uploads/avatars/avatar_default.jpg', 'avatar'), apelido: u.apelido });
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
  return res.json({ id: u.id, nome: u.nome, email: u.email, tipo: u.tipo, autorizado: u.autorizado, avatarUrl: sanitizeMediaUrl(u.avatar_url, 'avatar'), apelido: u.apelido });
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
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });

    // Upload para Cloudinary
    const buffer = req.file.buffer;
    const uploadResult = await cloudinary.v2.uploader.upload_stream({
      folder: 'usuarios',
      resource_type: 'image',
      public_id: `avatar_${userId}_${Date.now()}`,
      overwrite: true,
    }, async (error, result) => {
      if (error || !result) {
        console.error('Erro Cloudinary:', error);
        return res.status(500).json({ erro: 'Falha ao enviar imagem para Cloudinary' });
      }
      const url = result.secure_url;
      await safeQuery(pool, 'UPDATE usuario SET avatar_url = $1 WHERE id = $2', [url, userId]);
      return res.json({ avatarUrl: url });
    });
    // Escreve o buffer no stream
    uploadResult.end(buffer);
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
        if (full.startsWith(avatarsDir) && fs.existsSync(full)) {
          fs.unlinkSync(full);
        }
      } catch (e) {
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

// Logout (invalida cookie)
router.post('/logout', (req, res) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.jti) revokedJti.add(decoded.jti);
      } catch {}
    }
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', { httpOnly: true, sameSite: isProduction ? 'none' : 'lax', secure: isProduction, path: '/', partitioned: isProduction ? true : undefined });
    return res.json({ ok: true });
  } catch (err) {
    logger.error('logout_error', { error: err.message });
    return res.status(500).json({ erro: 'Falha ao encerrar sessão' });
  }
});

// Refresh de sessão
router.post('/refresh', (req, res) => {
  try {
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
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp || 0;
    const remaining = exp - now;
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

// Rota de debug para verificar recebimento de cookie
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

// EXPORTAÇÃO ÚNICA NO FINAL - SEM DUPLICAÇÕES
export { exigirAutenticacao, exigirRole, handleDebugCookie };
export default router;