# Arquitetura: Feature de Telas (Devices) e Pareamento

**Última atualização:** 2026-03-01  
**Status:** ✅ Implementado e validado

---

## 1. Visão geral

O fluxo de Telas cobre o ciclo completo de vida de um dispositivo de exibição (TV/telão) dentro do Telumi:

```
Admin cria tela → código de pareamento gerado → 
player scannea QR → pareamento confirmado → 
deviceToken + deviceSecret emitidos → 
heartbeat contínuo → status em tempo real no admin
```

---

## 2. Entidades do banco de dados

### `Device`

Campo principal de toda a feature. Campos relevantes:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | cuid | PK |
| `workspaceId` | String | Isolamento multi-tenant |
| `locationId` | String | FK para `Location` |
| `name` | String | Único por workspace |
| `orientation` | Enum | `HORIZONTAL` \| `VERTICAL` |
| `resolution` | String | `AUTO`, `1920x1080`, etc. |
| `operationalStatus` | Enum | `ACTIVE` \| `INACTIVE` |
| `isPublic` | Boolean | Disponível no marketplace |
| `isPartnerTv` | Boolean | TV de terceiro (parceiro) |
| `partnerName` | String? | Nome do parceiro |
| `partnerRevenueSharePct` | Float? | % de repasse ao parceiro |
| `pairingCode` | String? | Código 6 dígitos (unique) |
| `pairingExpiresAt` | DateTime? | Expiração do código |
| `deviceToken` | String? | Token pós-pareamento (unique) |
| `deviceSecret` | String? | Segredo para HMAC do PoP |
| `pairedAt` | DateTime? | Timestamp do pareamento |
| `lastHeartbeat` | DateTime? | Último heartbeat recebido |

### `DeviceEvent` (telemetria)

Armazena eventos operacionais do player. Deduplicação por janela de 30 min via `dedupeKey`.

Tipos de evento: `CRASH_LOOP`, `DOWNLOAD_FAILED`, `ASSET_CORRUPTED`, `LOW_STORAGE`, `NO_CONTENT_UPDATE`, `PLAYER_STARTED`, `PLAYER_STOPPED`, `NETWORK_DOWN`, `NETWORK_RESTORED`.

Severidades: `INFO`, `WARNING`, `CRITICAL`.

### `DeviceHeartbeat`

Log histórico de heartbeats. Índice composto `(deviceId, timestamp)` para queries de séries temporais.

### `PlayEvent` (Proof-of-Play)

Evidência auditável de exibição de anúncio. Campos de integridade: `hmacSignature`, `assetHash`, `manifestVersion`. Status: `ONLINE_VERIFIED`, `OFFLINE_SYNCED`, `NOT_ELIGIBLE`, `REJECTED`.

---

## 3. API endpoints

### Endpoints autenticados (JWT obrigatório)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/v1/devices` | Lista telas do workspace |
| `POST` | `/v1/devices` | Cria nova tela |
| `PATCH` | `/v1/devices/:id` | Edita dados da tela |
| `DELETE` | `/v1/devices/:id` | Remove tela (cascade) |
| `POST` | `/v1/devices/:id/regenerate-code` | Regenera código de pareamento |
| `GET` | `/v1/devices/:id/recovery-link` | Obtém link de recuperação |
| `POST` | `/v1/devices/:id/repair` | Rotaciona link de recuperação |
| `GET` | `/v1/devices/stream` | SSE de status em tempo real |

### Endpoints públicos (sem auth, com rate limiting)

| Método | Rota | Rate limit | Descrição |
|---|---|---|---|
| `POST` | `/v1/devices/public/pair` | 5/min, 15/10min | Parear via código |
| `POST` | `/v1/devices/public/pair-by-token` | 5/min, 15/10min | Parear via recovery token |
| `POST` | `/v1/devices/public/heartbeat` | 10/min, 80/10min | Heartbeat do player |
| `POST` | `/v1/devices/public/telemetry` | 10/min, 60/10min | Evento de telemetria |
| `POST` | `/v1/devices/public/play-event` | 20/min, 200/10min | Proof-of-Play |

---

## 4. Fluxo de pareamento

### 4.1 Pareamento via QR Code (caminho principal)

```
1. Admin cria tela no wizard
   └── API gera pairingCode (6 dígitos, 10 min de validade)
   └── UI exibe QR Code: PLAYER_URL/?pairCode=XXXXXX

2. Operador acessa PLAYER_URL/?pairCode=XXXXXX na TV

3. Player detecta ?pairCode na URL
   └── POST /v1/devices/public/pair { code: "XXXXXX" }
   └── API valida código + expiração
   └── API gera deviceToken (randomBytes(32)) + deviceSecret (randomBytes(32))
   └── API persiste pairedAt, limpa pairingCode
   └── Retorna { deviceToken, deviceSecret, device: { ... } }

4. Player salva deviceToken e deviceSecret em localStorage
5. Player limpa ?pairCode da URL (history.replaceState)
6. Player envia telemetria PLAYER_STARTED
7. Player inicia loop de heartbeat (15s)
```

### 4.2 Pareamento via recovery link (reconexão)

```
1. Admin abre dialog de edição da tela (quando status = OFFLINE)
   └── Clica "Reparear" → POST /v1/devices/:id/repair
   └── API gera novo deviceToken, persiste, retorna recoveryLink
   └── recoveryLink = PLAYER_URL/?pairToken=<deviceToken>

2. Admin copia e envia o link para o operador da TV

3. Operador acessa recoveryLink na TV
   └── Player detecta ?pairToken na URL
   └── POST /v1/devices/public/pair-by-token { token: <deviceToken> }
   └── API valida token, atualiza pairedAt
   └── Retorna deviceToken + deviceSecret atualizados

4. Fluxo continua igual ao pareamento por código (passos 4–7)
```

---

## 5. Status do dispositivo

O status é **computado** a cada requisição (não persistido), baseado em `pairedAt` e `lastHeartbeat`:

```
pairedAt = null          → PENDING
lastHeartbeat = null     → OFFLINE
elapsed ≤ 90s            → ONLINE
elapsed ≤ 180s           → UNSTABLE
elapsed > 180s           → OFFLINE
```

Thresholds definidos conforme PRD §A1.1 (Heartbeat TTL = 90s).

Os alertas operacionais são derivados do status:
- `OFFLINE` → alerta `TV_OFFLINE`
- `UNSTABLE` → alerta `TV_UNSTABLE`

---

## 6. SSE (Server-Sent Events)

A página de telas do admin mantém uma conexão SSE com `/v1/devices/stream?token=<jwt>` para receber atualizações em tempo real sem polling.

- O token JWT é passado via query string (SSE não suporta headers customizados nativamente no browser).
- O `DevicesStreamController` valida o JWT manualmente via `JwtService.verify()`.
- Quando um heartbeat chega, o `DevicesService` emite um evento via `Subject<>` (RxJS).
- O stream filtra eventos pelo `workspaceId` do JWT.
- O frontend reconecta automaticamente em 5s caso a conexão caia.

```
Player → POST /heartbeat
  └── DevicesService.heartbeatByToken()
      └── emitStatusEvent({ workspaceId, deviceId, status, ... })
          └── statusEvents$ Subject (RxJS)
              └── streamWorkspaceEvents(workspaceId) Observable
                  └── SSE → Admin browser
                      └── recarrega lista de devices
```

---

## 7. Proof-of-Play (PoP)

Fundação implementada. Validação de autenticidade via HMAC-SHA256:

```
signature = HMAC-SHA256(
  key: deviceSecret,
  data: `${playId}:${deviceToken}:${startedAt}:${endedAt}`
)
```

O `deviceSecret` é gerado no pareamento e armazenado no `localStorage` do player. O backend valida a assinatura comparando com o `deviceSecret` armazenado no banco.

Idempotência garantida por `playId` único (`@@unique` no schema).

---

## 8. Limitações conhecidas / próximos passos

| Item | Notas |
|---|---|
| Limite de 3 telas por workspace | `MAX_SCREENS_DEFAULT = 3` — deve ser configurável por plano |
| `deviceSecret` em localStorage | aceitável para o MVP Web; em app nativo usar Keystore/Keychain |
| Status UNSTABLE sem alerta dedicado | pode gerar alerta `TV_UNSTABLE` futuramente |
| PoP sem validação de janela contratada | será completado quando Campaigns/Schedule estiver implementado |
