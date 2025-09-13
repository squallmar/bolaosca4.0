-- Criação segura das tabelas (não apaga dados)
CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  senha VARCHAR(255),
  tipo VARCHAR(10), -- 'admin' ou 'comum'
  autorizado BOOLEAN DEFAULT FALSE,
  apelido VARCHAR(50),
  contato VARCHAR(50)
);

-- Tabela de bolão
CREATE TABLE IF NOT EXISTS bolao (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  admin_id INTEGER REFERENCES usuario(id)
);

-- Tabela de campeonato
CREATE TABLE IF NOT EXISTS campeonato (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  bolao_id INTEGER REFERENCES bolao(id)
);

-- Tabela de rodada
CREATE TABLE IF NOT EXISTS rodada (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  campeonato_id INTEGER REFERENCES campeonato(id)
);

-- Tabela de partida
CREATE TABLE IF NOT EXISTS partida (
  id SERIAL PRIMARY KEY,
  rodada_id INTEGER REFERENCES rodada(id),
  time1 VARCHAR(100),
  time2 VARCHAR(100),
  resultado VARCHAR(10)
);

-- Tabela de palpite
CREATE TABLE IF NOT EXISTS palpite (
  id SERIAL PRIMARY KEY,
  partida_id INTEGER REFERENCES partida(id),
  usuario_id INTEGER REFERENCES usuario(id),
  palpite VARCHAR(10), -- 'time1', 'time2', 'empate'
  pontos INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS anuncio_tv (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admin_id INTEGER REFERENCES usuario(id),
  imagem_url VARCHAR(255)
);

-- Tabela de IPs bloqueados para login
CREATE TABLE IF NOT EXISTS login_blocked_ip (
  ip VARCHAR(45) PRIMARY KEY,
  bloqueado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  desbloqueado BOOLEAN DEFAULT FALSE,
  email VARCHAR(100),
  nome_usuario VARCHAR(100)
);

-- Usuário admin inicial

UPDATE time
SET escudo_url = '/uploads/escudos/_default.png'
WHERE escudo_url IS NULL
   OR escudo_url ~ '-\\.png$'
   OR escudo_url ~ '/uploads/escudos/$'
   OR escudo_url = '';

UPDATE partida SET time1 = 'Atlético - MG' WHERE time1 ILIKE '%atletico%mg%';
UPDATE partida SET time2 = 'Atlético - MG' WHERE time2 ILIKE '%atletico%mg%';

UPDATE partida SET time1 = 'Bahia' WHERE time1 ILIKE '%bahia%';
UPDATE partida SET time2 = 'Bahia' WHERE time2 ILIKE '%bahia%';

UPDATE partida SET time1 = 'Botafogo' WHERE time1 ILIKE '%botafogo%';
UPDATE partida SET time2 = 'Botafogo' WHERE time2 ILIKE '%botafogo%';

UPDATE partida SET time1 = 'Bragantino - Red Bull' WHERE time1 ILIKE '%bragantino%red%bull%';
UPDATE partida SET time2 = 'Bragantino - Red Bull' WHERE time2 ILIKE '%bragantino%red%bull%';

UPDATE partida SET time1 = 'Ceará SC' WHERE time1 ILIKE '%ceara%sc%';
UPDATE partida SET time2 = 'Ceará SC' WHERE time2 ILIKE '%ceara%sc%';

UPDATE partida SET time1 = 'Corinthians - SP' WHERE time1 ILIKE '%corinthians%sp%';
UPDATE partida SET time2 = 'Corinthians - SP' WHERE time2 ILIKE '%corinthians%sp%';

UPDATE partida SET time1 = 'Cruzeiro' WHERE time1 ILIKE '%cruzeiro%';
UPDATE partida SET time2 = 'Cruzeiro' WHERE time2 ILIKE '%cruzeiro%';

UPDATE partida SET time1 = 'EC Vitória' WHERE time1 ILIKE '%vitoria%';
UPDATE partida SET time2 = 'EC Vitória' WHERE time2 ILIKE '%vitoria%';

UPDATE partida SET time1 = 'Flamengo - RJ' WHERE time1 ILIKE '%flamengo%rj%';
UPDATE partida SET time2 = 'Flamengo - RJ' WHERE time2 ILIKE '%flamengo%rj%';

UPDATE partida SET time1 = 'Fluminense - RJ' WHERE time1 ILIKE '%fluminense%rj%';
UPDATE partida SET time2 = 'Fluminense - RJ' WHERE time2 ILIKE '%fluminense%rj%';

UPDATE partida SET time1 = 'Fortaleza' WHERE time1 ILIKE '%fortaleza%';
UPDATE partida SET time2 = 'Fortaleza' WHERE time2 ILIKE '%fortaleza%';

UPDATE partida SET time1 = 'Grêmio' WHERE time1 ILIKE '%gremio%';
UPDATE partida SET time2 = 'Grêmio' WHERE time2 ILIKE '%gremio%';

UPDATE partida SET time1 = 'Internacional' WHERE time1 ILIKE '%internacional%';
UPDATE partida SET time2 = 'Internacional' WHERE time2 ILIKE '%internacional%';

UPDATE partida SET time1 = 'Juventude' WHERE time1 ILIKE '%juventude%';
UPDATE partida SET time2 = 'Juventude' WHERE time2 ILIKE '%juventude%';

UPDATE partida SET time1 = 'Mirassol' WHERE time1 ILIKE '%mirassol%';
UPDATE partida SET time2 = 'Mirassol' WHERE time2 ILIKE '%mirassol%';

UPDATE partida SET time1 = 'Palmeiras' WHERE time1 ILIKE '%palmeiras%';
UPDATE partida SET time2 = 'Palmeiras' WHERE time2 ILIKE '%palmeiras%';

UPDATE partida SET time1 = 'Santos' WHERE time1 ILIKE '%santos%';
UPDATE partida SET time2 = 'Santos' WHERE time2 ILIKE '%santos%';

UPDATE partida SET time1 = 'São Paulo' WHERE time1 ILIKE '%sao%paulo%';
UPDATE partida SET time2 = 'São Paulo' WHERE time2 ILIKE '%sao%paulo%';

UPDATE partida SET time1 = 'Sport Recife' WHERE time1 ILIKE '%sport%recife%';
UPDATE partida SET time2 = 'Sport Recife' WHERE time2 ILIKE '%sport%recife%';

UPDATE partida SET time1 = 'Vasco - RJ' WHERE time1 ILIKE '%vasco%rj%';
UPDATE partida SET time2 = 'Vasco - RJ' WHERE time2 ILIKE '%vasco%rj%';
