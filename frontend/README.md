# Bolão SCA 4.0 – Frontend

SPA React que consome a API do backend usando cookie HttpOnly para sessão (sem storage de token no browser).

## Stack
- React 18
- Axios (instância em `src/services/api.js` com CSRF opcional)
- Webpack
- SSE para eventos (IPs bloqueados) usando `EventSource` com `withCredentials`

## Autenticação
1. Login (`POST /auth/login`) define cookie `token`.
2. Estado de usuário carregado via `GET /auth/me` no `AuthProvider` (`src/authContext.js`).
3. Logout chama `POST /auth/logout` e limpa estado local.
4. Renovação de sessão: opcional chamar `POST /auth/refresh` (ex: interval 60min) – não implementado ainda no front (só endpoint pronto).

Nenhum token é salvo em `localStorage`/`sessionStorage`. Componentes não usam mais `Authorization` header manual.

## Estrutura Principal
- `src/authContext.js`: contexto atual (cookie-based) – fornece `login`, `logout`, `nome`, `tipo`, `autorizado`, `avatarUrl`.
- `src/services/api.js`: axios com `withCredentials` + obtenção de CSRF (se backend exigir em mutações futuras).
- Telas de administração (`Admin*`), blog (`Blog*`), apostas (bolões/campeonatos/rodadas/partidas), ranking, chat.

## Executar
```bash
npm install
npm start
```
Aplicação aberta em http://localhost:3000 (ajustar conforme proxy/reverso configurado).

## Boas Práticas Seguidas
- Sem exposição de JWT no cliente.
- Sanitização de HTML sensível feita no backend (anúncios, blog); front apenas exibe.
- Uploads validados no backend (assinatura de imagem).
- SSE/axios usam `withCredentials: true` para enviar cookie automaticamente.

## Próximas Melhorias Sugeridas
- Implementar chamada periódica a `/auth/refresh` (ex: setInterval no `AuthProvider`).
- Substituir qualquer fallback estático remanescente por dados do contexto (já quase completo).
- Implementar suspense/spinners globais via boundary.
- Reduzir CSS inline movendo para módulos ou styled components.

## Licença
Uso interno / proprietário (ajustar conforme necessidade).
