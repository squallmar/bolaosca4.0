import React, { useEffect, useState, useMemo } from 'react';
import api from './services/api';
import { useAuth } from './authContext';
import './Profile.css';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from './config';

export default function Profile() {
  const { nome, avatarUrl, login } = useAuth() || {};
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(''); // success | error | ''
  const [loading, setLoading] = useState(false);
  // estado para editar dados
  const [nomeEdit, setNomeEdit] = useState('');
  const [apelidoEdit, setApelidoEdit] = useState('');
  const [emailEdit, setEmailEdit] = useState('');
  // estado para trocar senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  if (!nome) return <div className="profile-container">Faça login para acessar o perfil.</div>;

  const current = useMemo(() => (avatarUrl || ''), [avatarUrl]);

  const handleFile = (f) => {
    setMessage('');
    setStatus('');
    if (!f) {
      setFile(null);
      setPreview('');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setFile(null);
      setPreview('');
      setStatus('error');
      setMessage('Formato não suportado. Use JPG, PNG ou WEBP.');
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (f.size > maxBytes) {
      setFile(null);
      setPreview('');
      setStatus('error');
      setMessage('Arquivo muito grande (máx. 2 MB). Escolha outra imagem.');
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  // carregar dados atuais de perfil
  useEffect(() => {
    (async () => {
      try {
  const res = await api.get('/auth/me');
  const u = res.data || {};
  setNomeEdit(u.nome || nome || '');
  setApelidoEdit(typeof u.apelido !== 'undefined' ? (u.apelido || '') : '');
  setEmailEdit(u.email || '');
      } catch {}
    })();
  }, [nome]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('');
    if (!file) {
      setStatus('error');
      setMessage('Selecione uma imagem.');
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('avatar', file);
  const res = await api.post('/auth/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const newUrl = res.data?.avatarUrl;
      if (newUrl) {
  login(null, null, nome, true, newUrl);
        setStatus('success');
        setMessage('Foto atualizada! Pode levar alguns segundos para aparecer.');
        setFile(null);
        setPreview('');
      } else {
        setStatus('error');
        setMessage('Não foi possível obter a nova URL do avatar.');
      }
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.erro || 'Não foi possível enviar agora. Verifique sua conexão e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  const onRemove = async () => {
    setMessage('');
    setStatus('');
    const ok = window.confirm('Deseja remover sua foto e usar as iniciais?');
    if (!ok) return;
    try {
      setLoading(true);
  await api.delete('/auth/me/avatar');
  login(null, null, nome, true, null);
      setStatus('success');
      setMessage('Foto removida. Usaremos suas iniciais por enquanto.');
      setFile(null);
      setPreview('');
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.erro || 'Não foi possível remover a foto. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('');
    try {
      setLoading(true);
  const res = await api.put('/auth/me', { nome: nomeEdit, apelido: apelidoEdit, email: emailEdit });
      const u = res.data || {};
      // atualiza contexto
  login(null, null, u.nome || nomeEdit, true, u.avatarUrl);
      setStatus('success');
      setMessage('Perfil atualizado com sucesso.');
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.erro || 'Não foi possível atualizar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus('');
    if (!senhaAtual || !novaSenha || novaSenha.length < 4 || novaSenha.length > 8) {
      setStatus('error');
      setMessage('Preencha a senha atual e a nova senha (de 4 a 8 caracteres).');
      return;
    }
    try {
      setLoading(true);
  await api.patch('/auth/me/senha', { senhaAtual, novaSenha });
      setStatus('success');
      setMessage('Senha alterada com sucesso.');
      setSenhaAtual('');
      setNovaSenha('');
    } catch (e) {
      setStatus('error');
      setMessage(e.response?.data?.erro || 'Não foi possível alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  // Normaliza URL do avatar atual (Cloudinary, local, ou fallback)
  const normalizedCurrent = useMemo(() => {
    if (!current) return '';
    let u = String(current).trim();
    if (u.includes(';')) {
      const parts = u.split(';').map(s => s.trim()).filter(Boolean);
      u = parts[parts.length - 1];
    }
    // Cloudinary URL
    if (/res\.cloudinary\.com/.test(u) || (u.startsWith('http://') || u.startsWith('https://'))) return u;
    // Local uploads
    if (u.startsWith('/uploads/')) return `${API_BASE}${u}`;
    if (/^uploads\//i.test(u)) return `${API_BASE}/${u}`;
    // Fallback to default
    const file = u.split('/').pop();
    return file ? `${API_BASE}/uploads/avatars/${file}` : '';
  }, [current]);

  const displayAvatar = useMemo(() => {
    // If preview (new upload), use it
    if (preview) return preview;
    // If normalizedCurrent is a valid Cloudinary or http(s) URL, use it
    if (normalizedCurrent && (/res\.cloudinary\.com/.test(normalizedCurrent) || normalizedCurrent.startsWith('http'))) return normalizedCurrent;
    // If normalizedCurrent is a valid local path, use it
    if (normalizedCurrent) return normalizedCurrent;
    // Fallback
    return `${API_BASE}/uploads/avatars/avatar_default.jpg`;
  }, [preview, normalizedCurrent]);

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <button type="button" className="back-btn" onClick={() => navigate(-1)}>← Voltar</button>
          <div>
            <h2>Seu Perfil</h2>
            <p>Olá, {nome}!</p>
          </div>
        </div>
        <div className="profile-body">
          {/* Removido AnunciosTV do perfil para evitar sobreposição/TV na área do usuário */}
          <div className="profile-avatar">
            <img
              src={displayAvatar}
              alt="avatar"
              onError={(e)=>{
                e.currentTarget.onerror=null;
                e.currentTarget.src = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757738470/avatar_default_lwtnzu.jpg';
              }}
            />
          </div>
          {/* Editar dados */}
          <form className="profile-edit" onSubmit={onSaveProfile}>
            <div className="field">
              <label>Nome</label>
              <input type="text" value={nomeEdit} onChange={(e)=>setNomeEdit(e.target.value)} />
            </div>
            <div className="field">
              <label>Apelido</label>
              <input type="text" value={apelidoEdit} onChange={(e)=>setApelidoEdit(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={emailEdit} onChange={(e)=>setEmailEdit(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>Atualizar e Salvar Dados</button>
          </form>
          <form className="profile-actions" onSubmit={onSubmit}>
            <label className="file-input">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
              <span>Escolher imagem</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Enviando…' : 'Atualizar foto'}
            </button>
            <button type="button" className="btn btn-danger" onClick={onRemove} disabled={loading}>
              Remover foto
            </button>
            <div className="helper">Formatos: JPG, PNG, WEBP. Tamanho máximo: 2 MB.</div>
          </form>
          {/* Trocar senha */}
          <form className="profile-password" onSubmit={onChangePassword}>
            <div className="field">
              <label>Senha atual</label>
              <input type="password" value={senhaAtual} onChange={(e)=>setSenhaAtual(e.target.value)} />
            </div>
            <div className="field">
              <label>Nova senha</label>
              <input type="password" value={novaSenha} onChange={(e)=>setNovaSenha(e.target.value)} />
            </div>
            <button type="submit" className="btn" disabled={loading}>Alterar senha</button>
          </form>
          {message && (
            <div className={`alert ${status === 'success' ? 'alert-success' : 'alert-error'}`}>{message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
