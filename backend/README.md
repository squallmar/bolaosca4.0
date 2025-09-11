# Bolão SCA 4.0 – Backend

API do sistema de bolões (usuários, autorização admin, bolões, campeonatos, rodadas, partidas, palpites, ranking, blog, anúncios, chat/SSE, bloqueio de IPs etc.)

## Stack Principal
| Camada | Tecnologias |
|--------|-------------|
| Runtime | Node.js (ESM) |
| Web/API | Express, Helmet, Rate-Limit, Cookie-Parser |
| Auth | JWT (HttpOnly Cookie), Bcrypt |
| DB | PostgreSQL (pg) + migrações dinâmicas leves em runtime |
| Uploads | Multer (avatars, escudos, anúncios) + verificação de assinatura de imagem |
| Realtime | SSE (IPs bloqueados) + Socket.IO (chat se aplicável) |
| Segurança | CSP, sanitização, verificação magic bytes, rate limiting, revalidação admin |

## Execução
1. Instalar dependências:
```bash
npm install
```
2. Criar `.env` (exemplo abaixo).
3. Subir banco PostgreSQL (criar database vazio).
4. Start dev:
```bash
npm run dev
```
5. Produção:
```bash
npm start
```

### Exemplo `.env`
```
PORT=3001
DATABASE_URL=postgres://user:pass@localhost:5432/bolao
JWT_SECRET=coloque-uma-string-bem-grande-aqui
BASE_URL=http://localhost:3001
NODE_ENV=development
```

## Autenticação
Fluxo baseado em cookie `token` (HttpOnly, SameSite=lax em dev / strict + secure em produção).

Endpoints relevantes:
- POST `/auth/login` -> define cookie e retorna `{ usuario }` (não retorna mais token).
- POST `/auth/logout` -> limpa cookie.
- GET `/auth/me` -> dados do usuário autenticado.
- POST `/auth/refresh` -> renova cookie se faltar < 2h para expirar (rolling window de 8h).
- PATCH `/auth/me/senha` -> troca de senha (não invalida cookie existente – considere logout voluntário depois).

Middleware: `exigirAutenticacao` aceita cookie (ou Bearer legado). Admin revalidado em rotas sensíveis.

## Segurança Implementada
- JWT somente em cookie HttpOnly (XSS não acessa token).
- CSP configurada em `index.js` (pode ser endurecida removendo `unsafe-inline`).
- Rate limiting de login + bloqueio de IP após tentativas falhas (persistido em tabela `login_blocked_ip`).
- Sanitização de textos (anúncios e blog) via `sanitizeText`.
- Verificação de assinatura de imagens (PNG/JPG/GIF) antes de aceitar upload.
- Auto-desbloqueio periódico de IPs e índice para performance.
- Enforce de `JWT_SECRET` forte em produção (abortando se não definido / fraco).
- SSE autenticado via cookie.

## Uploads
Diretórios em `backend/uploads`: `avatars/`, `escudos/`, `anuncios/`, `regras/`. A pasta é servida de forma estática pelo Express.

## Blog
Rotas em `blog.js`. Conteúdo sanitizado na entrada e novamente na saída (defensivo).

## Refresh de Sessão
Chamar periodicamente (ex: a cada 1h) `POST /auth/refresh` do frontend. Se `refreshed:true`, a sessão foi renovada por mais 8h.

## Migrações Dinâmicas
`index.js` faz checagens e cria colunas/tabelas ausentes para tolerar ambientes parcialmente migrados. Para produção, considere ferramenta de migração formal (Knex, Prisma, etc.).

## Scripts NPM
| Script | Descrição |
|--------|-----------|
| dev | Nodemon para desenvolvimento |
| start | Execução normal |

## Próximos Passos (Sugeridos)
- Remover `unsafe-inline` na CSP (adicionar nonces/hashes).
- Assinatura/verificação para imagens WebP/SVG restritas.
- Revogação de sessão ao trocar senha (blacklist / token versioning).
- Testes automatizados para sanitização e uploads.

## Licença
Uso interno / proprietário (definir conforme necessidade).
