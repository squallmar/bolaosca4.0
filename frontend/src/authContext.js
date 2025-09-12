import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAuthToken } from './services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null); // mantido para compat forward (não usado em requests)
  const [tipo, setTipo] = useState(null);
  const [nome, setNome] = useState(null);
  const [autorizado, setAutorizado] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [apelido, setApelido] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pré-busca CSRF para reduzir risco de primeira falha 403
    (async () => {
      try {
        const API_BASE = process.env.REACT_APP_API_URL || '';
        await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
      } catch {}
    })();
    (async () => {
      try {
        const { data } = await api.get('/auth/me');
        setTipo(data.tipo);
        setNome(data.nome);
        setAutorizado(!!data.autorizado);
        setAvatarUrl(data.avatarUrl || null);
        setApelido(data.apelido || '');
      } catch {
        // não logado
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Refresh periódico da sessão (a cada 60 min) + quando a aba volta ao foco
  useEffect(() => {
    let intervalId;
    async function doRefresh() {
      try {
        await api.post('/auth/refresh');
      } catch { /* silencioso */ }
    }
    // inicia apenas após carregamento inicial
    if (!loading) {
      // um refresh inicial leve (caso usuário permaneça logado por longos períodos)
      doRefresh();
      intervalId = setInterval(doRefresh, 1000 * 60 * 60); // 60 min
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') doRefresh();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loading]);

  // login(token, tipo, nome, autorizado, avatarUrl?) -> avatarUrl é opcional para compatibilidade
  const login = (tokenValue, tipoVal, nomeVal, autorizadoVal, avatarUrlOptional, apelidoOptional) => {
    // tokenValue ignorado para storage inseguro; já está em cookie httpOnly
    setToken(tokenValue || null);
  // fallback: também usa Authorization Bearer se fornecido (caso cookie seja bloqueado)
  setAuthToken(tokenValue || null);
    setTipo(tipoVal);
    setNome(nomeVal);
    setAutorizado(!!autorizadoVal);
    if (typeof avatarUrlOptional !== 'undefined') setAvatarUrl(avatarUrlOptional || null);
    if (typeof apelidoOptional !== 'undefined') setApelido(apelidoOptional || '');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignora erro – sessão pode já estar inválida
    }
    setToken(null);
  setAuthToken(null);
    setTipo(null);
    setNome(null);
    setAutorizado(false);
    setAvatarUrl(null);
    setApelido('');
    try { localStorage.removeItem('avatarUrl'); } catch {}
  };

  return (
    <AuthContext.Provider value={{ token, tipo, nome, apelido, autorizado, avatarUrl, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
