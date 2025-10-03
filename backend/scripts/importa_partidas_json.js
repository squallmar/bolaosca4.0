// Script para importar partidas do JSON extraído, criando rodadas automaticamente se necessário
// Requer: npm install axios

const fs = require('fs');
const axios = require('axios');

const PARTIDAS_PATH = './uploads/pdf/partidas_serie_a_2025.json';
const API_URL = 'http://localhost:3001/bolao'; // ajuste se necessário

async function getUltimaRodadaId() {
  const res = await axios.get(`${API_URL}/rodadas-todas`);
  const rodadas = Array.isArray(res.data) ? res.data : (res.data.rodadas || []);
  if (!rodadas.length) return 0;
  // Busca maior id existente
  return Math.max(...rodadas.map(r => Number(r.id)));
}

async function criarRodada(nome) {
  const res = await axios.post(`${API_URL}/rodada`, { nome });
  return res.data.id || res.data.rodada_id || res.data.id_rodada;
}

async function importarPartidas() {
  const partidas = JSON.parse(fs.readFileSync(PARTIDAS_PATH, 'utf-8'));
  let rodadaNum = await getUltimaRodadaId();
  let rodadaId = null;
  let rodadaAtual = null;

  for (const partida of partidas) {
    // Se for uma nova rodada (exemplo: a cada N jogos, ou se o JSON trouxer info de rodada)
    // Aqui, para exemplo, cria uma rodada nova a cada 10 jogos
    if (!rodadaAtual || rodadaAtual.count >= 10) {
      rodadaNum++;
      const nome = `${rodadaNum}ª Rodada`;
      rodadaId = await criarRodada(nome);
      rodadaAtual = { id: rodadaId, count: 0 };
      console.log('Rodada criada:', nome, '->', rodadaId);
    }
    rodadaAtual.count++;
    try {
      const data_partida = `${partida.data} ${partida.hora}`;
      const payload = {
        rodada_id: rodadaId,
        time1: partida.time1,
        time2: partida.time2,
        data_partida,
        local: partida.local
      };
      const res = await axios.post(`${API_URL}/partida`, payload);
      console.log('Partida criada:', payload, '->', res.status);
    } catch (e) {
      console.error('Erro ao criar partida:', partida, e.response?.data || e.message);
    }
  }
}

importarPartidas();
