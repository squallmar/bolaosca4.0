# Fix: Detecção da Rodada Atual na Página de Palpites

## Problema Identificado

A página de palpites (`https://bolaosca4-0.vercel.app/palpite`) não estava carregando automaticamente na rodada atual quando acessada. O usuário tinha que selecionar manualmente a rodada correta.

## Causa Raiz

A lógica de detecção da "rodada atual" estava baseada apenas em:
1. Próxima rodada após a última completamente finalizada
2. Fallback para rodada com maior ID não finalizada

**Não considerava as datas e horários das partidas em relação ao momento atual.**

## Solução Implementada

### 1. Backend (bolao.js)

#### Novo Endpoint: `/bolao/diagnostico-rodadas`
- Endpoint para admin debugar cálculo de rodada atual
- Mostra estatísticas de todas as rodadas
- Compara lógica antiga vs nova baseada em datas
- Considera timezone America/Sao_Paulo

#### Melhorada: `/bolao/rodada-atual`
Nova lógica com **Análise de Concentração Temporal**:

1. **Critério Principal (Concentração Temporal)**: 
   - Analisa todos os jogos de cada rodada candidata
   - Calcula % de jogos no mês atual (peso 70%)
   - Calcula concentração temporal (1 - range_dias/365) (peso 30%)
   - **Score final**: (% mês atual * 0.7) + (concentração * 0.3)
   - **Prioriza** rodadas com jogos concentrados no período atual

2. **Critério Candidata**: Rodada deve ter:
   - Partidas com data futura OU
   - Partidas sem resultado/placar

3. **Ordenação**: Por score de concentração temporal (maior = atual)

#### Exemplo Prático (05/10/2025):
- **Rodada 12**: 8 jogos em julho + 2 jogos em outubro → Score baixo (dispersa)
- **Rodada 27**: 10 jogos em outubro → Score alto (concentrada) → **ATUAL**

#### Timezone Handling
- Usa `America/Sao_Paulo` para comparações de data/hora
- Format: `sv-SE` para garantir YYYY-MM-DD HH:mm consistente

### 2. Frontend (PalpiteList.js)

#### Nova Função: `findCurrentRoundByDate()`
Fallback inteligente quando backend falha:

- Analisa datas das partidas de cada rodada
- Identifica partidas futuras (>= agora)
- Identifica partidas recentes (últimas 48h) sem resultado
- Considera timezone São Paulo no frontend também

#### Lógica Melhorada em `carregarRodadas()`
1. **Prioridade 1**: `/bolao/rodada-atual` do backend
2. **Prioridade 2**: `findCurrentRoundByDate()` (análise local)
3. **Prioridade 3**: Fallback tradicional (maior ID não finalizada)

## Benefícios

### ✅ Precisão de Data/Hora
- Considera quando os jogos acontecem, não apenas status de finalização
- Timezone correto (São Paulo) tanto backend quanto frontend

### ✅ Robustez
- Dupla proteção: backend + frontend com lógicas similares
- Fallbacks múltiplos se uma camada falhar

### ✅ UX Melhorada
- Usuário sempre cai na rodada "atual" baseada em datas reais
- Reduz necessidade de seleção manual

### ✅ Debug Capability
- Endpoint `/diagnostico-rodadas` para admin verificar cálculos
- Logs comparativos entre lógicas antiga/nova

## Casos de Uso Cobertos

### Rodada com Jogos Futuros
- Ex: Rodada 15 com jogos no sábado/domingo → automaticamente selecionada na sexta

### Rodada em Andamento
- Ex: Sábado meio-dia, alguns jogos acabaram, outros ainda por vir → rodada atual

### Final de Rodada
- Ex: Segunda após fim dos jogos, mas sem resultados lançados → rodada atual

### **Jogos Atrasados vs Rodada Atual (REFINADO)**
- Ex: **Cenário 05/10/2025**:
  - **Rodada 12**: 8 jogos em julho + Palmeiras vs Juventude em 11/10 → Score baixo (dispersa temporalmente)
  - **Rodada 27**: Todos os 10 jogos em outubro → Score alto (concentrada) → **RODADA ATUAL**
- **Sistema prioriza concentração temporal** vs apenas existência de jogos futuros
- **Resolve adiamentos** sem confundir com rodada realmente atual

### Entre Rodadas
- Ex: Todos jogos acabaram e resultados lançados → próxima rodada

## Deployment

As mudanças estão commitadas e em produção:
- `b5068f11`: Backend melhorado
- `5ca1a943`: Frontend melhorado

Para verificar funcionamento:
1. Acesse `/palpite` e veja se cai na rodada correta
2. Admins podem usar `/api/bolao/diagnostico-rodadas` para debug

## Teste Manual

```bash
# Verificar rodada atual calculada
curl https://bolaosca4-0.vercel.app/api/bolao/rodada-atual

# Debug completo (admin)
curl https://bolaosca4-0.vercel.app/api/bolao/diagnostico-rodadas
```