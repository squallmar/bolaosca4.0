import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import api from './services/api';
import { useNavigate, Link } from 'react-router-dom';
import AdminSubMenu from './AdminSubMenu';
import './AdminSubMenu.css';

import { API_BASE as API } from './config';

function UserAvatar({ user, size = 56 }) {
  const pick = (x) => (x && String(x).trim()) || '';
  const raw = pick(user.foto_url) || pick(user.fotoUrl) || pick(user.avatar_url) || pick(user.avatarUrl);
  const initials = (user.nome || 'U').charAt(0).toUpperCase();
  const style = { width: size, height: size, borderRadius: '50%', objectFit: 'cover' };

  if (!raw) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.43 }}>
        {initials}
      </div>
    );
  }

  const strip = (s) => s.split('?')[0].split('#')[0];
  const noQS = strip(raw);
  const file = noQS.split('/').pop();
  const candidates = [];
  if (/^https?:\/\//i.test(noQS)) candidates.push(noQS);
  if (noQS.startsWith('/uploads/')) candidates.push(`${API}${noQS}`);
  if (/^uploads\//i.test(noQS)) candidates.push(`${API}/${noQS}`);
  if (file) candidates.push(`${API}/uploads/avatars/${file}`);
  // fallback final: tenta usar o valor cru com base
  candidates.push(`${API}/uploads/avatars/${noQS}`);
  // último fallback garantido
  candidates.push(`${API}/uploads/avatars/avatar_default.jpg`);

  const [idx, setIdx] = React.useState(0);
  if (idx >= candidates.length) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: size * 0.43 }}>
        {initials}
      </div>
    );
  }
  const src = candidates[idx];
  return (
    <img
      src={src}
      alt={user.nome}
      width={size}
      height={size}
      style={style}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todos'); // todos|pendentes|autorizados|admins|banidos
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [total, setTotal] = useState(0);

  // Cookies httpOnly já enviados automaticamente; nenhuma configuração de token necessária

  const params = useMemo(() => {
    const p = {};
    if (tab === 'pendentes') p.pendentes = 'true';
    if (tab === 'autorizados') p.autorizados = 'true';
    if (tab === 'admins') p.administradores = 'true';
    if (tab === 'banidos') p.banidos = 'true';
    if (q.trim()) p.q = q.trim();
    p.page = page;
    p.pageSize = pageSize;
    return p;
  }, [tab, q, page, pageSize]);

  async function load() {
    setLoading(true); setErr('');
    try {
  const { data } = await api.get('/usuario', { params });
      if (Array.isArray(data)) {
        setList(data);
        setTotal(data.length);
      } else {
        setList(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) setErr('Sessão expirada. Faça login novamente.');
      else if (status === 403) setErr(e?.response?.data?.erro || 'Acesso negado (apenas admin).');
      else setErr('Erro ao carregar usuários');
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(1); }, [tab, q]); // reset ao trocar filtro/busca
  useEffect(() => { load(); }, [params]);
  useEffect(() => { const id = setTimeout(load, 300); return () => clearTimeout(id); }, [q]);

  async function banir(u, banir) {
    try {
  const { data } = await api.post(`/usuario/${u.id}/banir`, { banir });
      setList(list.map(x => x.id === u.id ? data : x));
    } catch (e) {
      setErr('Erro ao banir/desbanir');
    }
  }

  // NOVO: marcar desistência
  async function desistir(u, desistiu) {
    try {
  const { data } = await api.post(`/usuario/${u.id}/desistir`, { desistiu });
      setList(list.map(x => x.id === u.id ? data : x));
    } catch (e) {
      setErr('Erro ao marcar desistência');
    }
  }

  async function excluir(u) {
    try {
  await api.delete(`/usuario/${u.id}`);
      setList(list.filter(x => x.id !== u.id));
      setConfirm(null);
    } catch (e) {
      setErr('Erro ao excluir');
    }
  }

  // Alternar autorização do usuário
  async function toggleAutorizado(u) {
    try {
  const { data } = await api.put(`/usuario/${u.id}`, { autorizado: !u.autorizado });
      setList(list.map(x => x.id === u.id ? data : x));
    } catch (e) {
      setErr('Erro ao alterar autorização');
    }
  }

  // Alternar papel admin <-> usuário comum
  async function toggleAdmin(u) {
    try {
  const novoTipo = (u.tipo === 'admin') ? 'user' : 'admin';
  const { data } = await api.put(`/usuario/${u.id}`, { tipo: novoTipo });
      setList(list.map(x => x.id === u.id ? data : x));
    } catch (e) {
      setErr('Erro ao alterar papel de admin');
    }
  }

  return (
    <>
      <AdminSubMenu />
      <div style={{ maxWidth: 1100, margin: '32px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button
            onClick={() => navigate('/admin')}
            style={{ ...btn, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Voltar à página principal"
          >
            ← Voltar
          </button>
          <h2 style={{ margin: 0 }}>Lista de Usuários</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {['todos','pendentes','autorizados','admins','banidos'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab===t?'#1976d2':'#fff', color: tab===t?'#fff':'#333' }}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
            <input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)}
                   style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', minWidth: 220 }} />
          </div>
        </div>

        {/* NOVO: paginação */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 12px' }}>
          <span style={{ color: '#555' }}>
            Página {page} • {list.length} de {total}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={btn}>Anterior</button>
            <button disabled={(page*pageSize)>=total} onClick={()=>setPage(p=>p+1)} style={btn}>Próxima</button>
          </div>
        </div>

        {loading && <div style={{ color: '#1976d2', fontWeight: 'bold', marginBottom: 8 }}>Carregando...</div>}
        {err && <div style={{ color: '#d32f2f', fontWeight: 'bold', marginBottom: 8 }}>{err}</div>}
        {!loading && !err && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            {list.map(u => (
              <div
                key={u.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,.06)',
                  width: '100%'
                }}
              >
        <UserAvatar user={u} size={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {u.nome}
                    {u.apelido && (
                      <span style={{ marginLeft: 8, color: '#9e9e9e', fontWeight: 500 }}>({u.apelido})</span>
                    )}
                  </div>
                  <div style={{ color: '#555', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* Badge de papel (cores vivas) */}
                    <span
                      style={
                        u.tipo === 'admin'
                          ? { fontSize: 12, borderRadius: 999, padding: '3px 10px', background: '#7c4dff', color: '#fff' }
                          : { fontSize: 12, borderRadius: 999, padding: '3px 10px', background: '#2196f3', color: '#fff' }
                      }
                    >
                      {u.tipo === 'admin' ? 'Admin' : 'Usuário'}
                    </span>
                    {/* Badge de autorização (cores vivas) */}
                    {u.autorizado ? (
                      <span style={{ fontSize: 12, borderRadius: 999, padding: '3px 10px', background: '#00c853', color: '#fff' }}>
                        Autorizado
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, borderRadius: 999, padding: '3px 10px', background: '#ff9100', color: '#fff' }}>
                        Pendente
                      </span>
                    )}
                    {u.banido && (
                      <span style={{ fontSize: 12, borderRadius: 999, padding: '3px 10px', background: '#ff1744', color: '#fff' }}>
                        Banido
                      </span>
                    )}
                    {u.desistiu && (
                      <span style={{ fontSize: 12, borderRadius: 999, padding: '3px 10px', background: '#ec407a', color: '#fff' }}>
                        Desistiu
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={()=>navigate(`/admin/usuarios/${u.id}/editar`)} style={btn}>Editar</button>
                  <button onClick={()=>toggleAdmin(u)} style={{ ...btn, background: u.tipo === 'admin' ? '#9e9e9e' : '#7c4dff', color: '#fff' }}>
                    {u.tipo === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                  </button>
                  <button onClick={()=>toggleAutorizado(u)} style={{ ...btn, background: u.autorizado ? '#ff6d00' : '#00c853', color: '#fff' }}>
                    {u.autorizado ? 'Revogar' : 'Autorizar'}
                  </button>
                  <button onClick={()=>banir(u, !u.banido)} style={{ ...btn, background: '#ffab00', color: '#fff' }}>{u.banido?'Desbanir':'Banir'}</button>
                  {/* NOVO: botão desistir/reativar */}
                  <button onClick={()=>desistir(u, !u.desistiu)} style={{ ...btn, background: u.desistiu ? '#00bfa5' : '#ff7043', color: '#fff' }}>
                    {u.desistiu ? 'Ativar' : 'Desistiu'}
                  </button>
                  <button onClick={()=>setConfirm(u)} style={{ ...btn, background: '#d50000', color: '#fff' }}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {list.length === 0 && !loading && <div style={{ color: '#777', marginTop: 12 }}>Nenhum usuário encontrado.</div>}

        {confirm && (
          <div onClick={()=>setConfirm(null)} style={overlay}>
            <div onClick={e=>e.stopPropagation()} style={modal}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Confirmar exclusão</div>
              <div style={{ marginBottom: 12 }}>Deseja realmente excluir o usuário “{confirm.nome}”?</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={()=>setConfirm(null)} style={btn}>Cancelar</button>
                <button onClick={()=>excluir(confirm)} style={{ ...btn, background: '#d32f2f', color: '#fff' }}>Excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const btn = { padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 10, padding: 16, minWidth: 320, boxShadow: '0 8px 28px rgba(0,0,0,.2)' };