import React, { useEffect, useState } from 'react';
import api from './services/api';
import api from './services/api';

function RodadaList() {
  const [rodadas, setRodadas] = useState([]);
  const [nome, setNome] = useState('');
  const [campeonatoId, setCampeonatoId] = useState('');
  const [msg, setMsg] = useState('');
  const [campeonatos, setCampeonatos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [userTipo, setUserTipo] = useState(null); // TODO: substituir por contexto
  const [userAutorizado, setUserAutorizado] = useState(false);
  async function excluirRodada(id) {
    if (!window.confirm('Tem certeza que deseja excluir esta rodada?')) return;
    try {
  await api.delete(`/bolao/rodada/${id}`);
      setMsg('Rodada excluída!');
      fetchRodadas();
    } catch {
      setMsg('Erro ao excluir rodada');
    }
  }

  async function finalizarRodada(id) {
    if (!window.confirm('Finalizar esta rodada? Esta ação não pode ser desfeita.')) return;
    try {
  await api.post(`/bolao/rodada/${id}/finalizar`);
      setMsg('Rodada finalizada!');
      fetchRodadas();
    } catch {
      setMsg('Erro ao finalizar rodada');
    }
  }

  async function editarRodada(id) {
    if (!editNome.trim()) return setMsg('Digite o novo nome da rodada');
    try {
  await api.put(`/bolao/rodada/${id}`, { nome: editNome });
      setMsg('Rodada editada!');
      setEditId(null);
      setEditNome('');
      fetchRodadas();
    } catch {
      setMsg('Erro ao editar rodada');
    }
  }

  useEffect(() => {
    async function fetchCampeonatos() {
  const res = await api.get('/bolao/campeonatos-todos');
      setCampeonatos(res.data);
    }
    fetchCampeonatos();
  }, []);

  async function fetchRodadas() {
    try {
      if (!campeonatoId) return setRodadas([]);
  const res = await api.get(`/bolao/campeonato/${campeonatoId}/rodadas`);
      setRodadas(res.data);
    } catch {
      setMsg('Erro ao buscar rodadas');
    }
  }

  async function criarRodada(e) {
    e.preventDefault();
    setMsg('');
    try {
  await api.post(`/bolao/campeonato/${campeonatoId}/rodada`, { nome });
      setNome('');
      setMsg('Rodada criada!');
      fetchRodadas();
    } catch {
      setMsg('Erro ao criar rodada');
    }
  }

  useEffect(() => {
    fetchRodadas();
  }, [campeonatoId]);

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px #ccc', background: '#fff' }}>
      <h2 style={{ textAlign: 'center', color: '#43a047' }}>Rodadas</h2>
      <select value={campeonatoId} onChange={e => setCampeonatoId(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
        <option value="">Selecione o campeonato</option>
        {campeonatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <form onSubmit={criarRodada} style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
        <input type="text" placeholder="Nome da rodada" value={nome} onChange={e => setNome(e.target.value)} required style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
        <button type="submit" style={{ background: '#43a047', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Criar Rodada</button>
      </form>
      <ul style={{ paddingLeft: 0 }}>
        {rodadas.map(r => (
          <li key={r.id} style={{ listStyle: 'none', padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {editId === r.id ? (
              <>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} style={{ marginRight: 8, padding: 4, borderRadius: 4, border: '1px solid #ccc' }} />
                <button onClick={() => editarRodada(r.id)} style={{ marginRight: 8, background: '#43a047', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Salvar</button>
                <button onClick={() => { setEditId(null); setEditNome(''); }} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Cancelar</button>
              </>
            ) : (
              <>
                <span>{r.nome}</span>
                {userTipo === 'admin' && userAutorizado && (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditId(r.id); setEditNome(r.nome); }} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Editar</button>
                    <button onClick={() => excluirRodada(r.id)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Excluir</button>
                    <button onClick={() => finalizarRodada(r.id)} style={{ background: '#fbc02d', color: '#333', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Finalizar</button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {msg && <div style={{ color: 'green', marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

export default RodadaList;
