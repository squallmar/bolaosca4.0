import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './authContext';
import './Auth.css';

function IconMail(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3,7 12,13 21,7" />
    </svg>
  );
}
function IconLock(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    </svg>
  );
}
function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.78 20.78 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.78 20.78 0 0 1-3.22 4.21" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
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
            <div className="input-with-icon">
              <span className="icon-left"><IconMail /></span>
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
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <span className="icon-left"><IconLock /></span>
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                className="auth-input"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="icon-right-btn"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {erro && <div className="error-message">{erro}</div>}
          <button
            type="submit"
            className="auth-button"
            onClick={(e) => {
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
