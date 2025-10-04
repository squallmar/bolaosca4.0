import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pool from './db.js';
import { safeQuery } from './utils.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Registro
router.post('/register', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;
  try {
    if (typeof senha !== 'string' || senha.length < 4 || senha.length > 8) {
      return res.status(400).json({ erro: 'Senha deve ter entre 4 e 8 caracteres.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const rows = await safeQuery(
      pool,
      'INSERT INTO usuario (nome, email, senha, tipo, autorizado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, email, hash, tipo || 'comum', false]
    );
    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ erro: 'Email já cadastrado. Use outro email.' });
    res.status(400).json({ erro: 'Erro ao cadastrar usuário', detalhes: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  try {
  const rows = await safeQuery(pool, 'SELECT * FROM usuario WHERE email = $1', [email]);
  const usuario = rows[0];
    if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado' });

    const ok = await bcrypt.compare(senha, usuario.senha);
    if (!ok) return res.status(401).json({ erro: 'Senha incorreta' });

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo, autorizado: usuario.autorizado },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Cookie httpOnly (opcional) + retorno do token
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    });

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo, autorizado: usuario.autorizado } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ erro: 'Falha no login' });
  }
});

export default router;