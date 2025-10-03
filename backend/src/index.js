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
    httpOnly: false, // CSRF precisa ser acessível pelo JS
    sameSite: 'none', // se for cross-domain e HTTPS
    secure: true      // obrigatório para sameSite: 'none'
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
    '/usuario/register', // ✅ cadastro de usuário também é público
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
      .normalize('NFD').replace(/[ -\u007f]/g, '')
      .replace(/[^a-z0-9\-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    cb(null, `${Date.now()}-${base}${ext || '.png'}`);
  },
});
const uploadAnuncio = multer({
  storage: storageAnuncio,
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

app.post('/upload/anuncio', uploadLimiter, uploadAnuncio.single('file'), async (req, res) => {
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
    // Upload para Cloudinary na pasta 'anuncios'
    const { v2: cloudinary } = await import('cloudinary');
    let url;
    try {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'anuncios' });
      url = result.secure_url;
      fs.unlinkSync(req.file.path);
    } catch (err) {
      logger.error('cloudinary_anuncio_upload_error', { error: err.message });
      return res.status(500).json({ erro: 'Falha ao enviar imagem de anúncio para Cloudinary' });
    }
    logger.info('audit_upload_anuncio', { userId: req.user?.id, url });
    return res.json({ url });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao validar imagem' });
  }
});

// Removido handler explícito de '/' para permitir SPA servir index.html via fallback
app.get('/healthz', (req,res)=>res.json({ ok:true, uptime: process.uptime() }));

// security.txt (divulgação de contato para vulnerabilidades)
app.get('/.well-known/security.txt', (req, res) => {
  const contact = process.env.MAIL_TO || process.env.SMTP_USER || 'security@example.com';
  const policy = process.env.SECURITY_POLICY_URL || 'https://example.com/security-policy';
  const expires = new Date(Date.now() + 1000*60*60*24*30).toISOString().split('T')[0];
  res.type('text/plain').send(`Contact: mailto:${contact}\nPolicy: ${policy}\nExpires: ${expires}\nPreferred-Languages: pt, en`);
});

// Headers extras de segurança complementares
app.use((req,res,next)=>{
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  // Define COOP somente em ambiente considerado "trustworthy" (https ou localhost) para evitar warnings em HTTP simples.
  const host = (req.headers.host || '').toLowerCase();
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase();
  const isHttps = req.protocol === 'https' || forwardedProto.includes('https');
  const isUploads = (req.path || '').startsWith('/uploads');
  if (isHttps || isLocal) {
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    // Para arquivos estáticos que serão embutidos em outra origem (frontend hospedado em outro domínio),
    // não bloqueie com CORP same-origin.
    if (isUploads) {
      res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
    } else {
      res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    }
  }
  res.setHeader('X-Download-Options','noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies','none');
  next();
});

// Middleware de fallback para garantir que sempre enviamos header de origem em erros
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
  return res.status(403).json({ erro: 'Falha de verificação CSRF', dica: 'Busque novo /csrf-token e envie X-CSRF-Token no header.' });
  }
  return next(err);
});

// Email helper (config via .env). If not configured, we just log and return 200.
async function sendEmailIfConfigured({ subject, html, text }) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO, MAIL_PROVIDER } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.log('[ANUNCIOS] Email não configurado. Conteúdo:', { subject, text });
    return { sent: false, reason: 'SMTP not configured' };
  }

  const primaryPort = Number(SMTP_PORT) || 587;
  const attemptsPlan = [];
  const isMailtrap = (MAIL_PROVIDER?.toLowerCase?.() === 'mailtrap') || /mailtrap/i.test(SMTP_HOST);
  // Para Mailtrap só usa a porta informada (não tentar 465, evita logs de erro desnecessários)
  if (isMailtrap) {
    attemptsPlan.push({ port: primaryPort, secure: false });
  } else {
    attemptsPlan.push({ port: primaryPort, secure: primaryPort === 465 });
    if (primaryPort !== 465) attemptsPlan.push({ port: 465, secure: true });
    if (primaryPort !== 587) attemptsPlan.push({ port: 587, secure: false });
  }

  const attemptsResult = [];
  for (const plan of attemptsPlan) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: plan.port,
      secure: plan.secure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    let verifyOk = false;
    let sendOk = false;
    let infoMsg = null;
    let errorCode = null;
    let errorResp = null;
    try {
      await transporter.verify();
      verifyOk = true;
    } catch (e) {
      errorCode = e?.code;
      errorResp = e?.response || e?.message;
      console.error('[EMAIL VERIFY FAIL]', plan.port, plan.secure, errorCode, errorResp);
      attemptsResult.push({ stage: 'verify', port: plan.port, secure: plan.secure, ok: false, code: errorCode, response: errorResp });
      // If credentials invalid (EAUTH / 535) não vale tentar outro envio neste transporte, mas ainda podemos tentar outro port.
      if (['EAUTH'].includes(errorCode) || /535|BadCredentials/i.test(errorResp || '')) continue;
      // continue to next attempt
      continue;
    }
    // If verify ok, attempt send
    try {
      const info = await transporter.sendMail({
        from: MAIL_FROM || SMTP_USER,
        to: MAIL_TO || SMTP_USER,
        subject,
        text,
        html,
      });
      sendOk = true;
      infoMsg = info.messageId;
      attemptsResult.push({ stage: 'send', port: plan.port, secure: plan.secure, ok: true, messageId: infoMsg });
      return { sent: true, messageId: infoMsg, attempts: attemptsResult };
    } catch (e) {
      errorCode = e?.code;
      errorResp = e?.response || e?.message;
      console.error('[EMAIL SEND FAIL]', plan.port, plan.secure, errorCode, errorResp);
      attemptsResult.push({ stage: 'send', port: plan.port, secure: plan.secure, ok: false, code: errorCode, response: errorResp });
      // continue loop to try next plan
    }
  }
  // none succeeded
  return { sent: false, reason: 'ALL_ATTEMPTS_FAILED', attempts: attemptsResult };
}

// Captura anúncios (Anuncie) e envia por email (se configurado)
app.post('/anuncios', anunciosLimiter, async (req, res) => {
  const { nome, contato, mensagem } = req.body || {};
  if (!nome || !contato || !mensagem) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, contato, mensagem' });
  }
  const nomeSafe = sanitizeText(nome);
  const contatoSafe = sanitizeText(contato);
  const mensagemSafe = sanitizeText(mensagem);
  const subject = `Novo anúncio - ${nomeSafe}`;
  const text = `Nome/Empresa: ${nomeSafe}\nContato: ${contatoSafe}\n\nMensagem:\n${mensagemSafe}`;
  const html = `
    <h2>Novo anúncio recebido</h2>
    <p><strong>Nome/Empresa:</strong> ${nomeSafe}</p>
    <p><strong>Contato:</strong> ${contatoSafe}</p>
    <p><strong>Mensagem:</strong></p>
    <pre style="white-space:pre-wrap;font-family:inherit">${mensagemSafe}</pre>
  `;
  try {
    const result = await sendEmailIfConfigured({ subject, text, html });
  logger.info('audit_anuncio', { nome: nomeSafe, contatoHash: crypto.createHash('sha256').update(contatoSafe).digest('hex').slice(0,16) });
    return res.json({ ok: true, email: result });
  } catch (err) {
    console.error('Erro ao enviar email de anúncio:', err?.response || err);
    // Não falhar a operação principal: registrar envio lógico
    return res.status(200).json({ ok: true, email: { sent: false, reason: 'EMAIL_AUTH_FAIL', message: err.message } });
  }
});

// Recebe feedback (Opine) e envia por email (se configurado)
app.post('/feedback', feedbackLimiter, async (req, res) => {
  try {
    const { nome, mensagem } = req.body || {};
    if (!mensagem || !String(mensagem).trim()) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }
    const nomeFmt = sanitizeText((nome && String(nome).trim()) || 'Anônimo');
    const mensagemSafe = sanitizeText(mensagem);
    const subject = `Novo feedback - ${nomeFmt}`;
    const text = `Nome: ${nomeFmt}\n\nMensagem:\n${mensagemSafe}`;
    const html = `
      <h2>Novo feedback recebido</h2>
      <p><strong>Nome:</strong> ${nomeFmt}</p>
      <p><strong>Mensagem:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${mensagemSafe}</pre>
    `;
    const result = await sendEmailIfConfigured({ subject, text, html });
  logger.info('audit_feedback', { nome: nomeFmt, mensagemHash: crypto.createHash('sha256').update(mensagemSafe).digest('hex').slice(0,16) });
    return res.json({ ok: true, email: result });
  } catch (err) {
    console.error('Erro ao processar feedback:', err);
    return res.status(500).json({ error: 'Erro ao processar feedback' });
  }
});


// --- SOCKET.IO CHAT ---
let onlineUsers = {};
// Simple request logger (non-PII) with correlation id
app.use((req, res, next) => {
  const start = Date.now();
  const rid = crypto.randomUUID();
  req.id = rid;
  res.setHeader('X-Request-ID', rid);
  res.on('finish', () => {
    const ms = Date.now() - start;
  logger.info('request', { id: rid, method: req.method, url: req.originalUrl, status: res.statusCode, ms });
  });
  next();
});

io.on('connection', (socket) => {
  logger.info('socket_connected', { socket: socket.id });
  const msgWindowMs = 5000; // 5s janela
  const maxMsgsPerWindow = 8;
  let msgTimestamps = [];


  // Espera objeto: { apelido, tipo }
  socket.on('join', (userObj) => {
    // userObj: { apelido, tipo } ou string
    let user = {};
    if (typeof userObj === 'string') {
      user = { apelido: userObj, tipo: '' };
    } else {
      user = {
        apelido: userObj?.apelido || 'Anônimo',
        tipo: userObj?.tipo || ''
      };
    }
    onlineUsers[socket.id] = user;
    io.emit('onlineUsers', Object.values(onlineUsers));
  });

  socket.on('chatMessage', (msg) => {
    const now = Date.now();
    msgTimestamps = msgTimestamps.filter(t => now - t < msgWindowMs);
    if (msgTimestamps.length >= maxMsgsPerWindow) {
      return; // silenciosamente dropa (poderia emitir aviso)
    }
    msgTimestamps.push(now);
    // Broadcast para todos
    const user = onlineUsers[socket.id] || { apelido: 'Anônimo', tipo: '' };
    io.emit('chatMessage', {
      apelido: user.apelido,
      tipo: user.tipo,
      message: typeof msg === 'object' ? msg.message : msg,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('onlineUsers', Object.values(onlineUsers));
  logger.info('socket_disconnected', { socket: socket.id });
  });
});

// ---------- Static Frontend Build (single-port deploy) ----------
// Se existir ../frontend/dist usa; senão tenta ../frontend/public para assets básicos
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const frontendPublic = path.join(__dirname, '..', '..', 'frontend', 'public');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false }));
} else if (fs.existsSync(frontendPublic)) {
  app.use(express.static(frontendPublic, { index: false }));
}

// Fallback SPA: após todas as rotas API e uploads
app.get('*', (req, res, next) => {
  // Ignora se é rota de API (possui pontos? assume asset) ou começa com /uploads
  if (req.path.startsWith('/uploads')) return next();
  // Se pedir algo com extensão (ex: .js .png) deixa 404 padrão
  if (/\.[a-zA-Z0-9]{2,5}$/.test(req.path)) return next();
  const indexFileDist = path.join(frontendDist, 'index.html');
  const indexFilePublic = path.join(frontendPublic, 'index.html');
  if (fs.existsSync(indexFileDist)) return res.sendFile(indexFileDist);
  if (fs.existsSync(indexFilePublic)) return res.sendFile(indexFilePublic);
  return next();
});

const PORT = process.env.PORT || 3001;
let serverStarted = false;
function startServerOnce() {
  if (serverStarted) return;
  serverStarted = true;
  server.listen(PORT, () => {
    logger.info('server_started', { port: PORT, socket: true });
  });
}

// Adicione esta função no final, após registrar TODAS as rotas:
function printRoutes(app) {
  const routes = [];
  app._router?.stack.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(',').toUpperCase();
      routes.push({ method: methods, path: m.route.path });
    } else if (m.name === 'router' && m.handle?.stack) {
      m.handle.stack.forEach((h) => {
        const route = h.route;
        if (route) {
          const methods = Object.keys(route.methods).join(',').toUpperCase();
          routes.push({ method: methods, path: route.path });
        }
      });
    }
  });
  logger.debug('routes_registered', { count: routes.length, routes });
}

printRoutes(app);

async function bootstrap() {
  // Crie as tabelas antes de qualquer alteração
  // Ordem correta de criação das tabelas para respeitar dependências
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuario (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT,
      senha TEXT,
      tipo TEXT,
      autorizado BOOLEAN DEFAULT FALSE,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bolao (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      admin_id INTEGER,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campeonato (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      bolao_id INTEGER REFERENCES bolao(id) ON DELETE CASCADE,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rodada (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      campeonato_id INTEGER REFERENCES campeonato(id) ON DELETE CASCADE,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partida (
      id SERIAL PRIMARY KEY,
      rodada_id INTEGER REFERENCES rodada(id) ON DELETE CASCADE,
      time1 TEXT,
      time2 TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS palpite (
      id SERIAL PRIMARY KEY,
      partida_id INTEGER REFERENCES partida(id) ON DELETE CASCADE,
      usuario_id INTEGER REFERENCES usuario(id) ON DELETE CASCADE,
      palpite TEXT,
      pontos INTEGER DEFAULT 0,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_blocked_ip (
      ip VARCHAR(45) PRIMARY KEY,
      bloqueado_em TIMESTAMP DEFAULT NOW(),
      desbloqueado BOOLEAN DEFAULT FALSE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS time (
      id           SERIAL PRIMARY KEY,
      nome         TEXT UNIQUE NOT NULL,
      escudo_url   TEXT,
      ativo        BOOLEAN DEFAULT TRUE,
      criado_em    TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS post (
      id            SERIAL PRIMARY KEY,
      autor_id      INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
      titulo        TEXT NOT NULL,
      conteudo      TEXT NOT NULL,
      criado_em     TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);

  // Ensure flags used by code exist
  await pool.query(`ALTER TABLE rodada ADD COLUMN IF NOT EXISTS finalizada boolean DEFAULT false`);
  await pool.query(`ALTER TABLE partida ADD COLUMN IF NOT EXISTS finalizada boolean DEFAULT false`);
  await pool.query(`ALTER TABLE campeonato ADD COLUMN IF NOT EXISTS finalizado boolean DEFAULT false`);
  await pool.query(`ALTER TABLE bolao ADD COLUMN IF NOT EXISTS finalizado boolean DEFAULT false`);
  await pool.query(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS desistiu boolean DEFAULT false`);
  await pool.query(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS banido boolean DEFAULT false`);
  await pool.query(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS avatar_url text`);
  await pool.query(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS foto_url text`);
  await pool.query(`ALTER TABLE usuario ADD COLUMN IF NOT EXISTS apelido text`);
  // Ensure required columns for partidas/rodadas used by endpoints
  await pool.query(`ALTER TABLE partida ADD COLUMN IF NOT EXISTS data_partida TIMESTAMP`);
  await pool.query(`ALTER TABLE partida ADD COLUMN IF NOT EXISTS resultado TEXT`);
  await pool.query(`ALTER TABLE rodada ADD COLUMN IF NOT EXISTS campeonato_id INTEGER REFERENCES campeonato(id) ON DELETE CASCADE`);

  // Unique palpite per (usuario, partida)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'palpite_usuario_partida_unique'
      ) THEN
        ALTER TABLE palpite ADD CONSTRAINT palpite_usuario_partida_unique UNIQUE (usuario_id, partida_id);
      END IF;
    END $$;
  `);

  // Garante colunas auxiliares na tabela de IPs bloqueados (caso schema antigo)
  await pool.query(`ALTER TABLE login_blocked_ip ADD COLUMN IF NOT EXISTS email VARCHAR(100);`);
  await pool.query(`ALTER TABLE login_blocked_ip ADD COLUMN IF NOT EXISTS nome_usuario VARCHAR(100);`);
  // Cria índice em bloqueado_em para limpeza mais rápida
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_blocked_ip_bloqueado_em ON login_blocked_ip(bloqueado_em);`);

  // Cria usuário admin de desenvolvimento se nenhum existir (apenas em não-produção)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const r = await pool.query(`SELECT id FROM usuario WHERE tipo = 'admin' LIMIT 1`);
      if (!r.rows.length) {
        const devPass = 'mM20203805@';
        const cost = 10;
        const hash = await bcrypt.hash(devPass, cost);
        const novo = await pool.query(`INSERT INTO usuario (nome,email,senha,tipo,autorizado) VALUES ($1,$2,$3,'admin',true) RETURNING id,email`, [
          'Admin Dev',
          'admin@dev.local',
          hash
        ]);
        logger.info('dev_admin_created', { userId: novo.rows[0].id, email: novo.rows[0].email, senhaPadrao: devPass });
      }
    } catch (e) {
      logger.warn('dev_admin_create_fail', { error: e.message });
    }
  }
}
bootstrap()
  .then(() => {
    logger.info('bootstrap_complete');
    startServerOnce();
  })
  .catch((e) => {
    console.error('Bootstrap error:', e);
    startServerOnce(); // ainda inicia para permitir inspeção, mas logs mostram erro
  });

// Tarefa simples de desbloqueio automático (IPs bloqueados há > 6h)
setInterval(async () => {
  try {
    await pool.query(`UPDATE login_blocked_ip SET desbloqueado = true WHERE COALESCE(desbloqueado,false)=false AND bloqueado_em < NOW() - INTERVAL '6 hours'`);
  } catch (e) {
    console.warn('Falha ao auto-desbloquear IPs:', e.message);
  }
}, 30 * 60 * 1000); // a cada 30 minutos

export default app;