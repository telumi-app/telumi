# Telumi — Status de Implementação (Consolidado)

**Última atualização:** 2026-03-03  
**Escopo de execução atual:** INTERNAL (operação própria de rede indoor)

---

## Legenda

| Símbolo | Definição |
|---|---|
| ✅ | Implementado e em uso |
| 🚧 | Implementado parcialmente / hardening em andamento |
| ⬜ | Ainda não iniciado no escopo atual |

---

## 1) Base de plataforma

| Capacidade | Status | Evidência |
|---|---|---|
| Monorepo TypeScript com Turborepo + pnpm | ✅ | `turbo.json`, `pnpm-workspace.yaml` |
| API NestJS + Fastify + Prisma (Postgres) | ✅ | `apps/api`, `packages/db` |
| Apps web (admin + player) em Next.js | ✅ | `apps/admin-web`, `apps/player` |
| Pacotes compartilhados (`shared`, `ui`, `billing`) | ✅ | `packages/*` |
| Health check e documentação via decorators OpenAPI | ✅ | `GET /v1/health`, `@ApiOperation` nos controllers |

---

## 2) Identidade, sessão e onboarding

| Capacidade | Status | Evidência |
|---|---|---|
| Registro/login por e-mail + senha | ✅ | `POST /v1/auth/register`, `POST /v1/auth/login` |
| Autorização com JWT (`JwtAuthGuard`) | ✅ | `apps/api/src/auth` |
| Sessão no frontend + fallback para login | ✅ | `apps/admin-web/src/lib/auth/session.ts` |
| Onboarding de workspace e escolha de modo | ✅ | `/onboarding/workspace`, `/onboarding/mode`, `/onboarding/setup` |

---

## 3) Operação de telas (Devices) e telemetria

| Capacidade | Status | Evidência |
|---|---|---|
| CRUD de telas com validações de workspace/limite/unicidade | ✅ | `apps/api/src/devices/devices.service.ts` |
| Pareamento por código + pareamento por token (recovery) | ✅ | `/devices/public/pair`, `/devices/public/pair-by-token` |
| Heartbeat com fila offline do player | ✅ | `apps/player/src/app/page.tsx` |
| Status operacional derivado (`PENDING/ONLINE/UNSTABLE/OFFLINE`) | ✅ | regra de TTL em `devices.service.ts` |
| Stream em tempo real de status (SSE) | ✅ | `/devices/stream` |
| Telemetria e PoP (play-event assinado) | ✅ | `/devices/public/telemetry`, `/devices/public/play-event` |
| Repareamento e rotação de link de recuperação | ✅ | `/devices/:id/repair`, `getRecoveryLink` |

---

## 4) Mídia e playlists

| Capacidade | Status | Evidência |
|---|---|---|
| Upload com URL pré-assinada + confirmação de upload | ✅ | `media.controller.ts` (`upload-url`, `:id/confirm`) |
| Listar, detalhar, renomear e remover mídia | ✅ | `apps/api/src/media` |
| Página admin de gestão de mídias | ✅ | `apps/admin-web/src/app/(app)/midias/page.tsx` |
| CRUD de playlists | ✅ | `apps/api/src/playlists/playlists.controller.ts` |

---

## 5) Campanhas, programação e scheduling interno

| Capacidade | Status | Evidência |
|---|---|---|
| CRUD de campanhas com timeline de assets | ✅ | `apps/api/src/campaigns/*` |
| Regras de transição de status da campanha | ✅ | `VALID_TRANSITIONS` em `campaigns.service.ts` |
| Remoção de campanha com consistência transacional | ✅ | finaliza programações e remove campanha em transação |
| CRUD + publish de programação (`schedules`) | ✅ | `apps/api/src/schedules/*` |
| Correção de parsing de data-only (evitar drift de timezone) | ✅ | `parseDateOnlyStart/End` em campanhas e schedules |
| Scheduling interno com `validate` + `confirm` (hold/capacidade) | ✅ | `apps/api/src/campaign-scheduling/*` |
| Expansão de occurrences + sugestões + consumo de hold | ✅ | `CampaignSchedulingService` + `@telumi/shared/scheduling` |
| Endpoint player por ocorrência ativa (`/player/screens/:id/now`) | ✅ | `PlayerScreenController` |

---

## 6) Entrega para player (manifest) e runtime

| Capacidade | Status | Evidência |
|---|---|---|
| Manifest por `deviceToken` com fallback legado | ✅ | `getPlaybackManifestByToken` |
| Composição multi-campanha ponderada por `playsPerHour` | ✅ | `buildWeightedCampaignCycle` |
| Expansão correta da timeline completa por campanha no manifesto | ✅ | `buildOccurrenceManifest` + path legado |
| Priorização de occurrences ativas sobre schedules legados | ✅ | checagem `buildOccurrenceManifest` antes do fallback |
| Polling de manifesto no player | ✅ | `MANIFEST_POLL_INTERVAL_MS` |
| Avanço robusto de vídeo (watchdog/fallback + dedupe de completion) | ✅ | `videoFallbackTimeoutRef`, `videoCompletedKeyRef` |

---

## 7) Admin web (UX operacional de campanhas)

| Capacidade | Status | Evidência |
|---|---|---|
| Lista de campanhas com cards e métricas operacionais | ✅ | `apps/admin-web/src/app/(app)/campanhas/page.tsx` |
| Ações de ciclo de vida: pausar, reativar, cancelar, excluir | ✅ | `campaign-card.tsx` |
| Edição detalhada por rota dedicada (`/campanhas/:id/editar`) | ✅ | `apps/admin-web/src/app/(app)/campanhas/[id]/editar/page.tsx` |
| Edição de timeline e metadados da campanha | ✅ | integração com `CampaignTimeline` + `campaignsApi.update` |
| Gestão de programações vinculadas dentro da edição | ✅ | listar/publicar/pausar/reativar/finalizar + criar nova |
| Mitigação de hydration mismatch no menu de usuário | ✅ | gate por `mounted` em `components/nav-user.tsx` |

---

## 8) Testes e validação

| Escopo | Status | Evidência |
|---|---|---|
| Unit/service tests API (auth, devices, media, playlists, campaigns, schedules, locations) | ✅ | `apps/api/src/**/*.spec.ts` |
| Testes do fluxo de scheduling interno (validate/confirm/capacidade/hold) | ✅ | `apps/api/test/campaign-scheduling.service.spec.ts` |
| E2E Playwright auth/onboarding | ✅ | `apps/admin-web/e2e/auth-flow.spec.ts` |
| E2E Playwright fluxo completo device → campaign → player | ✅ | `apps/admin-web/e2e/device-campaign-player.spec.ts` |
| E2E Playwright multi-campanha/multi-tela + lifecycle | ✅ | `apps/admin-web/e2e/campaign-multi-screen.spec.ts` |

---

## 9) Correções técnicas relevantes já absorvidas

| Tema | Status | Resultado |
|---|---|---|
| Resolução de build/import do pacote `@telumi/shared` | ✅ | API volta a subir sem erro de entrypoint |
| Manifest exibindo apenas 1 criativo por campanha | ✅ | manifesto agora inclui timeline completa |
| Inconsistências de data por timezone em agendamento | ✅ | datas normalizadas para início/fim do dia |
| Compatibilidade de requests E2E com Fastify | ✅ | ajustes de header/body nos cenários |

---

## 10) Fora do escopo atual (marketplace/finance)

| Capacidade PRD | Status |
|---|---|
| Subconta/KYC Asaas, split e gates de marketplace | ⬜ |
| Pricing engine (CPM por location) e inventory comercial (Policy B) | ⬜ |
| Wizard público do anunciante + checkout (Pix/cartão/boleto) | ⬜ |
| Crédito financeiro de não-entrega (ledger no portal anunciante) | ⬜ |
| Portal parceiro com repasse estimado | ⬜ |

---

## Resumo executivo do momento

- O **core INTERNAL** está funcional de ponta a ponta: cadastro/pareamento de telas, upload de mídia, campanhas, programação, entrega via manifesto e reprodução no player.
- A camada de **scheduling interno** já opera com validação de capacidade, hold temporário, confirmação e leitura por ocorrência ativa.
- O admin já oferece **ciclo de vida completo de campanha** e **edição detalhada** com timeline e gestão de programações.
- O backlog prioritário restante, conforme PRD, está concentrado em **marketplace + financeiro**.
