import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import api from './services/api';

// Backend base para imagens e API
import { API_BASE as API } from './config';
import { carregarRodadasComDeteccaoAtual } from './utils/rodadaAtual';

// gera slug e monta URL no backend/uploads/escudos/<slug>.png
function slugify(nome = '') {
  return String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
function escudoUrl(nome) {
  return `${API}/uploads/escudos/${slugify(nome)}.png`;
}

// Estilo do escudo (sem círculo, não corta)
const escudo = {
  width: 56,
  height: 56,
  borderRadius: 8,          // sem círculo
  objectFit: 'contain',
  padding: 6,
  background: '#fff',
  border: '2px solid #eef2f7',
};

export default function LancarResultado() {
  const [rodadas, setRodadas] = useState([]);
  const [rodadaId, setRodadaId] = useState('');
  const [partidas, setPartidas] = useState([]);
  const [resultados, setResultados] = useState({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [partidaSel, setPartidaSel] = useState(null);
  const [timesMap, setTimesMap] = useState({}); // slug(nome) => escudo_url

  const carregarRodadas = useCallback(async () => {
    setErro('');
    try {
      const { rodadas: lista, rodadaAtualId: atual } = await carregarRodadasComDeteccaoAtual();
      const norm = lista.map(r => ({ ...r, finalizada: (r.finalizada ?? r.finalizado) || false }));
      setRodadas(norm);
      
      // Usa a detecção inteligente da rodada atual
      if (!rodadaId && atual) setRodadaId(atual);
    } catch (err) {
      console.error('Erro ao carregar rodadas:', err?.response || err);
      const msg = err?.response?.data?.erro || err?.message || 'Erro ao carregar rodadas';
      const status = err?.response?.status ? ` ${err.response.status}` : '';
      setErro(`${msg}${status}`);
    }
  }, [rodadaId]);

  const carregarPartidas = useCallback(async (rid) => {
    if (!rid) return;
    setLoading(true);
    setErro('');
    try {
  const { data } = await api.get(`/bolao/rodada/${rid}/partidas`);
      const lista = Array.isArray(data) ? data : (data?.partidas || []);
      const norm = lista.map(p => ({ ...p, finalizada: (p.finalizada ?? p.finalizado) || false }));
      setPartidas(norm);
      setResultados(prev => {
        const next = { ...prev };
        norm.forEach(p => {
          const bloqueado = p.finalizada || p.resultado;
          if (bloqueado) delete next[p.id];
        });
        return next;
      });
    } catch (err) {
      console.error(`GET /bolao/rodada/${rid}/partidas erro:`, err?.response || err);
      const msg = err?.response?.data?.erro || err?.message || 'Erro ao carregar partidas';
      const status = err?.response?.status ? ` ${err.response.status}` : '';
      setErro(`${msg}${status}`);
      setPartidas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarRodadas(); }, [carregarRodadas]);
  useEffect(() => { if (rodadaId) carregarPartidas(rodadaId); }, [rodadaId, carregarPartidas]);

  const rodadaSel = rodadas.find(r => String(r.id) === String(rodadaId));

  function handleResultadoChange(id, valor) {
    const p = partidas.find(x => x.id === id);
    const bloqueado = (p?.finalizada || p?.resultado || rodadaSel?.finalizada);
    if (bloqueado) return;
    setResultados(prev => ({ ...prev, [id]: valor }));
  }

  function formatResultado(p) {
    if (p.resultado === 'EMPATE') return 'Empate';
    if (p.resultado === 'TIME1') return `Ganhador: ${p.time1}`;
    if (p.resultado === 'TIME2') return `Ganhador: ${p.time2}`;
    return p.resultado || '';
  }

  async function salvarResultado(p) {
    setErro('');
    setOkMsg('');
    const bloqueado = (p.finalizada || p.resultado || rodadaSel?.finalizada);
    if (bloqueado) { setErro('Partida/rodada finalizada. Edição bloqueada.'); return; }

    const res = resultados[p.id];
    if (!res) { setErro('Selecione o resultado da partida.'); return; }

    try {
  await api.post(`/palpite/resultado/${p.id}`, { resultado: res });
    } catch (e) {
      console.error(`POST /palpite/resultado/${p.id} erro:`, e?.response || e);
      let gols1 = 0, gols2 = 0;
      if (res === 'TIME1') gols1 = 1;
      if (res === 'TIME2') gols2 = 1;
  await api.post(`/palpite/resultado/${p.id}`, { gols1, gols2 });
    }

    setPartidaSel({ ...p, resultadoEscolhido: res });
    setConfirmMsg(`Deseja finalizar a partida ${p.time1} x ${p.time2}? Esta operação não poderá ser desfeita.`);
    setConfirmOpen(true);
  }

  async function confirmarFinalizacaoPartida() {
    if (!partidaSel) return;
    try {
  await api.post(`/bolao/partida/${partidaSel.id}/finalizar`);
      await carregarPartidas(rodadaId);
      setOkMsg('Partida finalizada e pontos atualizados.');
      setShowModal(true);
    } catch (e) {
      console.error(`POST /bolao/partida/${partidaSel?.id}/finalizar erro:`, e?.response || e);
      if (e?.response?.status === 403) setErro('Apenas admin pode finalizar a partida.');
      else setErro(e?.response?.data?.erro || 'Erro ao finalizar a partida.');
    } finally {
      setConfirmOpen(false);
      setPartidaSel(null);
    }
  }

  async function finalizarRodadaAtual() {
    if (!rodadaId) return;
    setErro('');
    setOkMsg('');
    try {
  await api.post(`/bolao/rodada/${rodadaId}/finalizar`);
      await carregarPartidas(rodadaId);
      setOkMsg('Rodada finalizada. Pontos recalculados no ranking.');
      setShowModal(true);
    } catch (e) {
      console.error(`POST /bolao/rodada/${rodadaId}/finalizar erro:`, e?.response || e);
      if (e?.response?.status === 403) {
        setErro('Apenas admin pode finalizar rodada.');
      } else {
        const msg = e?.response?.data?.erro || 'Erro ao finalizar rodada';
        const status = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
        setErro(`${msg}${status}`);
      }
    }
  }

  useEffect(() => {
    async function loadTimes() {
      try {
  const { data } = await api.get(`/times`, { params: { ativo: 'true', page: 1, pageSize: 500 } });
        const arr = Array.isArray(data) ? data : (data?.items || data?.times || []);
        const map = {};
        for (const t of arr) {
          const key = slugify(t.nome || t.name || '');
          // aceita URL absoluta já salva no banco; senão tenta montar
          let url = t.escudo_url || t.escudoUrl || '';
          if (url && !/^https?:\/\//i.test(url)) {
            url = `${API}/uploads/escudos/${url.replace(/^\/+/, '')}`;
          }
          map[key] = url;
        }
        setTimesMap(map);
      } catch (e) {
        // silencioso
      }
    }
    loadTimes();
  }, []);

  const escudoByNome = useCallback((nome) => {
    const key = slugify(nome || '');
    return (timesMap[key] && timesMap[key].trim())
      ? timesMap[key]
      : `${API}/uploads/escudos/_default.png`;
  }, [timesMap]);

  // Formata data/hora em pt-BR de forma resiliente
  function formatarDataBR(dt) {
    if (!dt) return '';
    try {
      let d;
      if (typeof dt === 'number') {
        d = new Date(dt);
      } else if (/^\d+$/.test(String(dt))) {
        d = new Date(parseInt(dt, 10));
      } else {
        let s = String(dt).trim();
        // Se vier como 'YYYY-MM-DD HH:mm', troca espaço por 'T' para o parser do JS
        if (s.length > 10 && s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T');
        d = new Date(s);
      }
      if (isNaN(d.getTime())) return String(dt);
      return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
    } catch {
      return String(dt);
    }
  }

  return (
    <>
      <div className="lancar-resultado-container">
        <div className="soccer-field-banner">
          <h1 className="main-title">Lançar Resultados</h1>
          <div className="field-overlay"></div>
        </div>

        <div className="content-wrapper">
          {rodadaSel?.finalizada && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              Rodada finalizada. Alterações estão bloqueadas.
            </div>
          )}
          
          <div className="controls-container">
            <div className="select-group">
              <label htmlFor="rodada" className="select-label">
                Selecione a Rodada:
              </label>
              <select 
                id="rodada" 
                value={rodadaId} 
                onChange={e => setRodadaId(e.target.value)} 
                className="rodada-select"
              >
                {rodadas.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nome || `Rodada ${r.id}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="buttons-container">
              <button 
                onClick={() => carregarPartidas(rodadaId)} 
                className="btn btn-secondary"
              >
                <span className="btn-icon">↻</span>
                Recarregar
              </button>
              <button 
                onClick={finalizarRodadaAtual} 
                className="btn btn-primary"
              >
                <span className="btn-icon">✓</span>
                Finalizar rodada
              </button>
            </div>
          </div>

          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Carregando partidas...</span>
            </div>
          )}
          
          {erro && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              {erro}
            </div>
          )}
          
          {okMsg && (
            <div className="alert alert-success">
              <span className="alert-icon">✅</span>
              {okMsg}
            </div>
          )}
          
          {(!loading && partidas.length === 0) && (
            <div className="empty-state">
              <div className="empty-icon">⚽</div>
              <h3>Nenhuma partida encontrada para esta rodada</h3>
            </div>
          )}

          <div className="partidas-list">
            {partidas.map((p, idx) => {
              const valor = resultados[p.id] || '';
              const bloqueado = !!(p.finalizada || p.resultado || rodadaSel?.finalizada);
              const t1 = p.time1;
              const t2 = p.time2;
              const logo1 = escudoByNome(t1);
              const logo2 = escudoByNome(t2);
              return (
                <React.Fragment key={p.id}>
                  <div className={`partida-card ${bloqueado ? 'blocked' : ''}`}>
                    <div className="match-header">
                      <div className="match-header-top">
                        <div className="match-badge">Jogo {idx + 1}</div>
                        {(p.finalizada || p.finalizado) && (
                          <span className="status-badge finalizada-badge">Finalizada</span>
                        )}
                        {rodadaSel?.finalizada && !p.finalizada && (
                          <span className="status-badge finalizada-badge">Rodada finalizada</span>
                        )}
                        {p.resultado && (
                          <span className="status-badge resultado-badge">
                            <span className="result-icon">🏆</span>
                            {formatResultado(p)}
                          </span>
                        )}
                      </div>
                      
                    </div>


                    <div className="bet-options">
                      <button
                        className={`bet-btn ${valor === 'TIME1' ? 'selected' : ''}`}
                        disabled={bloqueado}
                        onClick={() => handleResultadoChange(p.id, 'TIME1')}
                      >
                        <img 
                          className="team-logo small" 
                          src={logo1} 
                          alt={t1}
                          onError={(e)=>{ e.currentTarget.src = `${API}/uploads/escudos/_default.png`; }} 
                        />
                        <span className="btn-text">{t1} — Vence</span>
                      </button>

                      <button
                        className={`bet-btn empate ${valor === 'EMPATE' ? 'selected' : ''}`}
                        disabled={bloqueado}
                        onClick={() => handleResultadoChange(p.id, 'EMPATE')}
                      >
                        <span className="empate-icon">X</span>
                        <span className="btn-text">Empate</span>
                      </button>

                      <button
                        className={`bet-btn ${valor === 'TIME2' ? 'selected' : ''}`}
                        disabled={bloqueado}
                        onClick={() => handleResultadoChange(p.id, 'TIME2')}
                      >
                        <img 
                          className="team-logo small" 
                          src={logo2} 
                          alt={t2}
                          onError={(e)=>{ e.currentTarget.src = `${API}/uploads/escudos/_default.png`; }} 
                        />
                        <span className="btn-text">{t2} — Vence</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => salvarResultado(p)}
                        className={`btn btn-save ${bloqueado ? 'disabled' : ''}`}
                        disabled={bloqueado || !valor}
                        title={
                          bloqueado
                            ? 'Edição bloqueada'
                            : (!valor ? 'Selecione um resultado' : 'Salvar resultado')
                        }
                      >
                        <span className="btn-icon">💾</span>
                        Salvar
                      </button>
                    </div>
                  </div>
                  {idx < partidas.length - 1 && <div className="game-sep" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal OK (sucesso) */}
      {showModal && okMsg && (
        <div 
          className="modal-overlay" 
          onClick={() => { setShowModal(false); setOkMsg(''); }}
        >
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Sucesso</h3>
            </div>
            <div className="modal-body">
              <div className="success-icon">✅</div>
              <p>{okMsg}</p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => { setShowModal(false); setOkMsg(''); }}
                className="btn btn-confirm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação para finalizar partida */}
      {confirmOpen && (
        <div 
          className="modal-overlay" 
          onClick={() => setConfirmOpen(false)}
        >
          <div 
            className="modal modal-confirm" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Confirmar finalização</h3>
            </div>
            <div className="modal-body">
              <div className="warning-icon">⚠️</div>
              <p>{confirmMsg}</p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setConfirmOpen(false)} 
                className="btn btn-cancel"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarFinalizacaoPartida} 
                className="btn btn-danger"
              >
                Finalizar partida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* troque <style jsx> por <style> e adicione estilos dos escudos */}
      <style>{`
        /* Tamanhos dos escudos */
        :root {
          --escudo: 72px;     /* principal */
          --escudo-sm: 60px;  /* nas opções */
          --bet-width: 180px; /* largura dos botões Vence/X/Vence */
        }
        .team-logo {
          width: var(--escudo);
          height: var(--escudo);
          object-fit: contain;
          border-radius: 8px;
          padding: 6px;
          background: #fff;
          border: 2px solid #eef2f7;
        }
        .team-logo.small {
          width: var(--escudo-sm);
          height: var(--escudo-sm);
          object-fit: contain;
          vertical-align: middle;
        }

        /* Badge do volante */
        .volante-badge {
          display: inline-block;
          margin-bottom: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          background: #eef5ff;
          color: #1976d2;
          font-weight: 700;
          font-size: 13px;
          border: 1px solid #cfe1ff;
        }
        
        /* Separador entre jogos */
        .game-sep {
          border-top: 2px dashed #e0e0e0;
          margin: 14px 0;
        }

        .lancar-resultado-container {
          max-width: 1000px;
          margin: 0 auto;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .soccer-field-banner {
          position: relative;
          height: 165px;
          background: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), 
                     url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23297237'/%3E%3Cpath d='M50,0 L50,100 M0,50 L100,50 M15,15 L15,85 M85,15 L85,85 M15,15 L85,15 M15,85 L85,85' stroke='white' stroke-width='2' fill='none'/%3E%3Ccircle cx='50' cy='50' r='10' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E");
          background-size: cover;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          padding: 20px;
        }
        
        .field-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, rgba(0, 100, 0, 0.7), rgba(0, 80, 0, 0.7));
        }
        
        .main-title {
          position: relative;
          z-index: 2;
          font-size: 32px;
          font-weight: 800;
          margin: 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
          text-align: center;
        }
        
        .content-wrapper {
          padding: 24px;
        }
        
        .controls-container {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        
        .select-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        
        .select-label {
          font-weight: 600;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        
        .icon {
          font-size: 20px;
        }
        
        .rodada-select {
          padding: 12px 16px;
          border-radius: 10px;
          border: 2px solid #e0e0e0;
          background: white;
          font-size: 16px;
          flex: 1;
          min-width: 200px;
          transition: all 0.3s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
          background-size: 16px;
          appearance: none;
        }
        
        .rodada-select:focus {
          outline: none;
          border-color: #27ae60;
          box-shadow: 0 0 0 3px rgba(39, 174, 96, 0.2);
        }
        
        .buttons-container {
          display: flex;
          gap: 12px;
        }
        
        .btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .btn:active {
          transform: translateY(0);
        }
        
        .btn:disabled, .btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .btn-secondary {
          background: #f8f9fa;
          color: #495057;
          border: 1px solid #dee2e6;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: #e9ecef;
        }
        
        .btn-primary {
          background: #2ecc71;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #27ae60;
        }
        
        .btn-save {
          background: #3498db;
          color: white;
        }
        
        .btn-save:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .btn-danger {
          background: #e74c3c;
          color: white;
        }
        
        .btn-danger:hover {
          background: #c0392b;
        }
        
        .btn-confirm {
          background: #3498db;
          color: white;
        }
        
        .btn-cancel {
          background: #95a5a6;
          color: white;
        }
        
        .btn-icon {
          font-size: 16px;
        }
        
        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 20px;
          color: #3498db;
          font-weight: 500;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(52, 152, 219, 0.3);
          border-radius: 50%;
          border-top-color: #3498db;
          animation: spin 1s linear infinite;
        }
        
        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-weight: 500;
        }
        
        .alert-error {
          background: #ffeaea;
          color: #c0392b;
          border: 1px solid #f5c6cb;
        }
        
        .alert-success {
          background: #e8f6ef;
          color: #27ae60;
          border: 1px solid #c8e6c9;
        }
        
        .alert-icon {
          font-size: 18px;
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #7f8c8d;
        }
        
        .empty-icon {
          font-size: 60px;
          margin-bottom: 16px;
        }
        
        .empty-state h3 {
          margin: 0;
          color: #2c3e50;
        }
        
  .partidas-list { display: flex; flex-direction: column; gap: 16px; }
  .partida-card { justify-content: space-between; background: white; border-radius: 12px; padding: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e9ecef; transition: all 0.3s; position: relative; display: flex; flex-direction: row; align-items: center; gap: 16px; width: 98%; min-width: 340px; max-width: 100%; margin: 0 auto; }
  .partida-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05); }
  .partida-card.blocked { opacity: 0.7; background: #f8f9fa; }
  .match-header { display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; margin-bottom: 0; gap: 8px; min-width: 120px; }
  .match-header-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .match-badge { padding: 4px 12px; border-radius: 999px; background: #eff6ff; color: #3a86ff; font-weight: 600; font-size: 14px; border: 1px solid #dbeafe; }
  .match-date-badge { padding: 4px 10px; border-radius: 999px; background: #f7fafc; color: #4a5568; font-weight: 600; font-size: 13px; border: 1px solid #edf2f7; }
  .match-date-badge .date-icon { margin-right: 6px; }
  .match-meta { display: flex; align-items: center; gap: 8px; }
  .match-status { display: flex; gap: 8px; flex-wrap: wrap; }
  .team { display: flex; flex-direction: column; align-items: center; flex: 1; }
  .team-name { font-weight: 700; font-size: 16px; text-align: center; }
  .home-team .team-name { color: #3a86ff; }
  .away-team .team-name { color: #ff006e; }
  .match-content { display: flex; flex-direction: row; justify-content: center; align-items: center; margin-bottom: 0; gap: 12px; }
  .match-center { display: none; }
  .bet-options { display: flex; flex-direction: row; gap: 8px; min-width: 110px; justify-content: flex-end; }
  .bet-btn { flex: 0 0 var(--bet-width); width: var(--bet-width); display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s; position: relative; min-height: 80px; }
  .bet-btn:hover:not(:disabled) { border-color: #3a86ff; transform: translateY(-2px); }
  .bet-btn.selected { border-color: #3a86ff; background: #eff6ff; }
  .bet-btn.empate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .bet-btn.empate.selected { border-color: #f59e0b; background: #fffbeb; }
  .bet-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .empate-icon {
    font-size: 28px;
    font-weight: 800;
    color: #f59e0b;
    display: block;
    margin: 0 auto 2px auto;
  }
        .btn-text {
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
          display: block;
        }
        
        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .finalizada-badge {
          background: #ffeaa7;
          color: #d35400;
        }
        
        .resultado-badge {
          background: #d5f5e3;
          color: #27ae60;
        }
        
        .match-content {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 16px;
          flex: 1;
        }
        
        .result-options {
          display: flex;
          gap: 12px;
          flex: 1;
          flex-wrap: wrap;
        }
        
        .result-option {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          transition: all 0.3s;
          min-width: 120px;
        }
        
        .result-option:hover:not(:disabled) {
          border-color: #3498db;
          transform: translateY(-2px);
        }
        
        .result-option.selected {
          border-color: #27ae60;
          background: #e8f6ef;
          color: #27ae60;
        }
        
        .result-option.empate.selected {
          border-color: #f39c12;
          background: #fef9e7;
          color: #f39c12;
        }
        
        .result-option:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .option-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .option-bet {
          font-weight: 800;
          font-size: 18px;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        
        .modal {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          max-width: 450px;
          width: 100%;
          overflow: hidden;
          animation: slideUp 0.3s ease;
        }
        
        .modal-confirm {
          max-width: 400px;
        }
        
        .modal-header {
          padding: 20px 24px 0;
        }
        
        .modal-header h3 {
          margin: 0;
          color: #2c3e50;
          font-size: 20px;
        }
        
        .modal-body {
          padding: 20px 24px;
          text-align: center;
        }
        
        .modal-body p {
          margin: 16px 0 0;
          color: #2c3e50;
          line-height: 1.5;
        }
        
        .success-icon, .warning-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .modal-footer {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @media (max-width: 768px) {
          .lancar-resultado-container {
            margin: 0 16px;
            border-radius: 12px;
          }
          
          .soccer-field-banner {
            height: 140px;
          }
          
          .main-title {
            font-size: 24px;
          }
          
          .content-wrapper {
            padding: 16px;
          }
          
          .controls-container {
            flex-direction: column;
            align-items: stretch;
          }
          
          .select-group {
            flex-direction: column;
            align-items: stretch;
          }
          
          .teams {
            flex-direction: column;
            gap: 12px;
          }
          
          .match-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .match-content {
            flex-direction: column;
          }
          
          .result-options {
            flex-direction: column;
          }
          
          .modal-footer {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}