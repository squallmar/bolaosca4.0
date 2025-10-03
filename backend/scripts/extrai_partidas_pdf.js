// Script para extrair dados de partidas do PDF e gerar um arquivo JSON estruturado
// Requer: npm install pdf-parse

const fs = require('fs');
const pdf = require('pdf-parse');

const PDF_PATH = './uploads/pdf/tabela_detalhada_campeonato_brasileiro_serie_a_2025.pdf';
const OUTPUT_PATH = './uploads/pdf/partidas_serie_a_2025.json';

(async () => {
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const data = await pdf(dataBuffer);
  const text = data.text;

  // TODO: Ajuste o regex/parsing conforme o layout do PDF
  // Exemplo de extração (ajuste para o seu caso):
  // Supondo linhas do tipo: "Rodada 1 | 12/05/2025 16:00 | Time A x Time B | Estádio XYZ"
  const partidas = [];
  const regex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+([\w\sÁÉÍÓÚÃÕÂÊÎÔÛÇà-ú-]+)\s+x\s+([\w\sÁÉÍÓÚÃÕÂÊÎÔÛÇà-ú-]+)\s+\|\s+([^\n]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    partidas.push({
      data: match[1],
      hora: match[2],
      time1: match[3].trim(),
      time2: match[4].trim(),
      local: match[5].trim()
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(partidas, null, 2), 'utf-8');
  console.log(`Extraídas ${partidas.length} partidas para ${OUTPUT_PATH}`);
})();
