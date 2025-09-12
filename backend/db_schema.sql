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
DELETE FROM usuario WHERE email = 'marcelmendes05@gmail.com';
INSERT INTO usuario (nome, email, senha, tipo, autorizado, apelido, contato)
VALUES ('Marcel Mendes', 'marcelmendes05@gmail.com', '$2b$10$pyW83xdgxUhrs7VCUpdfa./xcnUpO4rjILt4xesbi6CWR71N5p9XC', 'admin', TRUE, 'admin', '');
