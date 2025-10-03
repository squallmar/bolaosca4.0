import React, { useEffect, useState } from 'react';
// ...existing code...
import { useNavigate, useParams } from 'react-router-dom';
import api from './services/api';

import { API_BASE as API } from './config';

export default function AdminUserEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [u, setU] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenhaModal, setShowSenhaModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
  const { data } = await api.get(`/usuario/${id}`);
        setU(data);
      } catch {
        setErr('Erro ao carregar usuário');
      }
    })();
  }, [id]);

  async function salvar(e) {
    e.preventDefault();
    try {
      const { data } = await api.put(`/usuario/${id}`, u);
      setU(data);
      setErr('');
      setShowSuccessModal(true);
    } catch {
      setErr('Erro ao salvar');
    }
  }

  async function atualizarSenha(e) {
    e.preventDefault();
    if (!novaSenha || novaSenha.length < 6) return setErr('Senha deve ter ao menos 6 caracteres');
    if (novaSenha !== confirmarSenha) return setErr('As senhas não conferem');
    try {
      await api.patch(`/usuario/${id}/senha`, { senha: novaSenha });
      setNovaSenha('');
      setConfirmarSenha('');
      setErr('');
      setMsg('');            // opcional: não usar toast
      setShowSenhaModal(true);
    } catch {
      setErr('Erro ao atualizar senha');
    }
  }

  async function onFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
  const { data } = await api.post(`${API}/upload/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true });
      setU({ ...u, foto_url: data.url });
      setMsg('Foto enviada');
      setTimeout(() => setMsg(''), 1500);
    } catch {
      setErr('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  }

  if (!u) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
      <h2>Editar Usuário</h2>

      <form onSubmit={salvar} style={{ display: 'grid', gap: 12 }}>
        <label>Nome
          <input value={u.nome||''} onChange={e=>setU({ ...u, nome: e.target.value })} style={inp} />
        </label>

        <label>Apelido
          <input value={u.apelido||''} onChange={e=>setU({ ...u, apelido: e.target.value })} style={inp} />
        </label>

        <label>Email
          <input value={u.email||''} style={inp} disabled />
        </label>

        <label>Foto
      {u.foto_url ? (
            <div style={{ marginBottom: 8 }}>
        <img src={u.foto_url.startsWith('http') ? u.foto_url : `${API}/uploads/avatars/${u.foto_url.split('/').pop()}`} alt="foto do usuário" style={{ height: 72, borderRadius: 8 }} />
            </div>
          ) : null}
          <input type="file" accept="image/*" onChange={onFotoChange} style={inp} />
          {uploading && <div style={{ color: '#555', marginTop: 4 }}>Enviando...</div>}
        </label>

        <label>Tipo
          <select value={u.tipo||'user'} onChange={e=>setU({ ...u, tipo: e.target.value })} style={inp}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={!!u.autorizado} onChange={e=>setU({ ...u, autorizado: e.target.checked })} />
          Autorizado
        </label>
        <label>
          <input type="checkbox" checked={!!u.banido} onChange={e=>setU({ ...u, banido: e.target.checked })} />
          Banido
        </label>

        <div style={{ display: 'flex',gap: 8, marginTop: 8 }}>
          <button type="button" style={btn} onClick={()=>navigate(-1)}>Voltar</button>
          <button type="submit" style={{ ...btn, background: '#1976d2', color: '#fff', border: 'none' }}>Salvar</button>
        </div>
      </form>

      {/* Alterar senha */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee' }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>Alterar senha</h3>
        <form onSubmit={atualizarSenha} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          <label>Nova senha
            <input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} style={inp} />
          </label>
          <label>Confirmar senha
            <input type="password" value={confirmarSenha} onChange={e=>setConfirmarSenha(e.target.value)} style={inp} />
          </label>
          <div>
            <button type="submit" style={{ ...btn, background: '#2e7d32', color: '#fff', border: 'none' }}>Salvar senha</button>
          </div>
        </form>
      </div>

      {/* Toasts */}
      {msg && (
        <div style={toastOk} role="status" aria-live="polite" onClick={()=>setMsg('')}>
          {msg}
        </div>
      )}
      {err && (
        <div style={toastErr} role="alert" onClick={()=>setErr('')}>
          {err}
        </div>
      )}

      {/* Modal de sucesso ao salvar dados */}
      {showSuccessModal && (
        <div style={modalOverlay} onClick={()=>setShowSuccessModal(false)}>
          <div style={modalBox} role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Usuário atualizado</div>
            <div>Usuário atualizado com sucesso!</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                style={{ ...btn, background: '#1976d2', color: '#fff', border: 'none' }}
                onClick={() => { setShowSuccessModal(false); navigate('/admin/usuarios'); }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: senha atualizada com opções */}
      {showSenhaModal && (
        <div style={modalOverlay} onClick={()=>setShowSenhaModal(false)}>
          <div style={modalBox} role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Senha atualizada!</div>
            <div>Senha atualizada com sucesso. Deseja voltar à lista ou continuar atualizando?</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                style={{ ...btn, background: '#1976d2', color: '#fff', border: 'none' }}
                onClick={() => setShowSenhaModal(false)}
              >
                Atualizar +
              </button>
              <button
                style={{ ...btn, background: '#2e7d32', color: '#fff', border: 'none' }}
                onClick={() => { setShowSenhaModal(false); navigate('/admin/usuarios'); }}
              >
                Voltar lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6 };
const btn = { padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' };

// Toast styles (canto inferior direito)
const toastBase = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  padding: '10px 14px',
  borderRadius: 8,
  boxShadow: '0 6px 18px rgba(0,0,0,.25)',
  zIndex: 1000,
  cursor: 'pointer',
};
const toastOk = { ...toastBase, background: '#2e7d32', color: '#fff' };
const toastErr = { ...toastBase, background: '#d32f2f', color: '#fff' };

// Estilos do modal
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
};
const modalBox = {
  width: '100%', maxWidth: 420, background: '#fff', borderRadius: 10,
  padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,.25)'
};