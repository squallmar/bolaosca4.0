import api from '../services/api';

/**
 * Função utilitária para detectar rodada atual baseada em concentração temporal
 * Evita duplicação de código entre PalpiteList, RankingList e LancarResultado
 */

// Função auxiliar para encontrar rodada atual baseada em concentração temporal
export async function findCurrentRoundByDate(rodadas) {
  const agora = new Date();
  const agoraSP = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const mesAtual = agoraSP.toISOString().substring(0, 7); // "2025-10"
  
  const candidatas = [];
  
  for (const rodada of rodadas) {
    try {
      // Busca partidas da rodada
      const { data } = await api.get(`/bolao/rodada/${rodada.id}/partidas`);
      const partidas = Array.isArray(data) ? data : [];
      
      if (partidas.length === 0) continue;
      
      let temPartidaFutura = false;
      let temPartidaSemResultado = false;
      let jogosNoMesAtual = 0;
      let jogosComData = 0;
      let primeiraData = null;
      let ultimaData = null;
      
      // Analisa cada partida da rodada
      for (const p of partidas) {
        // Verifica se não tem resultado nem placar
        if (!p.resultado && !p.placar) {
          temPartidaSemResultado = true;
        }
        
        // Verifica se a data é futura
        if (p.data_jogo || p.data_partida) {
          const dataRaw = p.data_jogo || p.data_partida;
          const dataPartida = new Date(String(dataRaw).replace('T', ' ').replace('Z', ''));
          const dataPartidaSP = new Date(dataPartida.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
          const dataPartidaStr = dataPartidaSP.toISOString().substring(0, 19).replace('T', ' ');
          jogosComData++;
          
          if (dataPartidaSP >= agoraSP) {
            temPartidaFutura = true;
          }
          
          // Conta jogos no mês atual
          if (dataPartidaStr.substring(0, 7) === mesAtual) {
            jogosNoMesAtual++;
          }
          
          // Track range de datas
          if (!primeiraData || dataPartidaStr < primeiraData) {
            primeiraData = dataPartidaStr;
          }
          if (!ultimaData || dataPartidaStr > ultimaData) {
            ultimaData = dataPartidaStr;
          }
        }
      }
      
      // Só considera se tem partida futura OU sem resultado
      if (temPartidaFutura || temPartidaSemResultado) {
        // Calcula range em dias
        let rangeEmDias = 0;
        if (primeiraData && ultimaData) {
          const diff = new Date(ultimaData) - new Date(primeiraData);
          rangeEmDias = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
        
        // Calcula score de concentração temporal
        const percentualNoMesAtual = jogosComData > 0 ? (jogosNoMesAtual / jogosComData) : 0;
        const concentracaoTemporal = rangeEmDias > 0 ? Math.max(0, 1 - (rangeEmDias / 365)) : 1;
        const scoreConcentracao = (percentualNoMesAtual * 0.7) + (concentracaoTemporal * 0.3);
        
        candidatas.push({
          rodadaId: String(rodada.id),
          scoreConcentracao,
          jogosNoMesAtual,
          jogosComData,
          rangeEmDias
        });
      }
    } catch (e) {
      // Se erro ao buscar partidas, continua para próxima rodada
      continue;
    }
  }
  
  // Ordena por score de concentração (maior = melhor)
  candidatas.sort((a, b) => b.scoreConcentracao - a.scoreConcentracao);
  
  return candidatas.length > 0 ? candidatas[0].rodadaId : null;
}

/**
 * Carrega rodadas e detecta automaticamente a rodada atual
 * usando a mesma lógica de concentração temporal do PalpiteList
 */
export async function carregarRodadasComDeteccaoAtual() {
  try {
    const { data } = await api.get('/bolao/rodadas-todas');
    const lista = Array.isArray(data) ? data : (data?.rodadas || []);
    // Ordena por id ASC para previsibilidade
    const ordenadas = [...lista].sort((a,b) => Number(a.id) - Number(b.id));
    
    let rodadaAtualId = '';
    
    // Preferir rodada-atual do backend (timezone São Paulo)
    try {
      const r = await api.get('/bolao/rodada-atual');
      const atualSrv = r?.data?.id ? String(r.data.id) : '';
      if (atualSrv) {
        rodadaAtualId = atualSrv;
        return { rodadas: ordenadas, rodadaAtualId };
      }
    } catch {}
    
    // Fallback inteligente: busca rodada por análise de datas das partidas
    const rodadaBasedOnDate = await findCurrentRoundByDate(ordenadas);
    if (rodadaBasedOnDate) {
      rodadaAtualId = rodadaBasedOnDate;
      return { rodadas: ordenadas, rodadaAtualId };
    }
    
    // Fallback tradicional: rodada aberta (não finalizada) de MAIOR id, senão a maior id
    const abertas = ordenadas.filter(r => !r.finalizada && !r.finalizado);
    const naoFinal = abertas.length
      ? abertas.reduce((acc, cur) => (Number(cur.id) > Number(acc.id) ? cur : acc), abertas[0])
      : null;
    const maior = ordenadas.length
      ? ordenadas.reduce((acc, cur) => (Number(cur.id) > Number(acc.id) ? cur : acc), ordenadas[0])
      : null;
    rodadaAtualId = (naoFinal?.id ?? maior?.id) || '';
    
    return { rodadas: ordenadas, rodadaAtualId };
  } catch (e) {
    throw new Error('Erro ao carregar rodadas: ' + (e?.message || 'Erro desconhecido'));
  }
}