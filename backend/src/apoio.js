import path from 'path';
import fs from 'fs';
import multer from 'multer';
import express from 'express';
import { sanitizeText } from './utils.js';

const router = express.Router();

const apoioDir = path.join(path.resolve(), 'uploads', 'apoio');
if (!fs.existsSync(apoioDir)) fs.mkdirSync(apoioDir, { recursive: true });

const storageApoio = multer.diskStorage({
  destination: (req, file, cb) => cb(null, apoioDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png').toLowerCase();
    cb(null, 'pix' + ext);
  },
});

const uploadApoio = multer({
  storage: storageApoio,
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Arquivo inválido: somente imagens'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Salva imagem do PIX e mensagem
router.post('/upload', uploadApoio.single('file'), (req, res) => {
  const raw = req.body.msg || '';
  const msg = sanitizeText(raw).slice(0,2000);
  fs.writeFileSync(path.join(apoioDir, 'mensagem.txt'), msg, 'utf8');
  if (req.file) {
    return res.json({
      url: `/uploads/apoio/${req.file.filename}`,
      msg,
    });
  } else {
    // Só mensagem, retorna imagem atual se existir
    const imgPath = path.join(apoioDir, 'pix.png');
    const imgUrl = fs.existsSync(imgPath) ? `/uploads/apoio/pix.png` : '';
    return res.json({
      url: imgUrl,
      msg,
    });
  }
});

// Retorna imagem e mensagem atuais
router.get('/conteudo', (req, res) => {
  const msgPath = path.join(apoioDir, 'mensagem.txt');
  const msg = fs.existsSync(msgPath) ? fs.readFileSync(msgPath, 'utf8') : '';
  // Busca por qualquer arquivo pix.*
  let imgUrl = '';
  const files = fs.readdirSync(apoioDir);
  const pixFile = files.find(f => f.startsWith('pix.'));
  if (pixFile) imgUrl = `/uploads/apoio/${pixFile}`;
  res.json({ imgUrl, msg });
});

export default router;
