import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './authContext';
import './Auth.css';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  async function handleLogin(e) {
    e.preventDefault();
    setErro('');
    if (loading) return;
    setLoading(true);
    try {
      console.log('[Login] submit clicked');
      const res = await api.post('/auth/login', { email, senha }, { withCredentials: true }); // ✅ garante cookie
  const u = res.data?.usuario || {};
  const avatarUrlFromApi = u.avatarUrl || u.avatar_url || u.foto || u.fotoUrl || u.foto_url || u.imageUrl || null;
  // usa token retornado (se presente) como fallback Bearer quando cookie cross-site for bloqueado
  const token = res.data?.token || null;
  login(token, u.tipo, u.nome, u.autorizado, avatarUrlFromApi, u.apelido);
      if (res.data.usuario.tipo === 'admin') {
        if (!res.data.usuario.autorizado) {
          navigate('/', { state: { erro: 'Seu cadastro foi feito como administrador, mas ainda não está liberado! Solicite a liberação do acesso ao painel admin para outro administrador.' } });
        } else {
          navigate('/admin');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao logar');
      console.warn('[Login] falha no login:', err?.response?.status, err?.response?.data || err?.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={handleBack} className="back-button" style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>← Voltar</button>
          <h2 style={{ marginLeft: 8 }}>Login</h2>
          <span style={{ width: 74 }} />
        </div>
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="auth-input"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              className="auth-input"
              autoComplete="current-password"
            />
          </div>
          {erro && <div className="error-message">{erro}</div>}
          <button
            type="submit"
            className="auth-button"
            onClick={(e) => {
              // Safety net: garante que o handler dispare mesmo se o submit default for prevenido por algo externo
              if (e && typeof e.preventDefault === 'function') e.preventDefault();
              handleLogin(e);
            }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <div className="auth-footer">
          <p>Não tem conta? <Link to="/register">Cadastre-se</Link></p>
        </div>
      </div>
    </div>
  );
}

export default Login;
