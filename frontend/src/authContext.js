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
    // Só chama /auth/me se houver token salvo
    const hasToken = !!localStorage.getItem('token');
    if (hasToken) {
      (async () => {
        try {
          console.log('[AUTHCTX] Chamando /auth/me...');
          const { data } = await api.get('/auth/me');
          console.log('[AUTHCTX] /auth/me resposta:', data);
          setTipo(data.tipo);
          setNome(data.nome);
          setAutorizado(!!data.autorizado);
          setAvatarUrl(data.avatarUrl || null);
          setApelido(data.apelido || '');
        } catch (err) {
          console.warn('[AUTHCTX] /auth/me falhou:', err?.response?.status, err?.response?.data);
          // não logado
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, []);
  // Permite revalidar sessão manualmente após login
  const revalidateSession = async () => {
    setLoading(true);
    try {
      console.log('[AUTHCTX] Revalidando sessão via /auth/me...');
      const { data } = await api.get('/auth/me');
      setTipo(data.tipo);
      setNome(data.nome);
      setAutorizado(!!data.autorizado);
      setAvatarUrl(data.avatarUrl || null);
      setApelido(data.apelido || '');
      console.log('[AUTHCTX] Sessão revalidada:', data);
    } catch (err) {
      console.warn('[AUTHCTX] Revalidação falhou:', err?.response?.status, err?.response?.data);
    } finally {
      setLoading(false);
    }
  };

  // Refresh periódico da sessão (a cada 60 min) + quando a aba volta ao foco
  useEffect(() => {
    let intervalId;
    async function doRefresh() {
      try {
        console.log('[AUTHCTX] Chamando /auth/refresh...');
        await api.post('/auth/refresh');
        console.log('[AUTHCTX] /auth/refresh OK');
      } catch (err) {
        console.warn('[AUTHCTX] /auth/refresh falhou:', err?.response?.status, err?.response?.data);
      }
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
    // Após login, revalida sessão para garantir contexto atualizado
    revalidateSession();
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
