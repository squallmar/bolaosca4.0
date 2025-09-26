import React, { useEffect, useState } from 'react';
import axios from 'axios';
import api from './services/api';

// API Base URL
import { API_BASE } from './config';

function PartidaList() {
  const [partidas, setPartidas] = useState([]);
  const [rodadaId, setRodadaId] = useState('');
  const [msg, setMsg] = useState('');
  const [rodadas, setRodadas] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filtro de status (somente visualização)
  const [filtroStatus, setFiltroStatus] = useState('andamento'); // 'todos', 'andamento', 'finalizados'
  // Somente leitura: sem ações administrativas

  useEffect(() => {
    async function fetchRodadas() {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/bolao/rodadas-todas`);
        const rodadasData = Array.isArray(res.data) ? res.data : [];
        
        setRodadas(rodadasData);
        
        // Se não há rodada selecionada e temos rodadas disponíveis
        if (!rodadaId && rodadasData.length > 0) {
          // Tenta encontrar uma rodada ativa (não finalizada)
          const rodadaAtiva = rodadasData.find(r => !r.finalizada);
          if (rodadaAtiva) {
            setRodadaId(rodadaAtiva.id);
          } else {
            // Se não existir, usa a primeira
            setRodadaId(rodadasData[0].id);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar rodadas:", error);
        // Não mostra mensagem de erro para usuários comuns, apenas loga
      } finally {
        setLoading(false);
      }
    }
    fetchRodadas();
  }, []);

  async function fetchPartidas() {
    try {
      if (!rodadaId) return setPartidas([]);
      
      setLoading(true);
      const res = await axios.get(`${API_BASE}/bolao/rodada/${rodadaId}/partidas`);
      const partidasData = Array.isArray(res.data) ? res.data : [];
      
      // Filtra as partidas de acordo com o filtro de status
      let partidasFiltradas = partidasData;
      if (filtroStatus === 'andamento') {
        partidasFiltradas = partidasData.filter(p => !p.finalizada);
      } else if (filtroStatus === 'finalizados') {
        partidasFiltradas = partidasData.filter(p => p.finalizada);
      }
      
      // Organiza as partidas por status: primeiro os jogos em andamento
      partidasFiltradas.sort((a, b) => {
        if (!a.finalizada && b.finalizada) return -1;
        if (a.finalizada && !b.finalizada) return 1;
        
        // Ordenação secundária por data/hora, se disponível
        if (a.dataHora && b.dataHora) {
          return new Date(a.dataHora) - new Date(b.dataHora);
        }
        
        return 0;
      });
      
      setPartidas(partidasFiltradas);
    } catch (error) {
      console.error("Erro ao buscar partidas:", error);
      // Somente leitura: não exibe mensagens intrusivas
    } finally {
      setLoading(false);
    }
  }

  // Funções de criação/edição removidas (somente leitura)

  useEffect(() => {
    fetchPartidas();
  }, [rodadaId, filtroStatus]);

  // Função para gerar slug
  function slugify(nome = '') {
    return String(nome)
      .toLowerCase()
      .normalize('NFD').replace(/[-\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  // Função para pegar o escudo do time
  function escudoUrl(p, timeKey) {
    // Se vier escudo_url do backend, use ele
    if (p[`${timeKey}_escudo_url`]) return p[`${timeKey}_escudo_url`];
    // Fallback: slugify
    return `${API_BASE}/uploads/escudos/${slugify(p[timeKey])}.png`;
  }

  return (
    <div className="partidas-container">
      <button
        type="button"
        title="Voltar à página principal"
        onClick={() => window.history.back()}
        aria-label="Voltar"
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid rgb(224, 224, 224)',
          background: 'rgb(255, 255, 255)',
          color: 'rgb(44, 62, 80)',
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        ← Voltar
      </button>
      <h2 className="main-title">
        <span role="img" aria-label="Futebol">⚽</span> Partidas do Campeonato
      </h2>
      
      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Carregando jogos...</span>
        </div>
      )}
      
      <div className="filtros-container">
        <div className="rodada-selector">
          <label htmlFor="rodada-select">Rodada:</label>
          <select 
            id="rodada-select"
            value={rodadaId} 
            onChange={e => setRodadaId(e.target.value)}
            className="select-input"
          >
            <option value="">Selecione a rodada</option>
            {rodadas.map(r => (
              <option key={r.id} value={r.id}>
                {r.nome} {r.finalizada ? '(Finalizada)' : '(Em andamento)'}
              </option>
            ))}
          </select>
        </div>
        
        <div className="status-selector">
          <label htmlFor="status-select">Status:</label>
          <select
            id="status-select"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="select-input"
          >
            <option value="todos">Todos</option>
            <option value="andamento">Em andamento</option>
            <option value="finalizados">Finalizados</option>
          </select>
        </div>
      </div>
      
  {/* Somente leitura: sem criação de partidas */}
      <div className="partidas-list">
        {partidas.length === 0 ? (
          <div className="no-data-message">
            <span role="img" aria-label="Informação">ℹ️</span>
            {rodadaId ? 'Não há partidas disponíveis para esta rodada' : 'Selecione uma rodada para ver as partidas'}
          </div>
        ) : (
          partidas.map(p => (
            <div 
              key={p.id} 
              className={`partida-card ${p.finalizada ? 'finalizada' : 'em-andamento'}`}
            >
              <>
                  <div className="status-badge">
                    {p.finalizada ? 'Finalizado' : 'Em andamento'}
                  </div>
                  
                  <div className="partida-times">
                    <div className="time time1">
                      <img
                        className="team-logo"
                        src={p.escudo1 || `${API_BASE}/uploads/escudos/_default.png`}
                        alt={p.time1}
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, marginBottom: 4, background: '#fff', border: '1px solid #eef2f7' }}
                        onError={e => { e.currentTarget.src = `${API_BASE}/uploads/escudos/_default.png`; e.currentTarget.onerror = null; }}
                        loading="lazy"
                      />
                      <span className="time-nome">{p.time1}</span>
                    </div>
                    <div className="versus-container">
                      <span className="versus">VS</span>
                    </div>
                    <div className="time time2">
                      <img
                        className="team-logo"
                        src={p.escudo2 || `${API_BASE}/uploads/escudos/_default.png`}
                        alt={p.time2}
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, marginBottom: 4, background: '#fff', border: '1px solid #eef2f7' }}
                        onError={e => { e.currentTarget.src = `${API_BASE}/uploads/escudos/_default.png`; e.currentTarget.onerror = null; }}
                        loading="lazy"
                      />
                      <span className="time-nome">{p.time2}</span>
                    </div>
                  </div>
                  
                  <div className="partida-info">
                    {p.dataHora && (
                      <span className="partida-data">
                        <span role="img" aria-label="Calendário">📅</span> {new Date(p.dataHora).toLocaleDateString()} 
                        <span style={{ margin: '0 6px' }}>•</span>
                        <span role="img" aria-label="Relógio">⏰</span> {new Date(p.dataHora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                    {!p.dataHora && (
                      <span className="partida-data sem-data">
                        <span role="img" aria-label="Alerta">⚠️</span> Data não definida
                      </span>
                    )}
                  </div>
        </>
            </div>
          ))
        )}
      </div>
      
      {msg && <div className="message success">{msg}</div>}
      
  <style>{`
        .partidas-container {
          max-width: 1000px;
          margin: 40px auto;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          background: #fff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .main-title {
          text-align: center;
          color: #d32f2f;
          margin-bottom: 32px;
          font-size: 32px;
          letter-spacing: 1px;
          font-weight: 700;
          position: relative;
          padding-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .main-title:after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 200px;
          height: 4px;
          background: linear-gradient(90deg, #d32f2f, #ffcdd2);
          border-radius: 2px;
        }
        
  /* back-link CSS removido: usando estilo inline conforme solicitado */
        
        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: #d32f2f;
          font-weight: 500;
          gap: 12px;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(211, 47, 47, 0.3);
          border-radius: 50%;
          border-top-color: #d32f2f;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .filtros-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 24px;
          gap: 16px;
          flex-wrap: wrap;
        }
        
        .rodada-selector,
        .status-selector {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 200px;
        }
        
        .rodada-selector label,
        .status-selector label {
          margin-bottom: 8px;
          font-weight: 600;
          color: #555;
        }
        
        .select-input {
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #ddd;
          background: #f9f9f9;
          font-size: 15px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        .select-input:focus {
          outline: none;
          border-color: #d32f2f;
          box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.2);
        }
        
  /* Removidos estilos de criação/edição para modo somente leitura */
        
        .partidas-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .partida-card {
          padding: 20px;
          border-radius: 12px;
          position: relative;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          transition: transform 0.2s;
        }
        
        .partida-card:hover {
          transform: translateY(-2px);
        }
        
        .partida-card.em-andamento {
          background: linear-gradient(to right bottom, #e3f2fd, #bbdefb);
          border: 1px solid #90caf9;
        }
        
        .partida-card.finalizada {
          background: linear-gradient(to right bottom, #f5f5f5, #eeeeee);
          border: 1px solid #e0e0e0;
        }
        
        .status-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }
        
        .em-andamento .status-badge {
          background: #4caf50;
        }
        
        .finalizada .status-badge {
          background: #9e9e9e;
        }
        
        .partida-times {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 20px 0;
        }
        
        .time {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .time-nome {
          font-weight: 700;
          font-size: 24px;
          text-align: center;
        }
        
        .versus-container {
          padding: 0 16px;
        }
        
        .versus {
          font-weight: 700;
          color: #d32f2f;
          font-size: 24px;
        }
        
        .partida-info {
          text-align: center;
          color: #555;
          font-weight: 500;
          margin-bottom: 16px;
        }
        
        
        
        .no-data-message {
          padding: 40px 20px;
          text-align: center;
          background: #f5f5f5;
          border-radius: 8px;
          color: #666;
          font-style: italic;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        
        .no-data-message span {
          font-size: 24px;
        }
        
        .message {
          padding: 12px 16px;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: 500;
          text-align: center;
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
        
        .center-toast {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 9999;
          min-width: 320px;
          max-width: 90vw;
          text-align: center;
          font-size: 28px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.25);
          color: #fff;
          border: 2px solid #fff;
          border-radius: 16px;
          padding: 40px 50px;
          font-weight: 800;
          letter-spacing: 1px;
          animation: fadeIn 0.5s, pulsar 2.5s infinite;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .modal-success {
          background: #17632a;
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
        
        @media (max-width: 600px) {
          .partidas-container {
            padding: 16px;
            margin: 20px 12px;
          }
          
          .main-title {
            font-size: 24px;
          }
          
          .filtros-container {
            flex-direction: column;
          }
          
          .time-nome {
            font-size: 18px;
          }
          
          .versus {
            font-size: 18px;
          }
          
          /* admin-actions removido no modo somente leitura */
        }
        
        .partida-data {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        
        .sem-data {
          font-size: 14px;
          color: #f44336;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

export default PartidaList;
