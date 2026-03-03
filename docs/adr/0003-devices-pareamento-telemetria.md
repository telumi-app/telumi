# ADR-0003: Arquitetura de Devices, Pareamento e Telemetria

**Status:** Aceito  
**Data:** 2026-03-01  
**Contexto:** Decisões de design do módulo de Telas (Devices), fluxo de pareamento e telemetria operacional do player.

---

## Contexto

O Telumi precisa parear TVs físicas (Android Box, Smart TV) com workspaces no SaaS sem exigir que o operador da TV faça login ou tenha acesso ao painel admin. O player deve ser resiliente a quedas de rede e continuar enviando evidências de execução (Proof-of-Play) mesmo em modo offline.

---

## Decisões

### 1. Pareamento por código de 6 dígitos + QR Code

**Decisão:** O admin gera um código de 6 dígitos alfanuméricos sem ambiguidade (sem 0/O, 1/I) com validade de 10 minutos. O QR Code aponta para `PLAYER_URL/?pairCode=XXXXXX`.

**Motivos:**
- O operador não precisa de conta no Telumi para parear a TV.
- O QR Code elimina digitação manual em ambientes onde teclado não está disponível.
- O código curto permite digitação manual como fallback.
- Colisões são evitadas por retry loop com até 5 tentativas (`MAX_PAIRING_CODE_RETRIES`).

**Alternativas descartadas:**
- Deep link `telumi://pair?code=X` — não funciona em browser kiosk sem setup nativo.
- Token longo na URL — dificulta digitação manual como fallback.

---

### 2. Dois tokens separados: `deviceToken` e `deviceSecret`

**Decisão:** No pareamento, a API gera e retorna:
- `deviceToken` — identificador público de autenticação do device (enviado em todo heartbeat/telemetria).
- `deviceSecret` — segredo privado usado exclusivamente para assinar Proof-of-Play via HMAC-SHA256.

**Motivos:**
- Separação de responsabilidades: comprometer o `deviceToken` não compromete a integridade dos PoPs.
- O `deviceSecret` nunca trafega após o pareamento — apenas sua assinatura trafega.
- Alinhado com o modelo do PRD §11 (PoP com assinatura auditável).

---

### 3. Status computado, não persistido

**Decisão:** O status do device (`PENDING`, `ONLINE`, `UNSTABLE`, `OFFLINE`) é calculado em runtime a partir de `pairedAt` e `lastHeartbeat`, nunca salvo em campo separado.

**Motivos:**
- Elimina race condition de atualização de status.
- Simplifica o schema — um campo a menos para manter sincronizado.
- Consistência garantida: o status sempre reflete o estado real no momento da consulta.
- Thresholds podem ser ajustados sem migration de banco.

**Thresholds adotados (PRD §A1.1):**
- `ONLINE`: `elapsed ≤ 90s`
- `UNSTABLE`: `elapsed ≤ 180s`
- `OFFLINE`: `elapsed > 180s`

---

### 4. SSE para status em tempo real (não WebSocket, não polling)

**Decisão:** A página de telas usa `EventSource` (SSE) conectado a `GET /v1/devices/stream?token=<jwt>`.

**Motivos:**
- SSE é unidirecional (servidor → cliente), adequado para notificações de status.
- Menor overhead que WebSocket para este caso.
- Reconexão automática nativa no browser.
- JWT via query string — SSE não permite headers customizados na abertura da conexão pelo browser.
- Fallback: a página também faz polling a cada 15s como redundância.

**Trade-off aceito:** JWT na query string pode aparecer em logs de servidor. Mitigação: tokens de curta duração e logs sem query string (configuração futura).

---

### 5. Rate limiting via `@nestjs/throttler` com TTL em segundos

**Decisão:** Todos os endpoints públicos usam `FastifyThrottlerGuard` (override de `getTracker` para ler `request.ip` no Fastify) com `@Throttle()` por rota.

**Lição aprendida:** O `@nestjs/throttler` usa TTL em **segundos**, não milissegundos. O bug encontrado (`ttl: 60_000` causando 429 em todo heartbeat) foi corrigido para `ttl: 60`.

---

### 6. Telemetria com deduplicação por janela de 30 minutos

**Decisão:** `DeviceEvent` usa um campo `dedupeKey` (`${deviceId}:${eventType}:${window}`) para evitar spam de alertas repetidos dentro de 30 minutos.

**Motivos:**
- Um `CRASH_LOOP` pode gerar dezenas de eventos por minuto — sem deduplicação, o banco e as notificações seriam inundados.
- PRD §A2.2 exige deduplicação por `(tvId, alertType)` com janela configurável.
- 30 minutos como padrão MVP; configurável por location no futuro.

---

### 7. `onDelete: Cascade` em todas as FKs de Device

**Decisão:** `DeviceHeartbeat`, `DeviceEvent` e `PlayEvent` têm `onDelete: Cascade` na FK para `Device`.

**Motivos:**
- Simplifica a operação de exclusão de tela — sem necessidade de limpar tabelas filhas manualmente.
- Evita registros órfãos que poluem queries de agregação.
- Trade-off: dados históricos são perdidos ao excluir. Aceitável no MVP; futuramente pode-se usar soft delete ou archiving.

---

## Consequências

- O módulo de devices é autossuficiente: não depende de outros módulos de domínio (playlists, campanhas).
- A fundação de PoP (`deviceSecret` + `PlayEvent`) está pronta para ser expandida quando Campaigns for implementado.
- O SSE cria uma conexão persistente por aba aberta — não escala para centenas de admins simultâneos sem pub/sub (Redis). Para o MVP, aceitável.
