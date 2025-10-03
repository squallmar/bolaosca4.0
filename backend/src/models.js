// Modelos de tabelas para referência
// Use migrations ou ORM para criar as tabelas no banco

/*
Usuário: id, nome, email, senha, tipo (admin/comum), autorizado (bool)
Bolão: id, nome, admin_id
Campeonato: id, nome, bolao_id
Rodada: id, nome, campeonato_id
Partida: id, rodada_id, time1, time2, resultado
ParticipanteRodada: id, rodada_id, usuario_id, autorizado (bool)
Palpite: id, partida_id, usuario_id, palpite (time1/time2/empate), pontos
*/

// Exemplo de consulta para criar tabela usuário
// CREATE TABLE usuario (
//   id SERIAL PRIMARY KEY,
//   nome VARCHAR(100),
//   email VARCHAR(100) UNIQUE,
//   senha VARCHAR(255),
//   tipo VARCHAR(10),
//   autorizado BOOLEAN DEFAULT FALSE
// );
