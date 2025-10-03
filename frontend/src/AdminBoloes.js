import React, { useEffect, useState, useCallback } from 'react';
import api from './services/api';
import { useNavigate } from 'react-router-dom';
import AdminSubMenu from './AdminSubMenu';
import { API_BASE, API_BASE as IMG_BASE } from './config';

// Função para baixar relatório PDF do campeonato
async function baixarRelatorioCampeonato(campeonatoId, nome) {
  try {
    const res = await fetch(`${API_BASE}/admin/relatorio-campeonato/${campeonatoId}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao gerar relatório');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-campeonato-${nome || campeonatoId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    alert('Erro ao baixar relatório PDF: ' + (e?.message || e));
  }
}

// Função para formatar a data para o input datetime-local (formato brasileiro)
function formatDateForInput(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  // Ajusta para o timezone de Brasília
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffset);
  
  return localDate.toISOString().slice(0, 16);
}

// Função para formatar a data para exibição amigável
function formatDateForDisplay(dateString) {
  if (!dateString) return 'Data não definida';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Função para criar um input personalizado para data/hora
function promptDateTime(mensagem, valorPadrao = '') {
  return new Promise((resolve) => {
    // Cria um modal simples
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      min-width: 300px;
    `;
    
    const label = document.createElement('label');
    label.textContent = mensagem;
    label.style.cssText = 'display: block; margin-bottom: 10px; font-weight: bold;';
    
    const input = document.createElement('input');
    input.type = 'datetime-local';
    input.value = valorPadrao;
    input.style.cssText = `
      width: 100%;
      padding: 8px;
      margin-bottom: 15px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 14px;
    `;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'OK';
    confirmButton.style.cssText = `
      padding: 8px 16px;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    cancelButton.style.cssText = `
      padding: 8px 16px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    
    confirmButton.onclick = () => {
      resolve(input.value);
      document.body.removeChild(modal);
    };
    
    cancelButton.onclick = () => {
      resolve(null);
      document.body.removeChild(modal);
    };
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    
    content.appendChild(label);
    content.appendChild(input);
    content.appendChild(buttonContainer);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Foca no input
    input.focus();
    
    // Fecha modal ao clicar fora
    modal.onclick = (e) => {
      if (e.target === modal) {
        resolve(null);
        document.body.removeChild(modal);
      }
    };
  });
}
// Autenticação agora via cookie httpOnly; não precisamos mais injetar Authorization manual
async function tryGet(urls, config = {}) {
  let lastErr;
  const merged = { ...config }; // sem headers extras
  for (const url of urls) {
    try {
      const res = await api.get(url, merged);
      return { data: res.data, urlOk: url };
    } catch (err) {
      lastErr = err;
      console.warn('GET falhou:', url, err?.response?.status || err?.message);
    }
  }
  throw lastErr;
}

async function getCampeonatosTodos() {
  const { data } = await tryGet([`${API_BASE}/bolao/campeonatos-todos`, `${API_BASE}/campeonatos-todos`], {});
  const list = Array.isArray(data) ? data : (data?.campeonatos || data || []);
  return list.map((c) => ({
    id: c.id ?? c.campeonato_id ?? c.campeonatoId,
    nome: c.nome ?? c.titulo ?? `Campeonato ${c.id ?? ''}`,
    finalizado: (c.finalizado ?? c.finalizada) || false,
    bolaoId: c.bolao_id ?? c.bolaoId ?? c.bolao ?? c.bolaoID ?? null,
  })).filter((c) => c.id);
}

async function getRodadasTodas() {
  const { data } = await tryGet([`${API_BASE}/bolao/rodadas-todas`, `${API_BASE}/rodadas-todas`], {});
  const list = Array.isArray(data) ? data : (data?.rodadas || data || []);
  return list.map((r) => ({
    id: r.id ?? r.rodada_id ?? r.rodadaId,
    nome: r.nome ?? `Rodada ${r.id ?? ''}`,
    finalizada: (r.finalizada ?? r.finalizado) || false,
    campeonatoId: r.campeonato_id ?? r.campeonatoId ?? r.campeonato ?? null,
  })).filter((r) => r.id);
}

function slugify(name = '') {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getPartidasPorRodada(rodadaId, timesMap = {}) {
  const { data } = await tryGet(
    [
      `${API_BASE}/bolao/rodada/${rodadaId}/partidas`,
      `${API_BASE}/rodada/${rodadaId}/partidas`
    ],
    {}
  );
  const raw = (data && (data.partidas ?? data.items)) ?? data;
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

  return list.map((p) => {
    const time1 = p.time1 ?? p.time1_nome ?? p.time1Name ?? p.t1 ?? 'Time 1';
    const time2 = p.time2 ?? p.time2_nome ?? p.time2Name ?? p.t2 ?? 'Time 2';
    const key1 = slugify(time1);
    const key2 = slugify(time2);
    let escudo1 = timesMap[key1] || p.time1_escudo || p.time1Escudo || p.escudo1 || '';
    let escudo2 = timesMap[key2] || p.time2_escudo || p.time2Escudo || p.escudo2 || '';
    // Se vierem URLs absolutas (Cloudinary), usa direto
    if (escudo1 && /^https?:\/\//i.test(escudo1)) {
      // ok
    } else if (escudo1) {
      escudo1 = `${IMG_BASE}/uploads/escudos/${escudo1.replace(/^\/+/, '')}`;
    } else {
      escudo1 = `${IMG_BASE}/uploads/escudos/_default.png`;
    }
    if (escudo2 && /^https?:\/\//i.test(escudo2)) {
      // ok
    } else if (escudo2) {
      escudo2 = `${IMG_BASE}/uploads/escudos/${escudo2.replace(/^\/+/, '')}`;
    } else {
      escudo2 = `${IMG_BASE}/uploads/escudos/_default.png`;
    }
    return {
      ...p,
      finalizada: (p.finalizada ?? p.finalizado) || false,
      time1,
      time2,
      escudo1,
      escudo2,
      // NOVO: Inclui data_jogo se disponível
      data_jogo: p.data_jogo || p.dataJogo || null,
    };
  });
}

export default function AdminBoloes() {
  const [boloes, setBoloes] = useState([]);
  const [bolaoCampeonatos, setBolaoCampeonatos] = useState({});
  const [campeonatoRodadas, setCampeonatoRodadas] = useState({});
  const [rodadaPartidas, setRodadaPartidas] = useState({});
  const [expandedCamps, setExpandedCamps] = useState({});
  const [selectedRodadaId, setSelectedRodadaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [timesMap, setTimesMap] = useState({});
  const navigate = useNavigate(); 

  // Removido: não configuramos Authorization global (cookies já são enviados automaticamente)
  useEffect(() => {}, []);

  // Carrega times ativos para mapear escudos pelo nome
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/times`, {
          params: { ativo: 'true', page: 1, pageSize: 500 }
        });
        const arr = Array.isArray(data) ? data : (data?.items || data?.times || []);
        const map = {};
        for (const t of arr) {
          const key = slugify(t.nome || t.name || '');
          let url = t.escudo_url || t.escudoUrl || '';
          if (url && !/^https?:\/\//i.test(url)) {
            url = `${IMG_BASE}/uploads/escudos/${url.replace(/^\/+/, '')}`;
          }
          if (key) map[key] = url;
        }
        setTimesMap(map);
      } catch (e) {
        setTimesMap({});
      }
    })();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const [{ data }] = await Promise.all([
        tryGet([`${API_BASE}/bolao/listar`, `${API_BASE}/listar`], {}),
      ]);
      const boloesList = Array.isArray(data) ? data : (data?.boloes || data || []);
      setBoloes(boloesList);

      const [allCamps, allRods] = await Promise.all([getCampeonatosTodos(), getRodadasTodas()]);

      const bolaoCamp = {};
      for (const b of boloesList) bolaoCamp[b.id] = allCamps.filter(c => String(c.bolaoId) === String(b.id));
      const campRod = {};
      for (const c of allCamps) campRod[c.id] = allRods.filter(r => String(r.campeonatoId) === String(c.id));

      const rodPart = {};
      const promises = allRods.map(r => (
        getPartidasPorRodada(r.id, timesMap)
          .then(list => ({ ok: true, id: r.id, list }))
          .catch(err => ({ ok: false, id: r.id, err }))
      ));
      const results = await Promise.allSettled(promises);
      for (const res of results) {
        if (res.status === 'fulfilled') {
          const v = res.value;
          if (v.ok) rodPart[v.id] = v.list;
          else {
            console.warn('Falha ao carregar partidas da rodada', v.id, v.err?.response?.status || v.err?.message);
            rodPart[v.id] = [];
          }
        } else {
          // Promise rejected
          const v = res.reason;
          console.warn('Falha ao carregar partidas (promise rejected):', v?.message || v);
        }
      }

      setBolaoCampeonatos(bolaoCamp);
      setCampeonatoRodadas(campRod);
      setRodadaPartidas(rodPart);
    } catch (e) {
      setMsg('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [timesMap]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleCampExpand = (campId) =>
    setExpandedCamps(prev => ({ ...prev, [campId]: !prev[campId] }));

  // Ações (mesmos endpoints da BolaoList)
  async function editarBolao(id, nome) {
    if (!nome?.trim()) return;
    await api.put(`/bolao/${id}`, { nome });
    fetchAll();
  }
  async function excluirBolao(id) {
    if (!window.confirm('Excluir bolão?')) return;
    try {
      await api.delete(`${API_BASE}/bolao/${id}`);
      fetchAll();
    } catch (e) {
      const msg = e?.response?.data?.erro || e?.message || 'Erro ao excluir bolão';
      const detalhes = e?.response?.data?.detalhes;
      alert(detalhes ? `${msg}\n\n${detalhes}` : msg);
    }
  }
  async function finalizarBolao(id) {
    if (!window.confirm('Finalizar bolão?')) return;
    await api.post(`${API_BASE}/bolao/${id}/finalizar`, {});
    fetchAll();
  }
  async function editarCampeonato(id, nome) {
    if (!nome?.trim()) return;
    await api.put(`/bolao/campeonato/${id}`, { nome });
    fetchAll();
  }
  async function excluirCampeonato(id) {
    if (!window.confirm('Excluir campeonato?')) return;
    await api.delete(`${API_BASE}/bolao/campeonato/${id}`);
    fetchAll();
  }
  async function finalizarCampeonato(id) {
    if (!window.confirm('Finalizar campeonato?')) return;
    await api.post(`${API_BASE}/bolao/campeonato/${id}/finalizar`, {});
    fetchAll();
  }
  async function editarRodada(id, nome) {
    if (!nome?.trim()) return;
    await api.put(`/bolao/rodada/${id}`, { nome });
    fetchAll();
  }
  async function excluirRodada(id) {
    if (!window.confirm('Excluir rodada?')) return;
    await api.delete(`${API_BASE}/bolao/rodada/${id}`);
    fetchAll();
  }

  // MODIFICADO: Função de editar partida agora inclui dataJogo
  async function editarPartida(id, t1, t2, dataJogo) {
    if (!t1?.trim() || !t2?.trim()) return;
    await api.put(`/bolao/partida/${id}`, { 
      time1: t1, 
      time2: t2, 
      dataJogo: dataJogo // ← NOVO
    });
    fetchAll();
  }

  async function excluirPartida(id) {
    if (!window.confirm('Excluir partida?')) return;
    await api.delete(`${API_BASE}/bolao/partida/${id}`);
    fetchAll();
  }

  return (
    <>
      <AdminSubMenu />
      <div className="admin-boloes">
        <div className="header-banner">
          <div className="header-left">
            <button className="btn" onClick={() => navigate('/bolao')} title="Voltar">
              ← Voltar
            </button>
            <h2 className="page-title">Bolões (gerenciamento)</h2>
            <div className="subtitle">Gerencie bolões, campeonatos, rodadas e partidas</div>
          </div>
          <div className="header-actions">
            <button className="btn" onClick={fetchAll} title="Recarregar">
              🔄 Recarregar
            </button>
          </div>
        </div>

        <div className="toolbar">
          <label className="label">Ver rodada:</label>
          <select
            value={selectedRodadaId}
            onChange={e => setSelectedRodadaId(e.target.value)}
            className="select"
          >
            <option value="">Mais atual por campeonato</option>
            {Object.values(campeonatoRodadas).flat().map((r) => (
              <option key={r.id} value={r.id}>{r.nome || `Rodada ${r.id}`}</option>
            ))}
          </select>
          {selectedRodadaId && (
            <button onClick={() => setSelectedRodadaId('')} className="btn btn-light">
              Limpar filtro
            </button>
          )}
        </div>

        {loading && <div className="info-row">Carregando...</div>}
        {msg && <div className="info-row error">{msg}</div>}

        <div className="list">
          {boloes.map((b, idx) => (
            <div key={b.id} className="card bolao-card">
              <div className="card-header">
                <div className="index-chip">{idx + 1}º</div>
                <div className="title">
                  {b.nome}
                  {b.finalizado && <span className="badge badge-muted">Finalizado</span>}
                </div>
                <div className="actions">
                  <button
                    onClick={() => editarBolao(b.id, prompt('Novo nome do bolão:', b.nome) || b.nome)}
                    className="btn btn-primary"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => excluirBolao(b.id)}
                    className="btn btn-danger"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => finalizarBolao(b.id)}
                    className="btn btn-success"
                  >
                    Finalizar
                  </button>
                  {Array.isArray(bolaoCampeonatos[b.id]) && bolaoCampeonatos[b.id].length > 0 && (
                    bolaoCampeonatos[b.id].map((c, cidx) => (
                      <button
                        key={`relatorio-camp-${c.id}`}
                        onClick={() => baixarRelatorioCampeonato(c.id, c.nome)}
                        className="btn btn-primary btn-sm"
                        style={{ marginLeft: 8 }}
                      >
                        📄 Relatório PDF
                      </button>
                    ))
                  )}
                </div>
              </div>

              {Array.isArray(bolaoCampeonatos[b.id]) && bolaoCampeonatos[b.id].length > 0 ? (
                <div className="nested">
                  {bolaoCampeonatos[b.id].map((c, cidx) => {
                    const rods = Array.isArray(campeonatoRodadas[c.id]) ? campeonatoRodadas[c.id] : [];
                    let rodsToShow = rods;
                    if (selectedRodadaId) {
                      rodsToShow = rods.filter(r => String(r.id) === String(selectedRodadaId));
                    } else if (!expandedCamps[c.id]) {
                      if (rods.length > 0) {
                        const idxAtual = rods.findIndex(r => !r.finalizada);
                        const idx = idxAtual >= 0 ? idxAtual : rods.length - 1;
                        rodsToShow = [rods[idx]];
                      } else {
                        rodsToShow = [];
                      }
                    }

                    return (
                      <div key={c.id} className="card camp-card">
                        <div className="card-header">
                          <div className="index-chip chip-sm">{cidx + 1}º</div>
                          <div className="title title-sm">
                            {c.nome}
                            {c.finalizado && <span className="badge badge-muted">Finalizado</span>}
                          </div>

                          {(!selectedRodadaId && rods.length > 1) && (
                            <button onClick={() => toggleCampExpand(c.id)} className="btn btn-light btn-sm">
                              {expandedCamps[c.id] ? 'Recolher rodadas' : 'Mostrar todas rodadas'}
                            </button>
                          )}

                          <div className="actions">
                            <button
                              onClick={() => editarCampeonato(c.id, prompt('Novo nome:', c.nome) || c.nome)}
                              className="btn btn-primary btn-sm"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => excluirCampeonato(c.id)}
                              className="btn btn-danger btn-sm"
                            >
                              Excluir
                            </button>
                            <button
                              onClick={() => finalizarCampeonato(c.id)}
                              className="btn btn-success btn-sm"
                            >
                              Finalizar
                            </button>
                          </div>
                        </div>

                        {rodsToShow.length > 0 ? (
                          <div className="nested">
                            {rodsToShow.map((r, ridx) => (
                              <React.Fragment key={r.id}>
                                <div className="card rodada-card">
                                  <div className="card-header">
                                    <div className="index-chip chip-sm">{ridx + 1}º</div>
                                    <div className="title title-sm">
                                      {r.nome}
                                      {r.finalizada && <span className="badge badge-muted">Finalizada</span>}
                                    </div>
                                    <div className="actions">
                                      <button
                                        onClick={() => editarRodada(r.id, prompt('Novo nome:', r.nome) || r.nome)}
                                        className="btn btn-primary btn-sm"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        onClick={() => excluirRodada(r.id)}
                                        className="btn btn-danger btn-sm"
                                      >
                                        Excluir
                                      </button>
                                    </div>
                                  </div>

                                  {Array.isArray(rodadaPartidas[r.id]) && rodadaPartidas[r.id].length > 0 ? (
                                    <div className="nested">
                                      {rodadaPartidas[r.id].map((p, pidx) => (
                                        <div key={p.id} className="card partida-card">
                                          <div className="card-header compact">
                                            <div className="index-chip chip-sm">{pidx + 1}º Jogo</div>
                                            <div className="title match">
                                              <img
                                                src={p.escudo1}
                                                alt={`Escudo ${p.time1}`}
                                                className="escudo-img"
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `${IMG_BASE}/uploads/escudos/_default.png`; }}
                                              />
                                              {p.time1} <span className="vs">x</span> {p.time2}
                                              <img
                                                src={p.escudo2}
                                                alt={`Escudo ${p.time2}`}
                                                className="escudo-img"
                                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `${IMG_BASE}/uploads/escudos/_default.png`; }}
                                              />
                                              {p.finalizada && <span className="badge badge-muted">Finalizada</span>}
                                            </div>
                                            <div className="actions">
                                              {/* MODIFICADO: Botão de editar partida agora inclui data */}
                                                <button
                                                  onClick={async () => {
                                                    const novaData = await promptDateTime(
                                                      'Nova data e hora do jogo:', 
                                                      p.data_jogo ? formatDateForInput(p.data_jogo) : ''
                                                    );
                                                    
                                                    if (novaData === null) return; // Usuário cancelou
                                                    
                                                    editarPartida(
                                                      p.id,
                                                      prompt('Novo time 1:', p.time1) || p.time1,
                                                      prompt('Novo time 2:', p.time2) || p.time2,
                                                      novaData || '' // Se o usuário apagar a data, envia string vazia
                                                    );
                                                  }}
                                                  className="btn btn-primary btn-sm"
                                                >
                                                  Editar
                                                </button>
                                              <button
                                                onClick={() => excluirPartida(p.id)}
                                                className="btn btn-danger btn-sm"
                                              >
                                                Excluir
                                              </button>
                                            </div>
                                          </div>
                                          {/* NOVO: Exibe a data da partida se disponível */}
                                          {p.data_jogo && (
                                            <div className="partida-info">
                                              <small>
                                                <strong>Data do jogo:</strong> {formatDateForDisplay(p.data_jogo)}
                                              </small>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="empty">Nenhuma partida cadastrada</div>
                                  )}
                                </div>
                                {ridx < rodsToShow.length - 1 && (
                                  <hr className="rodada-divider" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <div className="empty">Nenhuma rodada cadastrada</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty">Nenhum campeonato cadastrado</div>
              )}
            </div>
          ))}
        </div>

        <style>{`
          .admin-boloes {
            max-width: 1100px;
            margin: 32px auto;
            background: #fff;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,.06);
          }

          .header-banner {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            border-radius: 12px;
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            color: #fff;
            margin-bottom: 20px;
          }
          .header-left { flex: 1; }
          .page-title { margin: 0; font-weight: 800; }
          .subtitle { opacity: .9; font-size: 13px; }
          .header-actions { display: flex; gap: 8px; }

          .toolbar {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
          }
          .label { font-weight: 600; color: #2c3e50; }
          .select {
            padding: 10px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            background: #fff;
          }

          .info-row { padding: 12px; border-radius: 8px; background: #f3f7ff; color: #0b4ea2; margin-bottom: 12px; }
          .info-row.error { background: #ffeaea; color: #b71c1c; }

          .list { display: flex; flex-direction: column; gap: 16px; }

          .card {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 12px;
            transition: box-shadow .2s ease, transform .2s ease;
          }
          .card:hover { box-shadow: 0 6px 18px rgba(0,0,0,.06); transform: translateY(-1px); }
          .bolao-card { background: #fdfdfd; }
          .camp-card { background: #fcfcff; }
          .rodada-card { background: #fcfffc; }
          .partida-card { background: #fffdfc; }

          .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
            margin-bottom: 8px;
          }
          .card-header.compact { border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }

          .nested {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-left: 16px;
            padding-left: 16px;
            border-left: 2px dashed #eef2f7;
          }

          .index-chip {
            min-width: 32px; height: 32px;
            display: inline-flex; align-items: center; justify-content: center;
            border-radius: 50%;
            background: #fbc02d; color: #fff; font-weight: 700;
          }
          .chip-sm { min-width: 60px; height: 23px; font-size: 12px; }

          .title { font-size: 18px; font-weight: 700; color: #2c3e50; flex: 1; }
          .title-sm { font-size: 16px; font-weight: 600; }
          .title.match { color: #d32f2f; font-weight: 600; display: flex; align-items: center; gap: 8px; }
          .vs { margin: 0 6px; color: #999; }
          
          /* NOVO: Estilo para informações da partida */
          .partida-info {
            padding: 8px 12px;
            background: #f8f9fa;
            border-radius: 6px;
            margin-top: 8px;
            border-left: 3px solid #2196f3;
          }
          
          /* Escudo quadrado (como nas outras telas) */
          .escudo-img {
            width: 45px;
            height: 45px;
            border-radius: 8px;      /* cantos suaves, não círculo */
            object-fit: contain;     /* não cortar o escudo */
            padding: 4px;            /* respiro interno */
            background: #fff;        /* fundo branco */
            border: 2px solid #eef2f7; /* borda clara como padrão */
          }

          .actions { display: flex; gap: 8px; flex-wrap: wrap; }

          .badge {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;
            margin-left: 8px;
          }
          .badge-muted { background: #9e9e9e; color: #fff; }

          .btn {
            padding: 8px 12px; border-radius: 8px; border: 1px solid #e0e0e0;
            background: #fff; color: #2c3e50; font-weight: 600; cursor: pointer;
            transition: all .2s ease; box-shadow: 0 1px 2px rgba(0,0,0,.04);
          }
          .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,.1); }
          .btn:active { transform: translateY(0); }
          .btn-sm { padding: 6px 10px; font-size: 12px; }
          .btn-light { background: #f7f7f7; }
          .btn-primary { background: #2196f3; color: #fff; border-color: #2196f3; }
          .btn-danger { background: #f44336; color: #fff; border-color: #f44336; }
          .btn-success { background: #4caf50; color: #fff; border-color: #4caf50; }

          .empty {
            padding: 12px; text-align: center; color: #9e9e9e; font-style: italic;
            background: #fafafa; border-radius: 8px; border: 1px dashed #eaeaea;
          }

          @media (max-width: 768px) {
            .header-banner { flex-direction: column; align-items: flex-start; }
            .card-header { align-items: flex-start; }
            .actions { width: 100%; }
          }
        `}</style>
      </div>
    </>
  );
}
