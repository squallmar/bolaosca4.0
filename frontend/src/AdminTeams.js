import React, { useEffect, useMemo, useState } from 'react';
import api from './services/api';
import { useNavigate } from 'react-router-dom'; // +
import AdminSubMenu from './AdminSubMenu';

// Base via proxy (/api) já definida em services/api

export default function AdminTeams() {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState(null); // {id, nome, escudo_url}
  const [novo, setNovo] = useState({ nome: '', escudo_url: '', escudo_file: null, escudo_preview: '', escudo_nome: '' });
  const [uploadingNovo, setUploadingNovo] = useState(false);
  const [uploadingEdit, setUploadingEdit] = useState(false);
  const navigate = useNavigate(); // +

  useEffect(() => { /* cookie auth */ }, []);

  const params = useMemo(() => ({
    q: q.trim() || undefined,
    ativo: 'true',
    page,
    pageSize
  }), [q, page, pageSize]);

  async function load() {
    setLoading(true); setErr('');
    try {
  const { data } = await api.get(`/times`, { params });
      setList(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setErr('Erro ao carregar times');
      setList([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [params]);
  useEffect(() => { setPage(1); }, [q]);

  async function salvarNovo(e) {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('nome', novo.nome);
      if (novo.escudo_file) fd.append('file', novo.escudo_file);
  await api.post(`/times`, fd); // deixar axios definir boundary corretamente
      setNovo({ nome: '', escudo_url: '', escudo_file: null });
      load();
    } catch {
      setErr('Erro ao criar time');
    }
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    try {
  await api.put(`/times/${edit.id}`, { nome: edit.nome, escudo_url: edit.escudo_url });
      setEdit(null);
      load();
    } catch (error) {
      const msg = error?.response?.data?.erro || 'Erro ao salvar edição';
      setErr(msg);
    }
  }

  async function excluir(t) {
    if (!window.confirm(`Excluir (desativar) o time "${t.nome}"?`)) return;
    try {
  await api.delete(`/times/${t.id}`);
      load();
    } catch {
      setErr('Erro ao excluir time');
    }
  }

  async function onEscudoNovoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setNovo(v => ({ ...v, escudo_file: file, escudo_preview: preview, escudo_nome: file.name }));
  }

  async function onEscudoEditChange(e) {
    const file = e.target.files?.[0];
    if (!file || !edit?.id) return;
    setUploadingEdit(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
  const { data } = await api.post(`/upload/escudo`, fd); // sem header manual
      setEdit(v => ({ ...v, escudo_url: data.url }));
    } catch {
      setErr('Erro ao enviar escudo');
    } finally {
      setUploadingEdit(false);
    }
  }

  return (
    <>
      <AdminSubMenu />
      <div style={container}>
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={btn} onClick={() => navigate('/bolao')} title="Voltar à página principal">← Voltar</button>
          <h2 style={{ margin: 0 }}>Times</h2>
        </div>
        <button className="reload" style={{ ...btn, background: '#f7f7f7' }} onClick={() => load()}>🔄 Recarregar</button>
      </div>

      <div style={card}>
        <form
          onSubmit={salvarNovo}
          style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}
        >
          <input
            placeholder="Nome do time"
            value={novo.nome}
            onChange={e=>setNovo(v=>({ ...v, nome: e.target.value }))}
            style={input}
            required
          />
          <label style={{ ...btn, cursor: 'pointer' }}>
            Enviar Escudo
            <input type="file" accept="image/*" onChange={onEscudoNovoChange} style={{ display: 'none' }} />
          </label>
          <button type="submit" style={{ ...btn, ...btnPrimary }} disabled={uploadingNovo}>
            {uploadingNovo ? 'Enviando...' : 'Adicionar'}
          </button>
        </form>
        {novo.escudo_preview && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={novo.escudo_preview} alt="Prévia escudo" style={escudo} />
            <span style={{ color: '#555' }}>Prévia do Escudo</span>
            {novo.escudo_nome && <span style={{ color: '#888', fontSize: 13 }}>Arquivo: {novo.escudo_nome}</span>}
          </div>
        )}
      </div>

      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Buscar time..." value={q} onChange={e=>setQ(e.target.value)} style={{ ...input, flex: 1, minWidth: 220 }} />
        <span style={{ color: '#555' }}>Página {page} • {list.length} de {total}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={btn}>Anterior</button>
          <button disabled={(page*pageSize)>=total} onClick={()=>setPage(p=>p+1)} style={btn}>Próxima</button>
        </div>
      </div>

      {loading && <div style={info}>Carregando...</div>}
      {err && <div style={{ ...info, background: '#ffeaea', color: '#b71c1c' }}>{err}</div>}

  <div style={grid}>
        {list.map(t => (
          <div key={t.id} style={teamCard}>
            <img
              src={(t.escudo_url && t.escudo_url.trim())
                ? t.escudo_url
                : `${process.env.REACT_APP_API_URL}/uploads/escudos/_default.png`}
              alt={t.nome}
              width={56} height={56}
              style={escudo}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = `${process.env.REACT_APP_API_URL}/uploads/escudos/_default.png`;
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {edit?.id === t.id ? (
                <form onSubmit={salvarEdicao} style={{ display: 'grid', gap: 6 }}>
                  <input
                    value={edit.nome}
                    onChange={e=>setEdit(v=>({ ...v, nome: e.target.value }))}
                    style={input}
                    required
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ ...btn, cursor: 'pointer' }}>
                      Enviar Escudo
                      <input type="file" accept="image/*" onChange={onEscudoEditChange} style={{ display: 'none' }} />
                    </label>
                    {edit.escudo_url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={edit.escudo_url} alt="Prévia escudo" style={escudo} />
                        <span style={{ color: '#555' }}>{uploadingEdit ? 'Enviando...' : 'Prévia do escudo'}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="submit" style={{ ...btn, ...btnSuccess }} disabled={uploadingEdit}>Salvar</button>
                    <button type="button" onClick={()=>setEdit(null)} style={btn}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.nome}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button onClick={()=>setEdit({ id: t.id, nome: t.nome, escudo_url: t.escudo_url || '' })} style={{ ...btn, ...btnPrimary }}>Editar</button>
                    <button onClick={()=>excluir(t)} style={{ ...btn, ...btnDanger }}>Excluir</button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </>
  );
}

// Estilos
const container = { maxWidth: 1000, margin: '32px auto', background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,.08)' };
const header = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 };
const card = { background: '#fafbfc', border: '1px solid #e9ecef', borderRadius: 12, padding: 12, marginBottom: 12 };
const input = { padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', outline: 'none' };
const btn = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', color: '#2c3e50', fontWeight: 600, cursor: 'pointer' };
const btnPrimary = { background: '#1976d2', color: '#fff', borderColor: '#1976d2' };
const btnDanger = { background: '#d32f2f', color: '#fff', borderColor: '#d32f2f' };
const btnSuccess = { background: '#2e7d32', color: '#fff', borderColor: '#2e7d32' };
const info = { padding: 12, borderRadius: 8, background: '#f3f7ff', color: '#0b4ea2', marginBottom: 12 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 12 };
const teamCard = { border: '1px solid #e9ecef', borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center', background: '#fff' };
const escudo = {
  width: 60,
  height: 60,
  borderRadius: 8,          // sem círculo
  objectFit: 'contain',
  padding: 6,
  background: '#fff',
  border: '2px solid #eef2f7',
};  