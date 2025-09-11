import React, { useEffect, useState, useCallback } from 'react';
import ApostaTimer from './ApostaTimer';
import axios from 'axios';
import api from './services/api';
import { useAuth } from './authContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from './config';

// Token não mais usado diretamente (cookie httpOnly)
const getToken = () => null;

// Helper GET com fallback entre múltiplos caminhos (agora injeta Authorization) - mantido igual
async function tryGet(urls, config = {}) {
  let lastErr;
  const merged = { ...config }; // sem Authorization manual

  for (const url of urls) {
    try {
      const res = await axios.get(url, merged);
      return { data: res.data, urlOk: url };
    } catch (err) {
      lastErr = err;
      console.warn('GET falhou:', url, err?.response?.status || err?.message);
    }
  }
  throw lastErr;
}

// Fallbacks para listas globais (agora com token) - mantido igual
async function getCampeonatosTodos() {
  const { data } = await tryGet(
    [`${API_BASE}/bolao/campeonatos-todos`, `${API_BASE}/campeonatos-todos`],
    {}
  );
  const list = Array.isArray(data) ? data : (data?.campeonatos || data || []);
  // normaliza: id, nome, finalizado, bolaoId
  return list
    .map((c) => ({
      id: c.id ?? c.campeonato_id ?? c.campeonatoId,
      nome: c.nome ?? c.titulo ?? `Campeonato ${c.id ?? ''}`,
      finalizado: (c.finalizado ?? c.finalizada) || false,
      bolaoId: c.bolao_id ?? c.bolaoId ?? c.bolao ?? c.bolaoID ?? null,
    }))
    .filter((c) => c.id);
}

async function getRodadasTodas() {
  const { data } = await tryGet(
    [`${API_BASE}/bolao/rodadas-todas`, `${API_BASE}/rodadas-todas`],
    {}
  );
  const list = Array.isArray(data) ? data : (data?.rodadas || data || []);
  // normaliza: id, nome, finalizada, campeonatoId
  return list
    .map((r) => ({
      id: r.id ?? r.rodada_id ?? r.rodadaId,
      nome: r.nome ?? `Rodada ${r.id ?? ''}`,
      finalizada: (r.finalizada ?? r.finalizado) || false,
      campeonatoId: r.campeonato_id ?? r.campeonatoId ?? r.campeonato ?? null,
    }))
    .filter((r) => r.id);
}

async function getPartidasPorRodada(rodadaId) {
  const { data } = await tryGet(
    [`${API_BASE}/bolao/rodada/${rodadaId}/partidas`, `${API_BASE}/rodada/${rodadaId}/partidas`],
    {}
  );
  const list = Array.isArray(data) ? data : (data?.partidas || data || []);
  // normaliza: finalizada (aceita finalizado), nomes dos times
  return list.map((p) => ({
    ...p,
    finalizada: (p.finalizada ?? p.finalizado) || false,
    time1: p.time1 ?? p.time1_nome ?? p.time1Name ?? p.t1 ?? 'Time 1',
    time2: p.time2 ?? p.time2_nome ?? p.time2Name ?? p.t2 ?? 'Time 2',
  }));
}

function BolaoList() {
  const { tipo, autorizado } = useAuth();
  const [boloes, setBoloes] = useState([]);
  const [nome, setNome] = useState('');
  const [msg, setMsg] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [campeonatos, setCampeonatos] = useState([]);
  const [rodadas, setRodadas] = useState([]);
  const [novoCampeonato, setNovoCampeonato] = useState({ bolaoId: '', nome: '' });
  const [novaRodada, setNovaRodada] = useState({ campeonatoId: '', nome: '' });
  const [novaPartida, setNovaPartida] = useState({ rodadaId: '', time1: '', time2: '' });
  const [modalMsg, setModalMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [bolaoCampeonatos, setBolaoCampeonatos] = useState({});
  const [campeonatoRodadas, setCampeonatoRodadas] = useState({});
  const [rodadaPartidas, setRodadaPartidas] = useState({});

  // NOVO: filtro/expansão de rodadas
  const [selectedRodadaId, setSelectedRodadaId] = useState('');
  const [expandedCamps, setExpandedCamps] = useState({});
  const toggleCampExpand = (campId) =>
    setExpandedCamps(prev => ({ ...prev, [campId]: !prev[campId] }));

  const navigate = useNavigate();
  const [times, setTimes] = useState([]);

  // Garanta Authorization em todas as chamadas axios - mantido igual
  useEffect(() => { /* Authorization via cookie */ }, []);

  // Utilitário: atualiza listas globais de campeonatos e rodadas
  const refreshLists = useCallback(async () => {
    try {
      const [camps, rods] = await Promise.all([getCampeonatosTodos(), getRodadasTodas()]);
      setCampeonatos(camps);
      setRodadas(rods);
    } catch (e) {
      console.warn('Falha ao atualizar listas globais', e?.response?.status || e?.message);
    }
  }, []);

  // Ações de campeonato - mantido igual
  async function excluirCampeonato(id) {
    if (!window.confirm('Tem certeza que deseja excluir este campeonato?')) return;
    try {
  await api.delete(`/bolao/campeonato/${id}`);
  setMsg('Campeonato excluído!');
  await refreshLists();
  fetchAllGrouped();
    } catch {
      setMsg('Erro ao excluir campeonato');
    }
  }

  async function finalizarCampeonato(id) {
    if (!window.confirm('Finalizar este campeonato? Esta ação não pode ser desfeita.')) return;
    try {
  await api.post(`/bolao/campeonato/${id}/finalizar`);
  setMsg('Campeonato finalizado!');
  await refreshLists();
  fetchAllGrouped();
    } catch {
      setMsg('Erro ao finalizar campeonato');
    }
  }

  async function editarCampeonato(id, nomeNovo) {
    if (!nomeNovo || !String(nomeNovo).trim()) return setMsg('Digite o novo nome do campeonato');
    try {
  await api.put(`/bolao/campeonato/${id}`, { nome: nomeNovo });
  setMsg('Campeonato editado!');
  await refreshLists();
  fetchAllGrouped();
    } catch {
      setMsg('Erro ao editar campeonato');
    }
  }

  // Ações de rodada - mantido igual
  async function excluirRodada(id) {
    if (!window.confirm('Tem certeza que deseja excluir esta rodada?')) return;
    try {
  await api.delete(`/bolao/rodada/${id}`);
  setMsg('Rodada excluída!');
  await refreshLists();
  fetchAllGrouped();
    } catch {
      setMsg('Erro ao excluir rodada');
    }
  }

  async function finalizarRodada(id) {
    if (!window.confirm('Finalizar esta rodada? Esta ação não pode ser desfeita.')) return;
    try {
  await api.post(`/bolao/rodada/${id}/finalizar`);
  setMsg('Rodada finalizada!');
  await refreshLists();
  fetchAllGrouped();
    } catch {
      setMsg('Erro ao finalizar rodada');
    }
  }

  async function editarRodada(id, nomeNovo) {
    if (!nomeNovo || !String(nomeNovo).trim()) return setMsg('Digite o novo nome da rodada');
    try {
  await api.put(`/bolao/rodada/${id}`, { nome: nomeNovo });
  setMsg('Rodada editada!');
  await refreshLists();
  fetchAllGrouped();
    } catch {
      setMsg('Erro ao editar rodada');
    }
  }

  // Ações de partida - mantido igual
  async function excluirPartida(id) {
    if (!window.confirm('Tem certeza que deseja excluir esta partida?')) return;
    try {
  await api.delete(`/bolao/partida/${id}`);
      setMsg('Partida excluída!');
      fetchAllGrouped();
    } catch {
      setMsg('Erro ao excluir partida');
    }
  }

  async function finalizarPartida(id) {
    if (!window.confirm('Finalizar esta partida? Esta ação não pode ser desfeita.')) return;
    try {
  await api.post(`/bolao/partida/${id}/finalizar`);
      setMsg('Partida finalizada!');
      fetchAllGrouped();
    } catch {
      setMsg('Erro ao finalizar partida');
    }
  }

  async function editarPartida(id, time1Novo, time2Novo) {
    if (!time1Novo || !String(time1Novo).trim() || !time2Novo || !String(time2Novo).trim()) {
      return setMsg('Preencha os dois times');
    }
    try {
  await api.put(`/bolao/partida/${id}`, { time1: time1Novo, time2: time2Novo });
      setMsg('Partida editada!');
      fetchAllGrouped();
    } catch {
      setMsg('Erro ao editar partida');
    }
  }

  // Buscar entidades agrupadas corretamente (itera sobre bolões->campeonatos->rodadas->partidas) - mantido igual
  const fetchAllGrouped = useCallback(async () => {
    if (!boloes || boloes.length === 0) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const [allCamps, allRods] = await Promise.all([getCampeonatosTodos(), getRodadasTodas()]);

      // Index: campeonatos por bolão
      const bolaoCamp = {};
      for (const b of boloes) {
        bolaoCamp[b.id] = allCamps.filter(c => String(c.bolaoId) === String(b.id));
      }

      // Index: rodadas por campeonato
      const campRod = {};
      for (const c of allCamps) {
        campRod[c.id] = allRods.filter(r => String(r.campeonatoId) === String(c.id));
      }

      // Partidas por rodada
      const rodPart = {};
      for (const r of allRods) {
        try {
          rodPart[r.id] = await getPartidasPorRodada(r.id);
        } catch {
          rodPart[r.id] = [];
        }
      }

      setBolaoCampeonatos(bolaoCamp);
      setCampeonatoRodadas(campRod);
      setRodadaPartidas(rodPart);
    } catch (err) {
      const status = err?.response?.status ? ` ${err.response.status}` : '';
      setErrorMsg(`Erro ao carregar dados${status}. Verifique o backend.`);
    } finally {
      setLoading(false);
    }
  }, [boloes]);

  async function excluirBolao(id) {
    if (!window.confirm('Tem certeza que deseja excluir este bolão?')) return;
    try {
  await api.delete(`/bolao/${id}`);
      setMsg('Bolão excluído!');
      fetchBoloes();
    } catch {
      setMsg('Erro ao excluir bolão');
    }
  }

  async function finalizarBolao(id) {
    if (!window.confirm('Finalizar este bolão? Esta ação não pode ser desfeita.')) return;
    try {
  await api.post(`/bolao/${id}/finalizar`);
      setMsg('Bolão finalizado!');
      fetchBoloes();
    } catch {
      setMsg('Erro ao finalizar bolão');
    }
  }

  async function editarBolao(id) {
    if (!editNome.trim()) return setMsg('Digite o novo nome do bolão');
    try {
  await api.put(`/bolao/${id}`, { nome: editNome });
      setMsg('Bolão editado!');
      setEditId(null);
      setEditNome('');
      fetchBoloes();
    } catch {
      setMsg('Erro ao editar bolão');
    }
  }

  // Criar bolão (evita crash e tenta duas rotas comuns) - mantido igual
  async function criarBolao(e) {
    // Prevenir comportamento padrão do formulário
    if (e) e.preventDefault();
    
    console.log('Iniciando criação de bolão...');
    try {
      if (!nome?.trim()) {
        setMsg('Informe o nome do bolão');
        return;
      }
      setLoading(true);
      const body = { nome: nome.trim() };
      try {
        await api.post(`/bolao/criar`, body);
      } catch (e) {
        if (e?.response?.status === 404) {
          // fallback para outra convenção de rota
          await api.post(`/bolao`, body);
        } else {
          throw e;
        }
      }
      
      // Limpa o campo imediatamente
      setNome('');
      setLoading(false);
      
      // Exibe a mensagem com visual chamativo
      console.log('Exibindo modal de sucesso...');
      setModalMsg('Bolão criado com sucesso!');
      
      // Tempo reduzido para 3 segundos conforme solicitado
      setTimeout(() => {
        console.log('Limpando modal e recarregando bolões...');
        setModalMsg('');
        fetchBoloes();
      }, 2500);
    } catch (e) {
      setModalMsg('Erro ao criar bolão');
      setTimeout(() => setModalMsg(''), 2500);
      console.error('Erro ao criar bolão:', e);
      setLoading(false);
    }
  }

  // Buscar bolões usando tryGet (com token automático) - mantido igual
  async function fetchBoloes() {
    try {
      const { data } = await tryGet([`${API_BASE}/bolao/listar`, `${API_BASE}/listar`], {});
      setBoloes(Array.isArray(data) ? data : (data?.boloes || data || []));
  // ...não limpa msg, só modalMsg será usado para sucesso
    } catch (e) {
      setMsg('Erro ao buscar bolões');
      setBoloes([]);
    }
  }

  useEffect(() => {
    fetchBoloes();

    async function fetchListas() {
      try {
        const [camps, rods] = await Promise.all([getCampeonatosTodos(), getRodadasTodas()]);
        setCampeonatos(camps);
        setRodadas(rods);
      } catch (e) {
        console.error('Erro ao buscar listas globais:', e);
      }
    }
    fetchListas();
  }, []);

  // Sempre que boloes mudar, buscar entidades agrupadas - mantido igual
  useEffect(() => {
    if (boloes.length > 0) {
      fetchAllGrouped();
    }
  }, [boloes, fetchAllGrouped]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/times`, {
          params: { ativo: 'true', page: 1, pageSize: 500 }
        });
        const items = data.items || [];
        setTimes(items);
      } catch (e) {
        console.warn('Falha ao carregar times', e?.response?.status || e.message);
        setTimes([]);
      }
    })();
  }, []);

  return (
    <div className="bolao-container">
      <h2 className="main-title">
        {tipo === 'admin' && autorizado ? 'Criar Bolões' : 'Bolões Ativos'}
      </h2>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Carregando dados...</span>
        </div>
      )}

      {tipo === 'admin' && autorizado && (
        <div className="admin-alert">
          <h3>Atenção administrador: siga a sequência de criação!</h3>
          <div className="creation-steps">
            <div className="step">
              <span className="step-number">1º</span>
              <span>Criar o Bolão</span>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <span className="step-number">2º</span>
              <span>Criar o Campeonato</span>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <span className="step-number">3º</span>
              <span>Criar a Rodada</span>
            </div>
            <div className="step-arrow">→</div>
            <div className="step">
              <span className="step-number">4º</span>
              <span>Criar a Partida</span>
            </div>
          </div>
        </div>
      )}

      {/* Grid de formulários de criação */}
      {tipo === 'admin' && autorizado && (
        <div className="creation-grid">
          <div className="creation-card bolao-card">
            <h3 className="card-title">1º Criar Bolão</h3>
            <form onSubmit={(e) => criarBolao(e)} className="creation-form">
              <input
                type="text"
                placeholder="Nome do bolão"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
                className="form-input"
              />
              <button
                type="submit"
                className="form-button bolao-button"
                title="Criar um novo bolão"
                style={{
                  background: 'linear-gradient(90deg, #fbc02d, #ffeb3b)',
                  color: '#333',
                  fontWeight: 700,
                  fontSize: 16,
                  border: '1px solid #fbc02d',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px'
                }}
              >
                <span role="img" aria-label="Bolão">🏆</span> Criar Bolão
              </button>
            </form>
          </div>

          <div className="creation-card campeonato-card">
            <h3 className="card-title">2º Criar Campeonato</h3>
      <form onSubmit={async e => {
              e.preventDefault();
              try {
                await api.post(`/bolao/${novoCampeonato.bolaoId}/campeonato`, { nome: novoCampeonato.nome });
                setModalMsg('Campeonato criado com sucesso!');
                setTimeout(() => setModalMsg(''), 2500);
                setNovoCampeonato({ bolaoId: '', nome: '' });
        await refreshLists();
        fetchAllGrouped();
              } catch {
                setMsg('Erro ao criar campeonato');
              }
            }} className="creation-form">
              <select
                value={novoCampeonato.bolaoId}
                onChange={e => setNovoCampeonato({ ...novoCampeonato, bolaoId: e.target.value })}
                required
                className="form-select"
              >
                <option value="">Selecione o bolão</option>
                {boloes.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
              <input
                type="text"
                placeholder="Nome do campeonato"
                value={novoCampeonato.nome}
                onChange={e => setNovoCampeonato({ ...novoCampeonato, nome: e.target.value })}
                required
                className="form-input"
              />
              <button
                type="submit"
                className="form-button campeonato-button"
                title="Criar um novo campeonato"
                style={{
                  background: 'linear-gradient(90deg, #1976d2, #64b5f6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  border: '1px solid #1976d2',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px'
                }}
              >
                <span role="img" aria-label="Campeonato">🏅</span> Criar Campeonato
              </button>
            </form>
          </div>

          <div className="creation-card rodada-card">
            <h3 className="card-title">3º Criar Rodada</h3>
      <form onSubmit={async e => {
              e.preventDefault();
              try {
                await api.post(`/bolao/campeonato/${novaRodada.campeonatoId}/rodada`, { nome: novaRodada.nome });
                setModalMsg('Rodada criada com sucesso!');
                setTimeout(() => setModalMsg(''), 2500);
                setNovaRodada({ campeonatoId: '', nome: '' });
        await refreshLists();
        fetchAllGrouped();
              } catch {
                setModalMsg('Erro ao criar rodada');
              }
            }} className="creation-form">
              <select
                value={novaRodada.campeonatoId}
                onChange={e => setNovaRodada({ ...novaRodada, campeonatoId: e.target.value })}
                required
                className="form-select"
              >
                <option value="">Selecione o campeonato</option>
                {campeonatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <input
                type="text"
                placeholder="Nome da rodada"
                value={novaRodada.nome}
                onChange={e => setNovaRodada({ ...novaRodada, nome: e.target.value })}
                required
                className="form-input"
              />
              <button
                type="submit"
                className="form-button rodada-button"
                title="Criar uma nova rodada"
                style={{
                  background: 'linear-gradient(90deg, #43a047, #a5d6a7)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  border: '1px solid #43a047',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px'
                }}
              >
                <span role="img" aria-label="Rodada">🗓️</span> Criar Rodada
              </button>
            </form>
          </div>

          <div className="creation-card partida-card wide">
            <h3 className="card-title">4º Criar Partida</h3>
            <form onSubmit={async e => {
              e.preventDefault();
              try {
                await api.post(`/bolao/rodada/${novaPartida.rodadaId}/partida`, { time1: novaPartida.time1, time2: novaPartida.time2 });
                setModalMsg('Partida criada com sucesso!');
                setTimeout(() => setModalMsg(''), 2500);
                setNovaPartida({ rodadaId: '', time1: '', time2: '' });
                fetchAllGrouped();
              } catch {
                setModalMsg('Erro ao criar partida');
              }
            }} className="creation-form">
              <select
                value={novaPartida.rodadaId}
                onChange={e => setNovaPartida({ ...novaPartida, rodadaId: e.target.value })}
                required
                className="form-select"
              >
                <option value="">Selecione a rodada</option>
                {rodadas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>

              <div className="teams-row">
                <select
                  value={novaPartida.time1}
                  onChange={e => setNovaPartida({ ...novaPartida, time1: e.target.value })}
                  required
                  className="form-select"
                >
                  <option value="">Time 1</option>
                  {times.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>

                <button
                  type="button"
                  onClick={() => setNovaPartida(p => ({ ...p, time1: p.time2, time2: p.time1 }))}
                  className="action-button small swap-button"
                  title="Inverter times"
                >
                  ↔
                </button>

                <select
                  value={novaPartida.time2}
                  onChange={e => setNovaPartida({ ...novaPartida, time2: e.target.value })}
                  required
                  className="form-select"
                >
                  <option value="">Time 2</option>
                  {times.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>

                <button
                  type="button"
                  onClick={() => navigate('/admin/times')}
                  className="action-button small manage-button"
                  title="Clique para editar, adicionar ou remover times"
                  style={{
                    background: '#1976d2',
                    color: '#fff',
                    border: '1px solid #1976d2',
                    fontWeight: 600,
                    fontSize: 15,
                    padding: '6px 14px',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span role="img" aria-label="Gerenciar">🛠️</span> Gerenciar Times
                </button>
              </div>

              <button
                type="submit"
                className="form-button partida-button"
                title="Criar uma nova partida"
                style={{
                  background: 'linear-gradient(90deg, #d32f2f, #ffcdd2)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  border: '1px solid #d32f2f',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px'
                }}
              >
                <span role="img" aria-label="Partida">⚽</span> Criar Partida
              </button>
            </form>
          </div>

          {/* NOVO: Card Bolões -> página de gerenciamento */}
          <div className="creation-card bolao-card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="card-title">Bolões</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate('/admin/boloes')}
                className="form-button bolao-button"
                title="Acesse a área de administração dos bolões"
                style={{
                  background: 'linear-gradient(90deg, #fbc02d, #ffeb3b)',
                  color: '#333',
                  fontWeight: 700,
                  fontSize: 16,
                  border: '1px solid #fbc02d',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px'
                }}
              >
                <span role="img" aria-label="Bolões">🏆</span> Gerenciar Bolões
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="boloes-list">
        {boloes.map((b, idx) => (
          <div key={b.id} className="bolao-item">
            <div className="bolao-header">
              <span className="bolao-index">{idx + 1}º</span>
              {editId === b.id ? (
                <div className="edit-form">
                  <input
                    value={editNome}
                    onChange={e => setEditNome(e.target.value)}
                    className="edit-input"
                    autoFocus
                  />
                  <button
                    onClick={() => editarBolao(b.id)}
                    className="action-button save-button"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => { setEditId(null); setEditNome(''); }}
                    className="action-button cancel-button"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <span className="bolao-name">
                    {b.nome}
                    {b.finalizado ? (
                      <span className="finalizado-badge">(Finalizado)</span>
                    ) : (
                      <span className="ativo-badge">(Ativo)</span>
                    )}
                  </span>
                </>
              )}
            </div>

            {/* NOVO: Resumo Status / Campeonatos / Rodadas ativas */}
            {(() => {
              const camps = Array.isArray(bolaoCampeonatos[b.id]) ? bolaoCampeonatos[b.id] : [];
              const campNames = camps.map(c => c.nome).join(', ');
              // Rodadas ativas: nomes
              const activeRoundNames = camps
                .flatMap(c => (Array.isArray(campeonatoRodadas[c.id]) ? campeonatoRodadas[c.id] : []))
                .filter(r => !r.finalizada)
                .map(r => r.nome);
              const activeRounds = activeRoundNames.length;
              return (
                <div className="bolao-summary">
                  <div>
                    <span className="summary-label">Status:</span>
                    <span className={`status-badge ${b.finalizado ? 'finalizado' : 'ativo'}`}> 
                      {b.finalizado ? 'Finalizado' : 'Ativo'}
                    </span>
                  </div>
                  <div>
                    <span className="summary-label">Campeonatos:</span>
                    <span className="summary-value">{campNames || '—'}</span>
                  </div>
                  <div>
                    <span className="summary-label">Rodadas ativas:</span>
                    <span className="summary-value">{activeRounds}
                      {activeRoundNames.length > 0 && (
                        <span style={{ marginLeft: 8, color: '#388e3c', fontWeight: 600 }}>
                          ({activeRoundNames.join(', ')})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>


      {modalMsg && (
        <div className="center-toast modal-success">
          {modalMsg}
        </div>
      )}
      {msg && !modalMsg && (
        <div className="message success">
          {msg}
        </div>
      )}

      <style>{`
        .center-toast.modal-success {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9999; /* Z-index muito alto para garantir que apareça sobre tudo */
          min-width: 320px;
          max-width: 90vw;
          text-align: center;
          font-size: 28px; /* Fonte maior para garantir visibilidade */
          box-shadow: 0 8px 32px rgba(0,0,0,0.25);
          background: #17632a;
          color: #fff;
          border: 2px solid #fff; /* Borda branca para destacar */
          border-radius: 16px;
          padding: 40px 50px;
          font-weight: 800;
          letter-spacing: 1px;
          animation: fadeIn 0.5s, pulsar 2.5s infinite; /* Animação de pulsar para chamar atenção - ajustada para 2.5s */
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -40%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes pulsar {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        /* ...estilos existentes... */

        /* Resumo do bolão */
        .bolao-summary {
          display: grid;
          grid-template-columns: 180px 1fr 180px;
          gap: 12px;
          padding: 12px;
          margin: 6px 0 14px;
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 8px;
        }
          .bolao-summary > div:nth-child(3) {
            grid-column: 2;
            text-align: left;
          }
        .summary-label {
          font-weight: 600;
          color: #555;
          margin-right: 6px;
        }
        .summary-value {
          color: #333;
          font-weight: 500;
          
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 12px;
          margin-left: 6px;
          font-weight: 700;
          color: #fff;
        }
        .status-badge.ativo { background: #43a047; }
        .status-badge.finalizado { background: #9e9e9e; }

        /* Badge "Ativo" ao lado do nome */
        .ativo-badge {
          background: #43a047;
          color: white;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 8px;
        }

        @media (max-width: 800px) {
          .bolao-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

  <style>{`
        .bolao-container {
          max-width: 900px;
          margin: 40px auto;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          background: #fff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .main-title {
              text-align: center;
              color: #1976d2;
              margin-bottom: 32px;
              font-size: 38px;
              letter-spacing: 2px;
              font-weight: 800;
              position: relative;
              padding-bottom: 18px;
              text-shadow: 0 2px 12px rgba(25,118,210,0.18), 0 1px 0 #fff;
              background: linear-gradient(90deg, #e3f2fd 0%, #bbdefb 100%);
              border-radius: 12px;
              box-shadow: 0 4px 24px rgba(25,118,210,0.10);
              transition: box-shadow 0.3s, background 0.3s;
              animation: mainTitlePulseBlue 2.5s infinite;
        }
            @keyframes mainTitlePulseBlue {
              0% { box-shadow: 0 4px 24px rgba(25,118,210,0.10); }
              50% { box-shadow: 0 8px 32px rgba(25,118,210,0.18); }
              100% { box-shadow: 0 4px 24px rgba(25,118,210,0.10); }
            }
        
        .main-title:after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 185px;
          height: 4px;
          background: linear-gradient(90deg, #fbc02d, #ffeb3b);
          border-radius: 2px;
        }
        
        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: #1976d2;
          font-weight: 500;
          gap: 12px;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(25, 118, 210, 0.3);
          border-radius: 50%;
          border-top-color: #1976d2;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .admin-alert {
          background: #fffde7;
          border: 1px solid #fbc02d;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 32px;
          color: #333;
          box-shadow: 0 2px 8px rgba(251, 192, 45, 0.2);
        }
        
        .admin-alert h3 {
          margin: 0 0 16px 0;
          text-align: center;
          font-size: 18px;
          font-weight: 600;
        }
        
        .creation-steps {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        
        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          font-weight: 500;
        }
        
        .step-number {
          background: #1976d2;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        
        .step-arrow {
          color: #1976d2;
          font-weight: bold;
        }
        
        .creation-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        
        .creation-card {
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
        }

        /* FAZ O CARD 4 (partida-card wide) FICAR LARGO DE NOVO */
        .creation-card.wide {
          grid-column: 1 / -1;
        }

        .partida-card .teams-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .bolao-card {
          background: linear-gradient(to bottom right, #fffbe6, #fff3c4);
          border: 1px solid #fbc02d;
        }
        
        .campeonato-card {
          background: linear-gradient(to bottom right, #e3f2fd, #bbdefb);
          border: 1px solid #1976d2;
        }
        
        .rodada-card {
          background: linear-gradient(to bottom right, #e8f5e9, #c8e6c9);
          border: 1px solid #43a047;
        }
        
        .partida-card {
          background: linear-gradient(to bottom right, #ffebee, #ffcdd2);
          border: 1px solid #d32f2f;
        }
        
        .card-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .bolao-card .card-title {
          color: #f57c00;
        }
        
        .campeonato-card .card-title {
          color: #1976d2;
        }
        
        .rodada-card .card-title {
          color: #388e3c;
        }
        
        .partida-card .card-title {
          color: #d32f2f;
        }
        
        .creation-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .form-input, .form-select {
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #ddd;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #1976d2;
          box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
        }
        
        .form-button {
          padding: 10px;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .form-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        
        .bolao-button {
          background: #fbc02d;
        }
        
        .bolao-button:hover {
          background: #f9a825;
        }
        
        .campeonato-button {
          background: #1976d2;
        }
        
        .campeonato-button:hover {
          background: #1565c0;
        }
        
        .rodada-button {
          background: #43a047;
        }
        
        .rodada-button:hover {
          background: #388e3c;
        }
        
        .partida-button {
          background: #d32f2f;
        }
        
        .partida-button:hover {
          background: #c62828;
        }
        
        .boloes-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .bolao-item {
          border-radius: 12px;
          padding: 20px;
          background: #f8f9fa;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          border: 1px solid #e9ecef;
        }
        
        .bolao-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e9ecef;
        }
        
        .bolao-index {
          background: #fbc02d;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }
        
        .bolao-name {
          font-size: 20px;
          font-weight: 600;
          color: #333;
          flex: 1;
        }
        
        .finalizado-badge {
          background: #9e9e9e;
          color: white;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 8px;
        }
        
        .ativo-badge {
          background: #4caf50;
          color: white;
          padding: 4px 8px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 8px;
        }
        
        .bolao-actions {
          display: flex;
          gap: 8px;
        }
        
        .action-button {
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .small {
          padding: 4px 8px;
          font-size: 12px;
        }
        
        .edit-button {
          background: #2196f3;
          color: white;
        }
        
        .edit-button:hover {
          background: #1976d2;
        }
        
        .delete-button {
          background: #f44336;
          color: white;
        }
        
        .delete-button:hover {
          background: #d32f2f;
        }
        
        .finalize-button {
          background: #4caf50;
          color: white;
        }
        
        .finalize-button:hover {
          background: #388e3c;
        }
        
        .save-button {
          background: #4caf50;
          color: white;
        }
        
        .save-button:hover {
          background: #388e3c;
        }
        
        .cancel-button {
          background: #9e9e9e;
          color: white;
        }
        
        .cancel-button:hover {
          background: #757575;
        }
        
        .edit-form {
          display: flex;
          gap: 8px;
          align-items: center;
          flex: 1;
        }
        
        .edit-input {
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #ddd;
          font-size: 16px;
          flex: 1;
        }
        
        .nested-list {
          margin-left: 24px;
          padding-left: 24px;
          border-left: 2px solid #e0e0e0;
        }
        
        .campeonato-item, .rodada-item, .partida-item {
          margin: 12px 0;
          padding: 16px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          border: 1px solid #f0f0f0;
        }
        
        .campeonato-header, .rodada-header, .partida-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .item-index {
          background: #9e9e9e;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }
        
        .campeonato-name, .rodada-name, .partida-name {
          font-weight: 500;
          flex: 1;
        }
        
        .campeonato-name {
          color: #1976d2;
        }
        
        .rodada-name {
          color: #388e3c;
        }
        
        .partida-name {
          color: #d32f2f;
        }
        
        .item-actions {
          display: flex;
          gap: 6px;
        }
        
        .empty-state {
          padding: 12px;
          text-align: center;
          color: #9e9e9e;
          font-style: italic;
          background: #fafafa;
          border-radius: 6px;
          margin: 8px 0;
        }
        
        .message {
          padding: 12px 16px;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: 500;
        }
        
        .success {
          background: #e8f5e9;
          color: #2e7d32;
          border: 1px solid #c8e6c9;
        }
        
        .error {
          background: #ffebee;
          color: #c62828;
          border: 1px solid #ffcdd2;
        }
        
        .success-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #4caf50;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.3s, fadeOut 0.3s 2.5s forwards;
          z-index: 1000;
        }
        
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fadeOut {
          to { opacity: 0; }
        }
        
        @media (max-width: 768px) {
          .bolao-container {
            padding: 20px;
            margin: 20px;
          }
          
          .creation-grid {
            grid-template-columns: 1fr;
          }

          /* Em mobile, continua 1 coluna (sem problema) */
          .creation-card.wide {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}

export default BolaoList;