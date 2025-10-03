import React, { useEffect, useState } from 'react';
import axios from 'axios';
import api from './services/api';

function CampeonatoList() {
  const [campeonatos, setCampeonatos] = useState([]);
  const [nome, setNome] = useState('');
  const [bolaoId, setBolaoId] = useState('');
  const [msg, setMsg] = useState('');
  const [boloes, setBoloes] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [userTipo, setUserTipo] = useState(null); // TODO: integrar com contexto
  const [userAutorizado, setUserAutorizado] = useState(false);
  async function excluirCampeonato(id) {
    if (!window.confirm('Tem certeza que deseja excluir este campeonato?')) return;
    try {
  await api.delete(`/bolao/campeonato/${id}`);
      setMsg('Campeonato excluído!');
      fetchCampeonatos();
    } catch {
      setMsg('Erro ao excluir campeonato');
    }
  }

  async function finalizarCampeonato(id) {
    if (!window.confirm('Finalizar este campeonato? Esta ação não pode ser desfeita.')) return;
    try {
  await api.post(`/bolao/campeonato/${id}/finalizar`);
      setMsg('Campeonato finalizado!');
      fetchCampeonatos();
    } catch {
      setMsg('Erro ao finalizar campeonato');
    }
  }

  async function editarCampeonato(id) {
    if (!editNome.trim()) return setMsg('Digite o novo nome do campeonato');
    try {
  await api.put(`/bolao/campeonato/${id}`, { nome: editNome });
      setMsg('Campeonato editado!');
      setEditId(null);
      setEditNome('');
      fetchCampeonatos();
    } catch {
      setMsg('Erro ao editar campeonato');
    }
  }

  useEffect(() => {
    async function fetchBoloes() {
  const res = await api.get('/bolao/listar');
      setBoloes(res.data);
    }
    fetchBoloes();
  }, []);

  async function fetchCampeonatos() {
    try {
      if (!bolaoId) return setCampeonatos([]);
  const res = await api.get(`/bolao/${bolaoId}/campeonatos`);
      setCampeonatos(res.data);
    } catch {
      setMsg('Erro ao buscar campeonatos');
    }
  }

  async function criarCampeonato(e) {
    e.preventDefault();
    setMsg('');
    try {
  await api.post(`/bolao/${bolaoId}/campeonato`, { nome });
      setNome('');
      setMsg('Campeonato criado!');
      fetchCampeonatos();
    } catch {
      setMsg('Erro ao criar campeonato');
    }
  }

  useEffect(() => {
    fetchCampeonatos();
  }, [bolaoId]);

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, borderRadius: 12, boxShadow: '0 2px 8px #ccc', background: '#fff' }}>
      <h2 style={{ textAlign: 'center', color: '#1976d2' }}>Campeonatos</h2>
      <select value={bolaoId} onChange={e => setBolaoId(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}>
        <option value="">Selecione o bolão</option>
        {boloes.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
      </select>
      <form onSubmit={criarCampeonato} style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
        <input type="text" placeholder="Nome do campeonato" value={nome} onChange={e => setNome(e.target.value)} required style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
        <button type="submit" style={{ background: '#1976d2', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: 6, fontWeight: 'bold' }}>Criar Campeonato</button>
      </form>
      <ul style={{ paddingLeft: 0 }}>
        {campeonatos.map(c => (
          <li key={c.id} style={{ listStyle: 'none', padding: '8px 0', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {editId === c.id ? (
              <>
                <input value={editNome} onChange={e => setEditNome(e.target.value)} style={{ marginRight: 8, padding: 4, borderRadius: 4, border: '1px solid #ccc' }} />
                <button onClick={() => editarCampeonato(c.id)} style={{ marginRight: 8, background: '#43a047', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Salvar</button>
                <button onClick={() => { setEditId(null); setEditNome(''); }} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Cancelar</button>
              </>
            ) : (
              <>
                <span>{c.nome}</span>
                {userTipo === 'admin' && userAutorizado && (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditId(c.id); setEditNome(c.nome); }} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Editar</button>
                    <button onClick={() => excluirCampeonato(c.id)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Excluir</button>
                    <button onClick={() => finalizarCampeonato(c.id)} style={{ background: '#fbc02d', color: '#333', border: 'none', borderRadius: 4, padding: '4px 12px' }}>Finalizar</button>
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

export default CampeonatoList;
