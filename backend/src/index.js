console.log('[BOOT] Carregando backend index.js');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import csurf from 'csurf';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import cookieParser from 'cookie-parser';
import { logger } from './logger.js';

// resolvendo __dirname em ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// trust proxy for correct IPs when behind reverse proxy
app.set('trust proxy', 1);
logger.info('bootstrap_start', { node: process.version, pid: process.pid });

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection', reason);
});

// Enforce strong JWT secret in production
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /dev-secret|changeme|secret/i.test(secret)) {
    console.error('[SEC] JWT_SECRET inseguro ou curto em produção. Abortando.');
    process.exit(1);
  }
}

// ---- Validação de variáveis de ambiente críticas (email) ----
function validateEmailEnv() {
  const required = ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'];
  const missing = required.filter(k => !process.env[k] || !String(process.env[k]).trim());
  if (missing.length) {
    console.warn('[EMAIL] Variáveis ausentes:', missing.join(', '), '\n-> Envio de email desativado.');
    process.env.EMAIL_ENABLED = 'false';
  } else {
    process.env.EMAIL_ENABLED = 'true';
    if (!process.env.MAIL_FROM) {
      console.warn('[EMAIL] MAIL_FROM não definido. Usando SMTP_USER como remetente.');
    }
    if (!process.env.MAIL_TO) {
      console.warn('[EMAIL] MAIL_TO não definido. Usando SMTP_USER como destinatário padrão.');
    }
  }
}
validateEmailEnv();

// ---------- CORS Global ----------

// Função flexível para aceitar todos subdomínios .vercel.app e localhost
const flexibleOrigin = (origin, callback) => {
  const allowedOrigins = [
    'https://bolaosca4-0.vercel.app',
    'https://bolaosca4-0.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    callback(null, true);
  } else {
    console.log('Origin não permitida: ' + origin);
    callback(new Error('Origin não permitida: ' + origin), false);
  }
};


// Configuração CORS Corrigida
const allowedOrigins = [
  'https://bolaosca4-0.vercel.app',
  'https://bolaosca4-0.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sem origin (como mobile apps, curl)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      callback(null, true);
    } else {
      console.log('Origin não permitida:', origin);
      callback(new Error('Origin não permitida'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(compression());
app.options('*', cors(corsOptions));

// Fallback para avatars inexistentes -> retorna imagem padrão (antes do static)
app.get('/uploads/avatars/:filename', cors({
  origin: flexibleOrigin,
  credentials: true,
  methods: ['GET','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token']
}), (req, res, next) => {
  const requested = path.join(__dirname, '..', 'uploads', 'avatars', req.params.filename);
  fs.access(requested, fs.constants.F_OK, (err) => {
    if (!err) return next(); // deixa o static servir
  const fallback = path.join(__dirname, '..', 'uploads', 'avatars', 'avatar_default.jpg');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return res.status(404).end();
  });
});

// Servir uploads (somente GET) com CORS explícito
app.use('/uploads', cors({
  origin: flexibleOrigin,
  credentials: true,
  methods: ['GET','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token']
}), express.static(path.join(__dirname, '..', 'uploads')));

// Proteção contra XSS, clickjacking, etc
// CSP endurecida: removido 'unsafe-inline' em script e agora também de style (front é separado, não dependemos de inline CSS aqui)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
  // Permitindo Google Fonts (CSS) e mantendo self; se quiser remover depois, inlinar fontes locais
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  // Imagens locais + data/blob
  "img-src": ["'self'","data:","blob:"],
  // Fontes remotas usadas pelos Google Fonts + data URIs
  "font-src": ["'self'","https://fonts.gstatic.com","data:"],
  // Conexões: self + ws + http(s) (para IP público ou túnel). Se quiser endurecer depois, trocar por origens específicas.
  "connect-src": ["'self'","ws:","http:","https:"],
      "media-src": ["'self'"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
}));
// Add HSTS in production
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_HSTS !== 'true') {
  app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: true }));
} else if (process.env.DISABLE_HSTS === 'true') {
  logger.info('hsts_disabled_temp');
}
const server = http.createServer(app);

// Fallback automático se porta em uso: tenta próxima porta livre (incremental +1)
let primaryPortTried = false;
server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE' && !primaryPortTried) {
    primaryPortTried = true;
    const basePort = Number(process.env.PORT || 3001);
    const alt = basePort + 1;
    logger.warn('port_in_use_try_increment', { port: basePort, alt });
    try {
      server.listen(alt, () => {
        logger.info('server_started_alt', { port: alt });
      });
    } catch (e) {
      logger.error('port_increment_fail', { error: e.message });
      process.exit(1);
    }
  } else {
    logger.error('server_error', { error: err.message, code: err.code });
    process.exit(1);
  }
});
const io = new SocketIO(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Socket.IO origin não permitido: ' + origin));
    },
    credentials: true,
  }
});
app.use(cookieParser()); // precisa vir ANTES do csurf quando usa { cookie: true }
// JSON/body limits para mitigar payload abuse
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
const blogWriteLimiter = rateLimit({ windowMs: 5*60*1000, max: 30, message: { erro: 'Muitas operações de blog.' } });

// Inicializa proteção CSRF (cookie-based)
// Em produção precisamos permitir envio cross-site (front em Vercel, API em Render)
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    // partitioned: process.env.NODE_ENV === 'production' ? true : undefined // REMOVIDO para compatibilidade
  }
});

// Rota dedicada para obter token CSRF com CORS explícito
app.get('/csrf-token', cors({ origin: flexibleOrigin, credentials: true }), csrfProtection, (req, res) => {
  const token = req.csrfToken();
  // Envia também em cookie legível pelo frontend
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    // partitioned: process.env.NODE_ENV === 'production' ? true : undefined // REMOVIDO para compatibilidade
  });
  res.json({ csrfToken: token });
});

// Proteger rotas mutáveis com CSRF, mas liberar endpoints públicos e uploads
app.use((req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  const publicPrefixes = [
    '/auth/login',
    '/auth/register',
  '/auth/refresh',
  '/auth/logout',
    '/csrf-token',
    '/upload/avatar',
    '/upload/escudo'
  ];
  if (publicPrefixes.some(p => req.path.startsWith(p))) return next();
  // Se já está autenticado via Bearer (JWT), consideramos as rotas idempotentes em termos de CSRF
  // pois não dependem de cookies de sessão. Isto evita exigir token CSRF duplicado.
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return next();
  // Demais rotas mutáveis exigem CSRF
  return csrfProtection(req, res, next);
});
import authRouter from './auth.js';
// Rota debug-cookie exposta diretamente
// app.get('/auth/debug-cookie', handleDebugCookie);
import adminRouter from './admin.js';
import bolaoRouter from './bolao.js';
import palpiteRouter from './palpite.js';
import usuariosRouter from './usuarios.js';
import timesRouter from './timesRouter.js';
import blogRouter from './blog.js';
import apoioRouter from './apoio.js';
import regrasRouter from './regras.js';
import pool from './db.js';
import bcrypt from 'bcrypt';

// pastas de upload
const uploadsDir = path.join(__dirname, '..', 'uploads');
const escudosDir = path.join(uploadsDir, 'escudos');
const avatarsDir = path.join(uploadsDir, 'avatars');

// garante que existam
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(escudosDir)) fs.mkdirSync(escudosDir, { recursive: true });
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

// (CORS global já configurado acima)
// (Removido middleware genérico de set de cookie CSRF para evitar chamadas sem secret)

// Rate limit específico para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { erro: 'Muitas tentativas de login. Tente novamente depois.' }
});
app.use('/auth/login', loginLimiter);
// Rate limit para registro (abuso de criação)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { erro: 'Muitas tentativas de registro. Tente novamente mais tarde.' }
});
app.use('/auth/register', registerLimiter);
// Rate limiter geral básico
const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 300 });
app.use(globalLimiter);

// Limites específicos apostas e resultado
const apostaLimiter = rateLimit({ windowMs: 60 * 1000, max: 25, message: { erro: 'Muitas apostas em pouco tempo.' } });
app.use('/palpite/apostar', apostaLimiter);
const resultadoLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { erro: 'Muitos lançamentos de resultado.' } });
app.use('/palpite/resultado', resultadoLimiter);

// Limites específicos de abuso
const anunciosLimiter = rateLimit({ windowMs: 60*60*1000, max: 10, message: { erro: 'Limite de envios de anúncios atingido. Tente depois.' } });
const feedbackLimiter = rateLimit({ windowMs: 60*60*1000, max: 15, message: { erro: 'Limite de feedback atingido. Tente depois.' } });
const uploadLimiter = rateLimit({ windowMs: 60*60*1000, max: 40, message: { erro: 'Muitos uploads. Tente mais tarde.' } });
app.use('/auth', authRouter); // <- monta rotas de auth

app.use('/admin', adminRouter);
app.use('/bolao', bolaoRouter);
app.use('/palpite', palpiteRouter);
app.use('/usuario', usuariosRouter);
// Importante: manter '/times' porque o webpack devServer faz pathRewrite '^/api' -> ''
// Assim chamadas frontend para '/api/times' chegam aqui como '/times'
app.use('/times', timesRouter);
// Limiter de mutações de blog ANTES do router
app.use(['/blog','/blog/*'], (req,res,next)=>{
  if (['POST','PUT','PATCH','DELETE'].includes(req.method)) return blogWriteLimiter(req,res,next);
  return next();
});
app.use('/blog', blogRouter);
app.use('/apoio', apoioRouter);
app.use('/regras', regrasRouter);

// servir arquivos
// servir arquivos com CORS liberado
// ...já movido para o topo...

// filtro imagens
function imageFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Arquivo inválido: somente imagens'), false);
}

// storage para escudos
const storageEscudo = multer.diskStorage({
  destination: (req, file, cb) => cb(null, escudosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase();
    const base = path
      .basename(file.originalname || 'escudo', ext)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    cb(null, `${Date.now()}-${base}${ext || '.png'}`);
  },
});

const uploadEscudo = multer({
  storage: storageEscudo,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// storage para avatars de usuários
const storageAvatar = multer.diskStorage({
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

const uploadAvatar = multer({
  storage: storageAvatar,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const BASE_URL = process.env.BASE_URL || 'https://bolaosca4-0.vercel.app';

// rota de upload de escudo
import { verifyImageSignature, sanitizeText, verifyImageIntegrity } from './utils.js';
app.post('/upload/escudo', uploadLimiter, uploadEscudo.single('file'), async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ erro: 'Origin não permitida' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo' });
  try {
  const ok = await verifyImageSignature(req.file.path);
  const ok2 = ok ? await verifyImageIntegrity(req.file.path) : false;
  if (!ok2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ erro: 'Arquivo inválido (assinatura)' });
    }
    const url = `${BASE_URL}/uploads/escudos/${req.file.filename}`;
    logger.info('audit_upload_escudo', { userId: req.user?.id, filename: req.file.filename });
    return res.json({ url });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao validar imagem' });
  }
});

// rota de upload de avatar de usuário
app.post('/upload/avatar', uploadLimiter, uploadAvatar.single('file'), async (req, res) => {
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ erro: 'Origin não permitida' });
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo' });
  try {
    const ok = await verifyImageSignature(req.file.path);
    const ok2 = ok ? await verifyImageIntegrity(req.file.path) : false;
    if (!ok2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ erro: 'Arquivo inválido (assinatura)' });
    }
    // Upload para Cloudinary na pasta 'usuarios'
    const { v2: cloudinary } = await import('cloudinary');
    let url;
    try {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'usuarios' });
      url = result.secure_url;
      fs.unlinkSync(req.file.path);
    } catch (err) {
      logger.error('cloudinary_avatar_upload_error', { error: err.message });
      return res.status(500).json({ erro: 'Falha ao enviar avatar para Cloudinary' });
    }
    logger.info('audit_upload_avatar', { userId: req.user?.id, url });
    return res.json({ url });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao validar imagem' });
  }
});

// rota de upload de imagem de anúncio TV
const anunciosDir = path.join(uploadsDir, 'anuncios');
if (!fs.existsSync(anunciosDir)) fs.mkdirSync(anunciosDir, { recursive: true });
const storageAnuncio = multer.diskStorage({
  destination: (req, file, cb) => cb(null, anunciosDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase();
    const base = path
      .basename(file.originalname || 'anuncio', ext)
      .toLowerCase()
      .normalize('NFD').replace(/[