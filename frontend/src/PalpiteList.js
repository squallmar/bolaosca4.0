import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from './services/api';

import { API_BASE as API } from './config';

// Função para gerar slug
function slugify(nome = '') {
  return String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ApostarRodada() {
  const [rodadas, setRodadas] = useState([]);
  const [rodadaId, setRodadaId] = useState('');
  const [rodadaAtualId, setRodadaAtualId] = useState('');
  const [partidas, setPartidas] = useState([]);
  const [palpites, setPalpites] = useState({});
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [timesMap, setTimesMap] = useState({}); // slug(nome) => escudo_url
  const [weekendLocked, setWeekendLocked] = useState(false);
  const [lockInfo, setLockInfo] = useState({ locked: false, weekend: false, pending: false });
  const [editando, setEditando] = useState({}); // controla edição por partida
  const [lockCountdown, setLockCountdown] = useState(''); // texto com tempo restante até fechamento
  const [lockChrono, setLockChrono] = useState(''); // cronômetro HH:MM:SS

  // Carrega times do backend
  useEffect(() => {
    async function loadTimes() {
      try {
  const { data } = await api.get(`/times`);
        const arr = Array.isArray(data.items) ? data.items : [];
        const map = {};
        for (const t of arr) {
          const key = slugify(t.nome || t.name || '');
          if (key) map[key] = t.escudo_url || t.escudoUrl || '';
        }
        setTimesMap(map);
      } catch (e) {
        // silencioso
      }
    }
    loadTimes();
  }, []);

  // Função para pegar escudo pelo nome
  const escudoByNome = useCallback((nome) => {
    const key = slugify(nome || '');
    return (timesMap[key] && timesMap[key].trim())
      ? timesMap[key]
      : `${API}/uploads/escudos/_default.png`;
  }, [timesMap]);

  const carregarRodadas = useCallback(async () => {
    try {
  const { data } = await api.get('/bolao/rodadas-todas');
      const lista = Array.isArray(data) ? data : (data?.rodadas || []);
      // Ordena por id ASC para previsibilidade
      const ordenadas = [...lista].sort((a,b) => Number(a.id) - Number(b.id));
      setRodadas(ordenadas);
      // Seleciona a rodada aberta (não finalizada) de MAIOR id
      const abertas = ordenadas.filter(r => !r.finalizada && !r.finalizado);
      const naoFinal = abertas.length
        ? abertas.reduce((acc, cur) => (Number(cur.id) > Number(acc.id) ? cur : acc), abertas[0])
        : null;
      // Se todas finalizadas, usa a de maior id como referência atual
      const maior = ordenadas.length
        ? ordenadas.reduce((acc, cur) => (Number(cur.id) > Number(acc.id) ? cur : acc), ordenadas[0])
        : null;
      const atual = (naoFinal?.id ?? maior?.id) || '';
      setRodadaAtualId(atual);
      if (!rodadaId && atual) setRodadaId(atual);
    } catch (e) {
      setErro('Erro ao carregar rodadas');
    }
  }, [rodadaId]);

  const carregarPartidas = useCallback(async (rid) => {
    if (!rid) return;
    setLoading(true);
    setErro('');
    setOk('');
    try {
  const { data } = await api.get(`/bolao/rodada/${rid}/partidas`);
      const lista = Array.isArray(data) ? data : (data?.partidas || []);
      // marca client-side se já começou
      const now = Date.now();
      const norm = lista.map(p => {
        let ts = null;
        try {
          if (typeof p.data === 'number') ts = p.data;
          else if (p.data && /^\d+$/.test(String(p.data))) ts = parseInt(p.data, 10);
          else if (p.data) ts = new Date(String(p.data).replace(' ', 'T')).getTime();
        } catch {}
        const started = ts && !isNaN(ts) ? ts <= now : false;
        return { ...p, _started: started };
      });
      setPartidas(norm);
    } catch (e) {
      setErro('Erro ao carregar partidas');
      setPartidas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarMeusPalpites = useCallback(async (rid) => {
    try {
  const { data } = await api.get(`/palpite/meus/${rid}`);
      const arr = Array.isArray(data) ? data : [];
      const map = {};
      for (const p of arr) map[p.partida_id] = String(p.palpite || '').toLowerCase();
      setPalpites(map);
    } catch {
      setPalpites({});
    }
  }, []);

  useEffect(() => { carregarRodadas(); }, [carregarRodadas]);
  // Atualiza flag de bloqueio global (preferindo backend /palpite/lock)
  useEffect(() => {
    function computeLock() {
      // fallback local
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const localLocked = (day === 6 && hour >= 14) || (day === 0);
      setWeekendLocked(localLocked);
    }
    async function pollServer() {
      try {
  const { data } = await api.get('/palpite/lock');
        setLockInfo(data || {});
        if (typeof data?.locked === 'boolean') setWeekendLocked(!!data.locked);
      } catch {
        computeLock();
      }
    }
    computeLock();
    pollServer();
    const id = setInterval(() => { computeLock(); pollServer(); }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Contagem regressiva até sábado 13:59 (fechamento) quando ainda aberto
  useEffect(() => {
    function updateCountdown() {
      if (weekendLocked) { setLockCountdown(''); return; }
      const now = new Date();
      // Próximo sábado 13:59 local
      const target = (() => {
        const n = new Date(now);
        const day = n.getDay();
        // Se hoje é sábado
        if (day === 6) {
          const sameDayTarget = new Date(now);
            sameDayTarget.setHours(13,59,0,0);
          if (now <= sameDayTarget) return sameDayTarget; // ainda antes do corte hoje
          // já passou do corte: pega sábado da semana seguinte
          const next = new Date(now);
          next.setDate(next.getDate() + 7);
          next.setHours(13,59,0,0);
          return next;
        }
        // Dias até sábado (6)
        const diffDays = (6 - day + 7) % 7; // 0..6
        const t = new Date(now);
        t.setDate(t.getDate() + diffDays);
        t.setHours(13,59,0,0);
        return t;
      })();
      const ms = target - now;
      if (ms <= 0) { setLockCountdown(''); return; }
      const totalMin = Math.floor(ms / 60000);
      const dias = Math.floor(totalMin / (60*24));
      const horas = Math.floor((totalMin % (60*24)) / 60);
      const mins = totalMin % 60;
      let parts = [];
      if (dias) parts.push(dias + (dias === 1 ? ' dia' : ' dias'));
      if (horas) parts.push(horas + 'h');
      if (mins && dias === 0) parts.push(mins + 'm');
      if (!parts.length) parts = ['< 1m'];
      setLockCountdown(parts.join(' '));
    }
    updateCountdown();
    const id = setInterval(updateCountdown, 60 * 1000);
    return () => clearInterval(id);
  }, [weekendLocked]);

  // Cronômetro em segundos (HH:MM:SS) até sábado 13:59
  useEffect(() => {
    let interval;
    function pad(n){return String(n).padStart(2,'0');}
    function computeTarget(now){
      const day = now.getDay();
      if (day === 6) { // sábado
        const t = new Date(now);
        t.setHours(13,59,0,0);
        if (now <= t) return t;
        const nxt = new Date(now); nxt.setDate(nxt.getDate()+7); nxt.setHours(13,59,0,0); return nxt;
      }
      const diffDays = (6 - day + 7) % 7;
      const target = new Date(now);
      target.setDate(target.getDate()+diffDays);
      target.setHours(13,59,0,0);
      return target;
    }
    function tick(){
      if (weekendLocked){ setLockChrono(''); return; }
      const now = new Date();
      const target = computeTarget(now);
      let ms = target - now;
      if (ms <= 0){ setLockChrono('00:00:00'); return; }
      const totalSec = Math.floor(ms/1000);
      const h = Math.floor(totalSec/3600);
      const m = Math.floor((totalSec%3600)/60);
      const s = totalSec%60;
      // Limita horas para mostrar até 99 (suficiente)
      const hh = h>99? '99' : pad(h);
      setLockChrono(`${hh}:${pad(m)}:${pad(s)}`);
    }
    tick();
    interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [weekendLocked]);
  useEffect(() => {
    if (!rodadaId) return;
    carregarPartidas(rodadaId);
    carregarMeusPalpites(rodadaId);
  }, [rodadaId, carregarPartidas, carregarMeusPalpites]);

  async function salvar(partida, valor) {
    setErro('');
    setOk('');
    setSaving(s => ({ ...s, [partida.id]: true }));
    try {
  await api.post(`/palpite/apostar/${partida.id}`, { palpite: valor });
      setPalpites(p => ({ ...p, [partida.id]: valor }));
      setOk('Palpite salvo! ⚽');
      setTimeout(() => setOk(''), 2500);
    } catch (e) {
      const status = e?.response?.status;
  if (status === 403) setErro('Você não está autorizado a apostar.');
  else if (status === 400) setErro(e.response?.data?.erro || 'Palpite inválido.');
  else if (status === 409) setErro(e.response?.data?.erro || 'Apostas fechadas para esta partida.');
      else setErro('Erro ao salvar palpite.');
    } finally {
      setSaving(s => ({ ...s, [partida.id]: false }));
    }
  }

  const rodadaAtual = useMemo(
    () => rodadas.find(r => String(r.id) === String(rodadaId)),
    [rodadas, rodadaId]
  );

  // Quantos jogos ainda faltam apostar (que não estão bloqueados e sem palpite)
  const faltandoJogos = useMemo(() => {
    if (!partidas.length) return 0;
    return partidas.filter(p => {
      const bloqueado = !!(weekendLocked || p.finalizada || p.finalizado || p.resultado || p._started || rodadaAtual?.finalizada);
      return !bloqueado && !palpites[p.id];
    }).length;
  }, [partidas, palpites, weekendLocked, rodadaAtual]);

  return (
    <div className="apostar-container">
      <div className="header-section">
        <div className="header-content">
          <h1 className="main-title">Fazer Apostas</h1>
          <p className="subtitle">Selecione uma rodada e faça seus palpites</p>
        </div>
        <div className="header-gradient"></div>
      </div>
      <div className={`apostas-aviso ${weekendLocked ? 'fechado' : ''}`}>
        <strong>{weekendLocked ? 'APOSTAS ENCERRADAS' : 'APOSTAS ABERTAS'}</strong>
        {!weekendLocked && lockCountdown && <span> • Fecham em {lockCountdown}</span>}
        {weekendLocked && <span> • Reabrem na segunda-feira.</span>}
        {!weekendLocked && lockChrono && (
          <div className="apostas-timer">
            <span className="label">Tempo restante:</span>
            <span className="cronometro" aria-label="Tempo restante para fechar apostas">{lockChrono}</span>
          </div>
        )}
        <div className="apostas-aviso-sub">Corte: sábado 13:59 (último minuto antes das 14h).</div>
      </div>
      <div className="content-wrapper">
        <div className="controls-section">
          <div className="select-card">
            <div className="select-header">
              <span className="select-icon">📅</span>
              <h3>Selecione a Rodada</h3>
            </div>
            <div className="select-content">
              <select 
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
              
              <div className="status-container">
                {rodadaId && String(rodadaId) === String(rodadaAtualId) && (
                  <div className="status-badge current">
                    <span className="badge-icon">🔥</span>
                    Rodada Atual
                  </div>
                )}
                
                {rodadaAtual?.finalizada && (
                  <div className="status-badge finished">
                    <span className="badge-icon">🔒</span>
                    Rodada Finalizada
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {erro && (
          <div className="alert error">
            <div className="alert-content">
              <span className="alert-icon">⚠️</span>
              <span>{erro}</span>
            </div>
          </div>
        )}
        {weekendLocked && (
          <div className="alert error">
            <div className="alert-content">
              <span className="alert-icon">🔒</span>
              <span>{lockInfo.pending ? 'Apostas bloqueadas: aguardando finalização da rodada pelo admin.' : 'Apostas fechadas (Depois das 14h, não é permitido alterar o palpite).'}</span>
            </div>
          </div>
        )}
        
        {ok && (
          <div className="alert success">
            <div className="alert-content">
              <span className="alert-icon">✅</span>
              <span>{ok}</span>
            </div>
          </div>
        )}
        
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <span>Carregando partidas...</span>
          </div>
        )}

        {!loading && !weekendLocked && !rodadaAtual?.finalizada && faltandoJogos > 0 && (
          <div className="faltando-bets-alert">
            <span className="icon">⏳</span>
            Faltam <strong>{faltandoJogos}</strong> {faltandoJogos === 1 ? 'jogo' : 'jogos'} para você apostar.
          </div>
        )}

        <div className="matches-grid">
          {partidas.map((p, idx) => {
            const bloqueado = !!(weekendLocked || p.finalizada || p.finalizado || p.resultado || p._started || rodadaAtual?.finalizada);
            const palpite = palpites[p.id];
            return (
              <div key={p.id} className={`match-card ${bloqueado ? 'blocked' : ''}`}>
                <div className="match-header">
                  <div className="match-badge">Jogo {idx + 1}</div>
                  {weekendLocked && (
                    <div className="status-badge finished">
                      <span className="badge-icon">🔒</span>
                      {lockInfo?.pending ? 'Aguardando finalização da rodada (admin)' : 'Apostas fechadas (Encerrada as 14h.)'}
                    </div>
                  )}
                  {p._started && (
                    <div className="status-badge started">
                      <span className="badge-icon">🔒</span>
                      Apostas fechadas
                    </div>
                  )}
                  {p.resultado && (() => {
                    const raw = String(p.resultado).trim();
                    const key = raw.toLowerCase();
                    let resultLabel;
                    if (key === 'time1') resultLabel = p.time1;
                    else if (key === 'time2') resultLabel = p.time2;
                    else if (key === 'empate' || key === 'draw') resultLabel = 'Empate';
                    else resultLabel = raw; // fallback

                    let palpiteExtra = null;
                    if (palpite) {
                      let palpiteText;
                      if (palpite === 'time1') palpiteText = p.time1;
                      else if (palpite === 'time2') palpiteText = p.time2;
                      else if (palpite === 'empate') palpiteText = 'Empate';
                      else palpiteText = palpite;
                      const acertou = (
                        (palpite === 'time1' && key === 'time1') ||
                        (palpite === 'time2' && key === 'time2') ||
                        (palpite === 'empate' && (key === 'empate' || key === 'draw'))
                      );
                      palpiteExtra = (
                        <span className={`palpite-status ${acertou ? 'acertou' : 'errou'}`}>{acertou ? 'Acertou!' : `Seu palpite: ${palpiteText}`}</span>
                      );
                    } else {
                      palpiteExtra = (
                        <span className="palpite-status nao-apostou">Você não apostou nesse jogo</span>
                      );
                    }
                    return (
                      <div className="result-badge">
                        <span className="result-icon">🏆</span>
                        Resultado: {resultLabel} {palpite && palpiteExtra && <span className="divider">•</span>} {palpiteExtra}
                      </div>
                    );
                  })()}

                  {palpite && !editando[p.id] && (
                    <div className="palpite-info">
                      {palpite === 'time1' && `Editar Palpite: ${p.time1}`}
                      {palpite === 'time2' && `Editar Palpite: ${p.time2}`}
                      {palpite === 'empate' && `Editar Palpite: Empate`}
                      <button className="btn-editar-palpite" onClick={() => setEditando(e => ({...e, [p.id]: true}))} disabled={bloqueado} style={{marginLeft:8}}>Editar</button>
                    </div>
                  )}
                  {editando[p.id] && (
                    <div className="palpite-info">Selecione um novo palpite abaixo e clique para salvar.</div>
                  )}
                </div>

                <div className="match-content">
                  <div className="team home-team">
                    <img
                      className="team-logo"
                      src={escudoByNome(p.time1)}
                      alt={p.time1}
                      onError={(e)=>{ e.currentTarget.src = `${API}/uploads/escudos/_default.png`; }}
                    />
                    <div className="team-name">{p.time1}</div>
                  </div>

                  <div className="match-center">
                    <div className="vs-circle">
                      <span>VS</span>
                    </div> 
                  </div>

                  <div className="team away-team">
                    <img
                      className="team-logo"
                      src={escudoByNome(p.time2)}
                      alt={p.time2}
                      onError={(e)=>{ e.currentTarget.src = `${API}/uploads/escudos/_default.png`; }}
                    />
                    <div className="team-name">{p.time2}</div>
                  </div>
                </div>

                <div className="bet-options">
                  <button
                    className={`bet-btn ${palpite === 'time1' ? 'selected' : ''}`}
                    disabled={bloqueado || saving[p.id] || (palpite && !editando[p.id])}
                    onClick={() => { salvar(p, 'time1'); setEditando(e => ({...e, [p.id]: false})); }}
                  >
                    {saving[p.id] && palpites[p.id] === 'time1' ? (
                      <div className="btn-loading"></div>
                    ) : (
                      <>
                        <img 
                          className="team-logo small" 
                          src={escudoByNome(p.time1)} 
                          alt={p.time1}
                          onError={(e)=>{ e.currentTarget.src = `${API}/uploads/escudos/_default.png`; }} 
                        />
                        <span className="btn-text">Vence</span>
                      </>
                    )}
                  </button>

                  <button
                    className={`bet-btn empate ${palpite === 'empate' ? 'selected' : ''}`}
                    disabled={bloqueado || saving[p.id] || (palpite && !editando[p.id])}
                    onClick={() => { salvar(p, 'empate'); setEditando(e => ({...e, [p.id]: false})); }}
                  >
                    {saving[p.id] && palpites[p.id] === 'empate' ? (
                      <div className="btn-loading"></div>
                    ) : (
                      <>
                        <span className="empate-icon">X</span>
                        <span className="btn-text">Empate</span>
                      </>
                    )}
                  </button>

                  <button
                    className={`bet-btn ${palpite === 'time2' ? 'selected' : ''}`}
                    disabled={bloqueado || saving[p.id] || (palpite && !editando[p.id])}
                    onClick={() => { salvar(p, 'time2'); setEditando(e => ({...e, [p.id]: false})); }}
                  >
                    {saving[p.id] && palpites[p.id] === 'time2' ? (
                      <div className="btn-loading"></div>
                    ) : (
                      <>
                        <img 
                          className="team-logo small" 
                          src={escudoByNome(p.time2)} 
                          alt={p.time2}
                          onError={(e)=>{ e.currentTarget.src = `${API}/uploads/escudos/_default.png`; }} 
                        />
                        <span className="btn-text">Vence</span>
                      </>
                    )}
                  </button>
                </div>

                {saving[p.id] && (
                  <div className="saving-overlay">
                    <span>Salvando...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && partidas.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">⚽</div>
            <h3>Nenhuma partida nesta rodada</h3>
            <p>Volte quando houver jogos disponíveis para apostar</p>
          </div>
        )}
      </div>

  <style>{`
        :root {
          --primary: #3a86ff;
          --primary-dark: #2563eb;
          --secondary: #ff006e;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --gray-100: #f7fafc;
          --gray-200: #edf2f7;
          --gray-300: #e2e8f0;
          --gray-400: #cbd5e0;
          --gray-500: #a0aec0;
          --gray-600: #718096;
          --gray-700: #4a5568;
          --gray-800: #2d3748;
          --gray-900: #1a202c;
          --radius: 12px;
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f8fafc;
          color: var(--gray-800);
          line-height: 1.5;
        }
        
        .apostar-container {
          max-width: 1000px;
          margin: 0 auto;
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }
        
        .header-section {
          position: relative;
          height: 165px;
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          padding: 20px;
          overflow: hidden;
        }
        
        .header-gradient {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
        }
        
        .header-content {
          position: relative;
          z-index: 2;
          text-align: center;
        }
        
        .main-title {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .subtitle {
          font-size: 1.125rem;
          opacity: 0.9;
          margin: 0;
          font-weight: 400;
        }

        /* Aviso Apostas */
        .apostas-aviso {
          margin: 18px 24px 0 24px;
          padding: 14px 18px 12px 18px;
          border-radius: 14px;
          background: linear-gradient(135deg,#fff8e1,#ffe9b0);
          border: 1px solid #fcd34d;
          box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          font-size: 15px;
          line-height: 1.35;
          color: #92400e;
          position: relative;
          overflow: hidden;
          animation: fadeIn .45s ease;
        }
        .apostas-aviso:before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(circle at 14% 18%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%);
          pointer-events:none;
        }
        .apostas-aviso strong {
          font-size: 13px;
          letter-spacing: .5px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .apostas-aviso.fechado {
          background: linear-gradient(135deg,#fee2e2,#fecaca);
          border-color: #f87171;
          color: #7f1d1d;
        }
        .apostas-aviso.fechado strong { color: #7f1d1d; }
        .apostas-aviso span { font-weight: 500; }
        .apostas-aviso-sub {
          font-size: 11px;
          opacity: .8;
          margin-top: 4px;
          letter-spacing: .3px;
        }
        .apostas-timer {
          margin-top: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.55);
          padding: 6px 10px;
          border-radius: 10px;
          font-weight: 600;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
        }
        .apostas-aviso.fechado .apostas-timer { display: none; }
        .apostas-timer .label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; opacity: .75; }
        .cronometro { font-family: 'JetBrains Mono','Roboto Mono',monospace; font-size: 15px; background:#1e3a8a; color:#fff; padding:4px 8px; border-radius:6px; letter-spacing:1px; box-shadow:0 1px 2px rgba(0,0,0,0.25); animation: pulseCrono 1s steps(2,end) infinite; }
        @keyframes pulseCrono { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
        .apostas-aviso:not(.fechado) strong:before {
          content: "⚡";
          font-size: 15px;
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15));
        }
        .apostas-aviso.fechado strong:before {
          content: "🔒";
          font-size: 16px;
        }
        .apostas-aviso:not(.fechado) {
          border-image: linear-gradient(90deg,#fcd34d,#fbbf24,#fcd34d) 1;
        }
        .apostas-aviso:not(.fechado):after {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg,#f59e0b,#fbbf24,#fcd34d,#f59e0b);
          background-size: 300% 100%;
          animation: barraMove 6s linear infinite;
        }
        .apostas-aviso.fechado:after {
          content: "";
          position: absolute; inset: 0;
          background: repeating-linear-gradient(45deg, rgba(127,29,29,0.05) 0 10px, rgba(127,29,29,0.12) 10px 20px);
          pointer-events:none;
          animation: fechadoPulse 2.8s ease-in-out infinite;
        }
        .apostas-aviso.fechado strong {
          animation: levePulse 2.2s ease-in-out infinite;
        }

        .faltando-bets-alert {
          margin: 12px 0 22px 0;
          background: linear-gradient(135deg,#e0f2fe,#bae6fd);
          border: 1px solid #7dd3fc;
          padding: 12px 16px;
          border-radius: 14px;
            display:flex;
            align-items:center;
            gap:10px;
          font-size: 15px;
          font-weight:500;
          color:#0c4a6e;
          box-shadow:0 2px 4px rgba(0,0,0,0.06);
          animation: fadeIn .35s ease;
        }
        .faltando-bets-alert .icon { font-size:20px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15)); }
        .faltando-bets-alert strong { font-weight:700; color:#075985; }

        @keyframes barraMove { to { background-position: 300% 0; } }
        @keyframes levePulse { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        @keyframes fechadoPulse { 0%,100% { opacity: .55; } 50% { opacity: .75; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        
        .content-wrapper {
          padding: 24px;
        }
        
        .controls-section {
          margin-bottom: 24px;
        }
        
        .select-card {
          background: white;
          border-radius: var(--radius);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        
        .select-header {
          background: var(--gray-100);
          padding: 16px 20px;
          border-bottom: 1px solid var(--gray-200);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .select-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--gray-800);
        }
        
        .select-icon {
          font-size: 24px;
        }
        
        .select-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        @media (min-width: 768px) {
          .select-content {
            flex-direction: row;
            align-items: center;
          }
        }
        
        .rodada-select {
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--gray-300);
          background: white;
          font-size: 16px;
          flex: 1;
          transition: all 0.2s;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
          background-size: 16px;
          appearance: none;
        }
        
        .rodada-select:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(58, 134, 255, 0.2);
        }
        
        .status-container {
          display: flex;
          gap: 8px;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          white-space: nowrap;
        }
        
        .status-badge.current {
          background: #fffbeb;
          color: #d97706;
          border: 1px solid #fcd34d;
        }
        
        .status-badge.finished {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fca5a5;
        }

        /* Palpite status badges */
        .result-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .result-badge .result-icon { font-size: 16px; }
        .palpite-status { font-weight: 600; }
        .palpite-status.acertou { color: #059669; }
        .palpite-status.errou { color: #dc2626; }
        .palpite-status.nao-apostou { color: #64748b; font-weight:500; }
        .result-badge .divider { opacity: .4; }
        
        .badge-icon {
          font-size: 16px;
        }
        
        .alert {
          padding: 16px;
          border-radius: var(--radius);
          margin-bottom: 20px;
          font-weight: 500;
        }
        
        .alert.error {
          background: #fef2f2;
          color: var(--error);
          border-left: 4px solid var(--error);
        }
        
        .alert.success {
          background: #f0fdf4;
          color: var(--success);
          border-left: 4px solid var(--success);
        }
        
        .alert-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .alert-icon {
          font-size: 20px;
        }
        
        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: var(--gray-600);
          font-weight: 500;
        }
        
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(58, 134, 255, 0.3);
          border-radius: 50%;
          border-top-color: var(--primary);
          animation: spin 1s linear infinite;
        }
        
        .matches-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        @media (min-width: 768px) {
          .matches-grid {
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          }
        }
        
        .match-card {
          justify-content: space-between;
            background: white;
            border-radius: var(--radius);
            padding: 12px;
            box-shadow: var(--shadow);
            border: 1px solid var(--gray-200);
            transition: all 0.3s;
            position: relative;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 16px;
            width: 98%;
            min-width: 340px;
            max-width: 100%;
            margin: 0 auto;
        }
        
        .match-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        
        .match-card.blocked {
          opacity: 0.7;
          background: var(--gray-100);
        }
        
        .match-header {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: flex-start;
          margin-bottom: 0;
          gap: 8px;
          min-width: 90px;
        }
        
        .match-badge {
          padding: 4px 12px;
          border-radius: 999px;
          background: #eff6ff;
          color: var(--primary);
          font-weight: 600;
          font-size: 14px;
          border: 1px solid #dbeafe;
        }
        
        .result-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          background: #ecfdf5;
          color: var(--success);
          font-size: 14px;
          font-weight: 600;
        }
        
        .result-icon {
          font-size: 16px;
        }
        
        .match-content {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          margin-bottom: 0;
          gap: 12px;
        }
        
        .team {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
        }
        
        .team-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          margin-bottom: 6px;
        }
        
        .team-name {
          font-weight: 700;
          font-size: 16px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
          margin: 0 auto;
        }
        
        .home-team .team-name {
          color: var(--primary);
        }
        
        .away-team .team-name {
          color: var(--secondary);
        }
        
        .match-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0 16px;
        }
        
        .vs-circle {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: var(--gray-100);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
          color: var(--gray-700);
          margin-bottom: 8px;
          border: 2px solid var(--gray-200);
        }
        
        .match-date {
          font-size: 14px;
          color: var(--gray-600);
        }
        
        .bet-options {
          display: flex;
          flex-direction: row;
          gap: 8px;
          min-width: 110px;
          justify-content: center;
        }
        
        .bet-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px;
          border: 2px solid var(--gray-200);
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          min-height: 80px;
        }
        
        .bet-btn:hover:not(:disabled) {
          border-color: var(--primary);
          transform: translateY(-2px);
        }
        
        .bet-btn.selected {
          border-color: var(--primary);
          background: #eff6ff;
        }
        
        .bet-btn.empate {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .bet-btn.empate.selected {
          border-color: var(--warning);
          background: #fffbeb;
        }
        
        .bet-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .team-logo.small {
          width: 44px;
          height: 44px;
        }
        
        .empate-icon {
          font-size: 28px;
          font-weight: 800;
          color: var(--warning);
          display: block;
          margin: 0 auto 2px auto;
        }
        
        .btn-text {
          font-weight: 600;
          font-size: 14px;
        }
        
        .btn-loading {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(58, 134, 255, 0.3);
          border-radius: 50%;
          border-top-color: var(--primary);
          animation: spin 1s linear infinite;
        }
        
        .saving-overlay {
          position: absolute;
          top: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          border: 2px solid var(--gray-200);
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          min-height: 48px;
          text-align: center;
          padding: 60px 20px;
          color: var(--gray-600);
          grid-column: 1 / -1;
        }
        
        .empty-icon {
          font-size: 60px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .empty-state h3 {
          margin: 0 0 8px 0;
          color: var(--gray-800);
          font-weight: 600;
        }
        
        .empty-state p {
          margin: 0;
          font-size: 16px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
            .apostar-container {
              margin: 0;
              border-radius: 0;
            }
            .header-section {
              height: 160px;
            }
            .main-title {
              font-size: 2rem;
            }
            .content-wrapper {
              padding: 16px;
            }
            .select-content {
              flex-direction: column;
              align-items: stretch;
            }
            .status-container {
              justify-content: center;
            }
            .match-content {
              flex-direction: row; /* Alinha os elementos horizontalmente */
              align-items: center; /* Centraliza os itens verticalmente */
              gap: 16px;
            }
            .match-center {
              display: flex; /* Adiciona display flex para o container do 'VS' */
              align-items: center; /* Centraliza verticalmente o 'VS' */
              justify-content: center; /* Centraliza horizontalmente o 'VS' */
            }
            .match-card {
              flex-direction: column;
              gap: 8px;
            }
            .bet-options {
              flex-direction: row;
              min-width: unset;
              gap: 8px;
            }
        }

        .palpite-info {
          margin-top: 6px;
          font-size: 15px;
          font-weight: 600;
          color: #1976d2;
          background: #eef5ff;
          border-radius: 8px;
          padding: 4px 10px;
          display: inline-block;
        }
        .info-time2 { color: #ff006e; background: #ffeaf4; }
        .info-time1 { color: #3a86ff; background: #eaf4ff; }
        .info-empate { color: #f59e0b; background: #fff7e6; }

        .btn-editar-palpite {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeeba;
          border-radius: 6px;
          padding: 2px 10px;
          font-size: 13px;
          font-weight: 600;
          margin-left: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-editar-palpite:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}