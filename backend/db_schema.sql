-- Atualização dos escudos dos times com URLs do Cloudinary
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730999/S%C3%A3o_Paulo_lu9siz.png' WHERE nome = 'São Paulo';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730996/Santos_oigyhl.png' WHERE nome = 'Santos';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730995/Red_Bull_bjokax.png' WHERE nome = 'Bragantino - Red Bull';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730995/PALMEIRAS_ytc8er.png' WHERE nome = 'Palmeiras';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730993/N%C3%81UTICO-PE_sxpkmb.png' WHERE nome = 'Náutico - PE';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730992/Mirassol_physbe.png' WHERE nome = 'Mirassol';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730991/Juventude_jnqam0.png' WHERE nome = 'Juventude';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730989/INTERNACIONAL-RS_uqmcfi.png' WHERE nome = 'Internacional';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730989/GR%C3%8AMIO-RS_xteuwo.png' WHERE nome = 'Grêmio';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730989/GOI%C3%81S-GO_iyl5qj.png' WHERE nome = 'Goiás - GO';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730988/Fortaleza_hq9ikt.png' WHERE nome = 'Fortaleza';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730986/FLUMINENSE-RJ_rkohjv.png' WHERE nome = 'Fluminense - RJ';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730985/FLAMENGO-RJ_dkq9uy.png' WHERE nome = 'Flamengo - RJ';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730985/CRUZEIRO-MG_mfdlic.png' WHERE nome = 'Cruzeiro';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730985/CRICI%C3%9AMA-SC_fipfwm.png' WHERE nome = 'Criciúma - SC';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730983/CORITIBA-PR_ni0cex.png' WHERE nome = 'Coritiba - PR';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730982/ATL%C3%89TICO-PR_exxbst.png' WHERE nome = 'Atlético - PR';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730983/CORINTHIANS-SP_vpoife.png' WHERE nome = 'Corinthians - SP';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730983/BOTAFOGO-RJ_zuab69.png' WHERE nome = 'Botafogo';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730983/Cear%C3%A1_SC_glup6l.png' WHERE nome = 'Ceará SC';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730982/BAHIA-BA_p4lna4.png' WHERE nome = 'Bahia';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730982/ATL%C3%89TICO-MG_w49dqg.png' WHERE nome = 'Atlético - MG';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757731000/Vit%C3%B3ria_-_BA_rafeir.png' WHERE nome = 'EC Vitória';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730999/VASCO_DA_GAMA-RJ_cjumgm.png' WHERE nome = 'Vasco - RJ';
UPDATE time SET escudo_url = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757730999/Sport_Recife_paqsts.png' WHERE nome = 'Sport Recife';

-- Atualizar escudos nulos ou inválidos para uma imagem padrão
UPDATE time
SET escudo_url = '/uploads/escudos/_default.png'
WHERE escudo_url IS NULL
   OR escudo_url ~ '-\\.png$'
   OR escudo_url ~ '/uploads/escudos/$'
   OR escudo_url = '';

-- Normalizar nomes de times nas partidas
UPDATE partida SET time1 = 'Atlético - MG' WHERE time1 ILIKE '%atletico%mg%' OR time1 ILIKE '%atlético%mg%';
UPDATE partida SET time2 = 'Atlético - MG' WHERE time2 ILIKE '%atletico%mg%' OR time2 ILIKE '%atlético%mg%';

UPDATE partida SET time1 = 'Bahia' WHERE time1 ILIKE '%bahia%';
UPDATE partida SET time2 = 'Bahia' WHERE time2 ILIKE '%bahia%';

UPDATE partida SET time1 = 'Botafogo' WHERE time1 ILIKE '%botafogo%';
UPDATE partida SET time2 = 'Botafogo' WHERE time2 ILIKE '%botafogo%';

UPDATE partida SET time1 = 'Bragantino - Red Bull' WHERE time1 ILIKE '%bragantino%' OR time1 ILIKE '%red bull%';
UPDATE partida SET time2 = 'Bragantino - Red Bull' WHERE time2 ILIKE '%bragantino%' OR time2 ILIKE '%red bull%';

UPDATE partida SET time1 = 'Ceará SC' WHERE time1 ILIKE '%ceara%' OR time1 ILIKE '%ceará%';
UPDATE partida SET time2 = 'Ceará SC' WHERE time2 ILIKE '%ceara%' OR time2 ILIKE '%ceará%';

UPDATE partida SET time1 = 'Corinthians - SP' WHERE time1 ILIKE '%corinthians%' OR time1 ILIKE '%corintians%';
UPDATE partida SET time2 = 'Corinthians - SP' WHERE time2 ILIKE '%corinthians%' OR time2 ILIKE '%corintians%';

UPDATE partida SET time1 = 'Cruzeiro' WHERE time1 ILIKE '%cruzeiro%';
UPDATE partida SET time2 = 'Cruzeiro' WHERE time2 ILIKE '%cruzeiro%';

UPDATE partida SET time1 = 'EC Vitória' WHERE time1 ILIKE '%vitoria%' OR time1 ILIKE '%vitória%';
UPDATE partida SET time2 = 'EC Vitória' WHERE time2 ILIKE '%vitoria%' OR time2 ILIKE '%vitória%';

UPDATE partida SET time1 = 'Flamengo - RJ' WHERE time1 ILIKE '%flamengo%';
UPDATE partida SET time2 = 'Flamengo - RJ' WHERE time2 ILIKE '%flamengo%';

UPDATE partida SET time1 = 'Fluminense - RJ' WHERE time1 ILIKE '%fluminense%';
UPDATE partida SET time2 = 'Fluminense - RJ' WHERE time2 ILIKE '%fluminense%';

UPDATE partida SET time1 = 'Fortaleza' WHERE time1 ILIKE '%fortaleza%';
UPDATE partida SET time2 = 'Fortaleza' WHERE time2 ILIKE '%fortaleza%';

UPDATE partida SET time1 = 'Grêmio' WHERE time1 ILIKE '%gremio%' OR time1 ILIKE '%grêmio%';
UPDATE partida SET time2 = 'Grêmio' WHERE time2 ILIKE '%gremio%' OR time2 ILIKE '%grêmio%';

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

UPDATE partida SET time1 = 'São Paulo' WHERE time1 ILIKE '%sao paulo%' OR time1 ILIKE '%são paulo%';
UPDATE partida SET time2 = 'São Paulo' WHERE time2 ILIKE '%sao paulo%' OR time2 ILIKE '%são paulo%';

UPDATE partida SET time1 = 'Sport Recife' WHERE time1 ILIKE '%sport%' OR time1 ILIKE '%recife%';
UPDATE partida SET time2 = 'Sport Recife' WHERE time2 ILIKE '%sport%' OR time2 ILIKE '%recife%';

UPDATE partida SET time1 = 'Vasco - RJ' WHERE time1 ILIKE '%vasco%';
UPDATE partida SET time2 = 'Vasco - RJ' WHERE time2 ILIKE '%vasco%';

-- Criação segura das tabelas (não apaga dados existentes)
CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  senha VARCHAR(255),
  tipo VARCHAR(10) DEFAULT 'comum', -- 'admin' ou 'comum'
  autorizado BOOLEAN DEFAULT FALSE,
  apelido VARCHAR(50),
  contato VARCHAR(50),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bolao (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  admin_id INTEGER REFERENCES usuario(id),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campeonato (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  bolao_id INTEGER REFERENCES bolao(id),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rodada (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100),
  campeonato_id INTEGER REFERENCES campeonato(id),
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partida (
  id SERIAL PRIMARY KEY,
  rodada_id INTEGER REFERENCES rodada(id),
  time1 VARCHAR(100),
  time2 VARCHAR(100),
  resultado VARCHAR(10),
  data_partida TIMESTAMP,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS palpite (
  id SERIAL PRIMARY KEY,
  partida_id INTEGER REFERENCES partida(id),
  usuario_id INTEGER REFERENCES usuario(id),
  palpite VARCHAR(10), -- 'time1', 'time2', 'empate'
  pontos INTEGER DEFAULT 0,
  data_palpite TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partida_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS anuncio_tv (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admin_id INTEGER REFERENCES usuario(id),
  imagem_url VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS login_blocked_ip (
  ip VARCHAR(45) PRIMARY KEY,
  bloqueado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  desbloqueado BOOLEAN DEFAULT FALSE,
  email VARCHAR(100),
  nome_usuario VARCHAR(100),
  tentativas INTEGER DEFAULT 1
);

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_partida_times ON partida(time1, time2);
CREATE INDEX IF NOT EXISTS idx_palpite_usuario ON palpite(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);
CREATE INDEX IF NOT EXISTS idx_time_nome ON time(nome);