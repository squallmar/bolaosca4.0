import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from './services/api';
import './RankingList.css'; // Vamos mover os estilos para um arquivo separado
import { API_BASE } from './config';

// Componente auxiliar para exibir o avatar de forma robusta
function UserAvatar({ user, size = 56 }) {
  const pick = (x) => (x && String(x).trim()) || '';
  const raw = pick(user.foto_url) || pick(user.fotoUrl) || pick(user.avatar_url) || pick(user.avatarUrl);
  const initials = (user.nome || 'U').charAt(0).toUpperCase();
  

  if (raw && /^https?:\/\/res\.cloudinary\.com\//i.test(raw)) {
    return (
      <img
        src={raw}
        alt={user.displayName || user.nome}
        width={size}
        height={size}
        style={style}
        onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757738470/avatar_default_lwtnzu.jpg'; }}
      />
    );
  }

  // Se a URL estiver vazia, exibe as iniciais
  return (
    <div style={{ ...style, backgroundColor: '#ddd', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2em', fontWeight: 'bold' }}>
      {initials}
    </div>
  );
}

// tenta uma lista de URLs em sequência
async function tryGetFirst(urls) {
  let lastErr;
  for (const url of urls) {
    try {
      const { data } = await api.get(url);
      return data;
    } catch (e) {
      lastErr = e;
      if (e?.response?.status !== 404) break;
    }
  }
  throw lastErr;
}

function getInitials(texto = '') {
  const parts = String(texto).trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || 'U';
}

function normalizeRanking(list = []) {
  return (list || []).map((it) => {
    const nome = it.nome || 'Usuário';
    const apelido = (it.apelido || '').trim();
    const displayName = apelido || nome;
    return {
      ...it,
      nome,
      apelido,
      displayName,
      fotoUrl: it.foto_url || it.fotoUrl || '',
      pontos: Number(it.pontos) || 0,
      banido: !!it.banido,
      desistiu: !!it.desistiu,
    };
  });
}

// Componentes auxiliares para melhor performance
const Medal = React.memo(({ pos }) => {
  if (pos === 1) return <img src="/medals/gold.png" alt="1º Lugar" className="medal-icon" />;
  if (pos === 2) return <img src="/medals/silver.png" alt="2º Lugar" className="medal-icon" />;
  if (pos === 3) return <img src="/medals/bronze.png" alt="3º Lugar" className="medal-icon" />;
  if (pos === 4) return <img src="/medals/4pessoas.png" alt="4º Lugar" className="medal-icon" />;
  return <span className="position-number">{pos}º</span>;
});

const StatusTag = React.memo(({ banido, desistiu }) => {
  if (banido) return <span className="status-tag banido">Banido</span>;
  if (desistiu) return <span className="status-tag desistiu">Desistiu</span>;
  return null;
});

const Avatar = React.memo(({ nome, fotoUrl }) => {
  const iniciais = getInitials(nome);
  const [src, setSrc] = useState('');

  useEffect(() => {
    let u = String(fotoUrl || '').trim();
    if (!u) {
      setSrc(`${API_BASE}/uploads/avatars/avatar_default.jpg`);
      return;
    }
    if (u.includes(';')) {
      const parts = u.split(';').map(s => s.trim()).filter(Boolean);
      u = parts[parts.length - 1];
    }
    if (u.startsWith('http://') || u.startsWith('https://')) {
      setSrc(u);
      return;
    }
    const filename = u.split('/').pop();
    setSrc(`${API_BASE}/uploads/avatars/${filename || 'avatar_default.jpg'}`);
  }, [fotoUrl]);

  if (!src) {
    return <div className="avatar-initials" aria-label={nome}>{iniciais}</div>;
  }

  return (
    <img
      src={src}
      alt={`Avatar de ${nome}`}
      className="avatar-img"
      onError={(e) => {
        if (!e.currentTarget.dataset.fallback) {
          e.currentTarget.dataset.fallback = '1';
          setSrc(`${API_BASE}/uploads/avatars/avatar_default.jpg`);
        } else {
          // como último recurso, volta para iniciais
          setSrc('');
        }
      }}
    />
  );
});

export default function RankingList() {
  const [rodadas, setRodadas] = useState([]);
  const [rodadaId, setRodadaId] = useState('');
  const [rodadaAtualId, setRodadaAtualId] = useState('');
  const [ranking, setRanking] = useState([]);
  const [rankingGeral, setRankingGeral] = useState([]);
  const [modo, setModo] = useState('rodada');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [bolaoId, setBolaoId] = useState('');
  const [campeonatoId, setCampeonatoId] = useState('');
  const [ano, setAno] = useState('');
  const [boloes, setBoloes] = useState([]);
  const [campeonatos, setCampeonatos] = useState([]);

  // Carrega bolões
  useEffect(() => {
    (async () => {
      try {
        let data;
        try {
          ({ data } = await api.get('/bolao/listar'));
        } catch {
          ({ data } = await api.get('/listar'));
        }
        const list = Array.isArray(data) ? data : (data?.boloes || data || []);
        const norm = list.map(b => ({
          id: b.id ?? b.bolao_id ?? b.bolaoId,
          nome: b.nome ?? b.titulo ?? `Bolão ${b.id ?? ''}`,
        })).filter(b => b.id);
        setBoloes(norm);
      } catch {
        setBoloes([]);
      }
    })();
  }, []);

  // Carrega campeonatos
  useEffect(() => {
    (async () => {
      try {
        let data;
        try {
          ({ data } = await api.get('/bolao/campeonatos-todos'));
        } catch {
          ({ data } = await api.get('/campeonatos-todos'));
        }
        const list = Array.isArray(data) ? data : (data?.campeonatos || data || []);
        const norm = list.map(c => ({
          id: c.id ?? c.campeonato_id ?? c.campeonatoId,
          nome: c.nome ?? c.titulo ?? `Campeonato ${c.id ?? ''}`,
          ano: c.ano ?? c.temporada ?? c.year ?? '',
          bolaoId: c.bolao_id ?? c.bolaoId ?? c.bolao ?? '',
        })).filter(c => c.id);
        setCampeonatos(norm);
      } catch {
        setCampeonatos([]);
      }
    })();
  }, []);

  const campeonatosDoBolao = useMemo(
    () => (!bolaoId ? campeonatos : campeonatos.filter(c => String(c.bolaoId) === String(bolaoId))),
    [campeonatos, bolaoId]
  );

  const anosDoFiltro = useMemo(() => {
    const set = new Set(campeonatosDoBolao.map(c => c.ano).filter(Boolean));
    return Array.from(set).sort((a, b) => Number(b) - Number(a)); // Ordem decrescente
  }, [campeonatosDoBolao]);

  const onChangeBolao = useCallback((e) => {
    const v = e.target.value;
    setBolaoId(v);
    setCampeonatoId('');
    setAno('');
  }, []);

  const onChangeCampeonato = useCallback((e) => {
    const v = e.target.value;
    setCampeonatoId(v);
    const sel = campeonatosDoBolao.find(c => String(c.id) === String(v));
    if (sel?.ano) setAno(String(sel.ano));
  }, [campeonatosDoBolao]);

  // Carrega rodadas
  useEffect(() => {
    (async () => {
      setErro('');
      try {
        const { data } = await api.get('/bolao/rodadas-todas');
        const lista = Array.isArray(data) ? data : (data?.rodadas || []);
        setRodadas(lista);
        // escolhe a rodada atual como a de MAIOR id ainda não finalizada
        const abertas = lista.filter(r => !r.finalizada && !r.finalizado);
        const naoFinal = abertas.length
          ? abertas.reduce((acc, cur) => (Number(cur.id) > Number(acc.id) ? cur : acc), abertas[0])
          : null;
        // se todas finalizadas pega a de maior id
        const maior = lista.length ? lista.reduce((acc, cur) => (Number(cur.id) > Number(acc.id) ? cur : acc), lista[0]) : null;
        const atual = (naoFinal?.id ?? maior?.id) || '';
        setRodadaAtualId(atual);
        if (!rodadaId && atual) setRodadaId(atual);
      } catch (e) {
        setErro(`Erro ao carregar rodadas${e?.response?.status ? ` (HTTP ${e.response.status})` : ''}`);
      }
    })();
  }, [rodadaId]);

  // Carrega ranking da rodada selecionada
  useEffect(() => {
    if (!rodadaId) return;
    if (modo !== 'rodada') return;
    
    (async () => {
      setLoading(true);
      setErro('');
      setAviso('');
      try {
        const urls = [
          `/palpite/ranking/rodada/${rodadaId}`,
          `/palpite/ranking/rodada?id=${rodadaId}`,
          `/ranking/rodada/${rodadaId}`,
          `/ranking/rodada?id=${rodadaId}`,
          `/palpite/ranking/${rodadaId}`,
        ];
        const raw = await tryGetFirst(urls);
        const data = Array.isArray(raw) ? raw : (raw?.ranking || raw || []);
        const norm = normalizeRanking(data);
        norm.sort((a, b) => b.pontos - a.pontos || String(a.displayName).localeCompare(String(b.displayName)));
        setRanking(norm);
        if (String(rodadaId) === String(rodadaAtualId)) setAviso('Rodada atual');
      } catch (e) {
        console.error('Ranking rodada erro:', e?.response || e);
        const status = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
        setErro(`Erro ao carregar ranking da rodada${status}`);
        setRanking([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [rodadaId, modo, rodadaAtualId]);

  // Geral com filtros
  useEffect(() => {
    if (modo !== 'geral') return;
    
    (async () => {
      setLoading(true);
      setErro('');
      setAviso('');
      try {
        const { data } = await api.get('/palpite/ranking/geral', {
          params: {
            bolaoId: bolaoId || undefined,
            campeonatoId: campeonatoId || undefined,
            ano: ano || undefined,
          }
        });
        const norm = normalizeRanking(Array.isArray(data) ? data : (data?.ranking || data || []));
        norm.sort((a, b) => b.pontos - a.pontos || String(a.displayName).localeCompare(String(b.displayName)));
        setRankingGeral(norm);
        if (bolaoId || campeonatoId || ano) setAviso('Filtrado no Ranking Geral.');
      } catch (e) {
        setAviso('Ranking geral indisponível.');
        setRankingGeral([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [modo, bolaoId, campeonatoId, ano]);

  const listaExibida = useMemo(() => (modo === 'rodada' ? ranking : rankingGeral), [modo, ranking, rankingGeral]);

  const posLabel = useCallback((pos) => {
    if (pos === 1) return 'Campeão';
    if (pos === 2) return 'Vice';
    if (pos === 3) return '3º Lugar';
    if (pos === 4) return '4º Lugar';
    return `${pos}º Lugar`;
  }, []);

  const RankingItem = React.memo(({ usuario, posicao }) => {
    const isTop3 = posicao <= 3;
    
    return (
      <div className={`ranking-item ${isTop3 ? 'top-three' : ''}`}>
        <div className="position">
          <Medal pos={posicao} />
          <div className="pos-label">{posLabel(posicao)}</div>
        </div>
        <div className="user-info">
          <div className="ranking-item-avatar">
            <UserAvatar user={usuario} size={50} />
          </div>
          <div className="user-details">
            <div className="username">
              {usuario.displayName}
            </div>
            <StatusTag banido={usuario.banido} desistiu={usuario.desistiu} />
            {usuario.nome && usuario.apelido && usuario.apelido !== usuario.nome && (
              <div className="fullname">
                {usuario.nome}
              </div>
            )}
          </div>
        </div>
        <div className="points">
          <span className="points-value">{usuario.pontos}</span>
          <span className="points-label">pontos</span>
        </div>
      </div>
    );
  });

  return (
    <div className="ranking-container">
      <div className="ranking-header">
        <div className="trophy-banner">
          <h1 className="main-title">{modo === 'rodada' ? 'Ranking da Rodada' : 'Ranking Geral'}</h1>
          <img src="/trofeu.png" alt="Troféu" className="trophy-overlay" />
        </div>

        <div className="mode-selector">
          <button
            onClick={() => setModo('rodada')}
            className={`mode-btn ${modo === 'rodada' ? 'active' : ''}`}
            aria-pressed={modo === 'rodada'}
          >
            <span className="mode-icon">⚽</span>
            Rodada
          </button>
          <button
            onClick={() => setModo('geral')}
            className={`mode-btn ${modo === 'geral' ? 'active' : ''}`}
            aria-pressed={modo === 'geral'}
          >
            <span className="mode-icon">🏆</span>
            Geral
          </button>
        </div>
      </div>

      <div className="content-wrapper">
        {modo === 'rodada' && (
          <div className="filter-section">
            <div className="filter-group">
              <label htmlFor="rodada" className="filter-label">
                <span className="filter-icon">📅</span>
                Selecione a Rodada:
              </label>
              <select 
                id="rodada" 
                value={rodadaId} 
                onChange={(e) => setRodadaId(e.target.value)} 
                className="filter-select"
                aria-label="Selecionar rodada"
              >
                {rodadas.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.nome || `Rodada ${r.id}`}
                    {String(r.id) === String(rodadaAtualId) ? ' (Atual)' : ''}
                  </option>
                ))}
              </select>

              {rodadaId && String(rodadaId) === String(rodadaAtualId) && (
                <div className="status-badge current inline">
                  <span className="badge-icon">🔥</span>
                  Rodada Atual
                </div>
              )}
            </div>
          </div>
        )}
        
        {modo === 'geral' && (
          <div className="filter-section">
            <div className="filter-grid">
              <div className="filter-item">
                <label htmlFor="bolao" className="filter-label">Bolão</label>
                <select id="bolao" value={bolaoId} onChange={onChangeBolao} className="filter-select">
                  <option value="">Todos os Bolões</option>
                  {boloes.map(b => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-item">
                <label htmlFor="campeonato" className="filter-label">Campeonato</label>
                <select id="campeonato" value={campeonatoId} onChange={onChangeCampeonato} className="filter-select">
                  <option value="">Todos os Campeonatos</option>
                  {campeonatosDoBolao.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.ano ? `(${c.ano})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="filter-item">
                <label htmlFor="ano" className="filter-label">Ano</label>
                <select id="ano" value={ano} onChange={(e) => setAno(e.target.value)} className="filter-select">
                  <option value="">Todos os Anos</option>
                  {anosDoFiltro.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {aviso && (
          <div className="alert info">
            <span className="alert-icon">💡</span>
            {aviso}
          </div>
        )}
        
        {erro && (
          <div className="alert error">
            <span className="alert-icon">⚠️</span>
            {erro}
          </div>
        )}
        
        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Carregando ranking...</span>
          </div>
        )}

        {!loading && listaExibida.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🏆</div>
            <h3>Nenhum participante no ranking</h3>
            <p>Quando houver apostas, os participantes aparecerão aqui</p>
          </div>
        )}

        <div className="ranking-list">
          {listaExibida.map((usuario, idx) => (
            <RankingItem 
              key={usuario.id ?? `${usuario.displayName}-${idx}`} 
              usuario={usuario} 
              posicao={idx + 1} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}