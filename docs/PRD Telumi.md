# Telumi — Product Requirements Document (PRD)
**Versão:** v1.1 (expandido)  
**Data:** 26/02/2026  
**Escopo:** MVP + Fundamentos de Escala (Marketplace de Mídia Indoor + Operação de Player)

---

## Controle de mudanças
- **v1.0:** PRD base consolidado (modes, marketplace, KYC, split, PoP, crédito, portais, monorepo).
- **v1.1:** Detalhamento (micro-definições, state machines, conflitos, inventário/política B, APIs, DTOs, UX, boas práticas de workspace).

---

## Índice
1. [Resumo executivo](#1-resumo-executivo)  
2. [Objetivos e não-objetivos](#2-objetivos-e-não-objetivos)  
3. [Glossário (micro-definições)](#3-glossário-micro-definições)  
4. [Personas, papéis e RBAC](#4-personas-papéis-e-rbac)  
5. [Modos do Tenant (Interno vs Marketplace)](#5-modos-do-tenant-interno-vs-marketplace)  
6. [Jornadas e fluxos](#6-jornadas-e-fluxos)  
7. [Experiência (UI/UX) e componentes](#7-experiência-uiux-e-componentes)  
8. [Precificação e inventário](#8-precificação-e-inventário)  
9. [Pagamentos (Modelo 1) e crédito](#9-pagamentos-modelo-1-e-crédito)  
10. [Asaas: subcontas, KYC, split, webhooks](#10-asaas-subcontas-kyc-split-webhooks)  
11. [Proof-of-Play (PoP) e entrega](#11-proof-of-play-pop-e-entrega)  
12. [Portal do Parceiro (TV de terceiros)](#12-portal-do-parceiro-tv-de-terceiros)  
13. [APIs (alto nível) + contratos](#13-apis-alto-nível--contratos)  
14. [DTOs, contratos e validação](#14-dtos-contratos-e-validação)  
15. [Modelo de dados (alto nível)](#15-modelo-de-dados-alto-nível)  
16. [State machines](#16-state-machines)  
17. [Prevenção de conflitos e “cookbook” anti-bug](#17-prevenção-de-conflitos-e-cookbook-anti-bug)  
18. [Workspace/Monorepo (árvore) e boas práticas](#18-workspacemonorepo-árvore-e-boas-práticas)  
19. [Observabilidade, segurança e LGPD](#19-observabilidade-segurança-e-lgpd)  
20. [Parâmetros default e decisões finais](#20-parâmetros-default-e-decisões-finais)  
21. [Backlog sugerido (MVP)](#21-backlog-sugerido-mvp)



---

## Stack (MVP + Fundamentos de Escala) — Telumi

### Monorepo / Tooling
- **Linguagem:** TypeScript
- **Monorepo:** Turborepo
- **Package manager:** pnpm
- **Node:** Node.js 20 LTS
- **Lint/Format:** ESLint + Prettier
- **Schemas/Validação runtime:** Zod (requests, webhooks, eventos)
- **CI:** GitHub Actions

### Backend (API + Webhooks)
- **Framework:** NestJS (com Fastify adapter) *(ou Fastify puro, se preferir mais enxuto)*
- **API style:** REST + OpenAPI (Swagger)
- **Auth/RBAC:** JWT + Guards (RequireMode/RequireCapability/RequireRole)
- **ORM:** Prisma
- **DB:** PostgreSQL 16
- **Cache/Fila:** Redis 7
- **Jobs/Workers:** BullMQ (consumers + cron jobs)
- **Webhooks:** endpoint dedicado + pipeline idempotente (persistência + fila)

### Frontend
- **Web Admin:** Next.js (App Router) + React + TypeScript
- **Web Public (Landing + Wizard + Portal Anunciante):** Next.js + React + TypeScript
- **UI:** TailwindCSS + shadcn/ui
- **State/Data fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts (relatórios de entrega/valor)

### Autenticação (Login)
- **OAuth Google:** Auth.js (NextAuth) no front, validação e sessão no backend
- **Email/senha:** credenciais + hash (Argon2/bcrypt) + verificação de e-mail (opcional recomendado)

### Player (TV / Telão)
- **Plataforma recomendada (MVP sólido):** Android TV / Android Box
- **App:** Kotlin
- **Player:** ExoPlayer
- **Rede:** OkHttp
- **Persistência local:** Room + filesystem (cache de mídia)
- **Resiliência:** watchdog, auto-start, retry/backoff, cache offline
- **Telemetria:** heartbeat + Proof-of-Play (PoP) assinado

### Storage / Mídia
- **Object Storage:** S3 compatível (AWS S3 / Cloudflare R2 / MinIO local)
- **CDN:** CloudFront / Cloudflare CDN
- **Uploads:** URL assinada (presigned URL) + checksum/hash
- **Transcode (futuro):** pipeline opcional (ex.: FFmpeg job)

### Observabilidade
- **Logs:** pino/winston (estruturado) + Loki (opcional)
- **Métricas:** Prometheus
- **Tracing:** OpenTelemetry
- **Erros:** Sentry
- **Dashboards:** Grafana

### Infra / Deploy
- **Containerização:** Docker (dev + prod)
- **Dev local:** docker-compose (api + workers + postgres + redis + minio opcional)
- **Deploy recomendado:** AWS ECS Fargate *(ou Kubernetes se necessário)*
- **IaC:** Terraform
- **Secrets:** AWS Secrets Manager (ou Doppler/1Password Secrets)

### Pagamentos (Marketplace)
- **Gateway:** Asaas
- **Modelo:** conta raiz + subcontas (white-label) + KYC
- **Split:** automático no ato do pagamento (walletId plataforma + walletId tenant)
- **Pagamentos:** cartão / Pix / boleto (modelo 1: por campanha)

### Testes
- **Unit:** Vitest (ou Jest)
- **E2E Web:** Playwright
- **Integração:** Testcontainers (Postgres/Redis) + mocks Asaas

------------

## 1. Resumo executivo
**Telumi** é um SaaS para **gestão e monetização** de redes de TVs e telões em ambientes internos (recepções, clínicas, academias, varejo), combinando:

- **Operação resiliente:** player na TV com cache/offline, watchdog, heartbeat e monitoramento.
- **Marketplace de mídia indoor:** link público white-label para anunciantes criarem campanhas e pagarem.
- **Pagamentos com split automático:** no modo comercial, Telumi opera com **conta raiz + subcontas (white-label)** no Asaas e faz **split** no ato do pagamento (plataforma + dono da rede).
- **Entrega auditável:** comprovação por **Proof-of-Play** (PoP) e cálculo de “valor entregue” com barra de aproveitamento.
- **Compensação justa:** **crédito** (saldo) automático para o valor não entregue, utilizável na próxima campanha.

Telumi suporta dois modos por Tenant:
- **INTERNAL:** uso próprio (sem KYC, sem link público, sem marketplace).
- **MARKETPLACE:** venda de anúncios (subconta + KYC obrigatório).

---

## 2. Objetivos e não-objetivos

### 2.1 Objetivos (MVP)
- Multi-tenant com **Workspace (Tenant)** e RBAC.
- Cadastro de **Locations (Unidades)** e **TVs** com pareamento por QR/token.
- Player: cache offline, recuperação automática, telemetria e PoP.
- Marketplace: **CPM por Location**, Wizard público para campanha, pagamento por campanha (Modelo 1).
- Asaas: subcontas + KYC + webhooks + split.
- Inventário finito: disponibilidade por janela com **sugestões inteligentes** (cliente confirma).
- Política de entrega **B**: entregar por **TVs elegíveis por janela** (X/Y TVs).
- Portal do anunciante: campanhas, entrega (valor gasto), pagamentos e créditos.
- Portal do parceiro (TV de terceiros): link somente leitura com repasse estimado (repasse manual fora da plataforma).

### 2.2 Não-objetivos (por enquanto)
- Leilão/bidding em tempo real.
- Wallet pré-paga obrigatória (adicionar fundos antes de comprar).
- Multi-split (plataforma + rede + múltiplos parceiros).
- Medição de público real por sensores/câmeras.
- Moderação manual obrigatória de anúncios.

---

## 3. Glossário (micro-definições)
- **Tenant / Workspace:** conta do dono da rede no Telumi. Unidade de isolamento multi-tenant.
- **Mode (INTERNAL/MARKETPLACE):** modo do tenant; controla features e gates.
- **Location (Unidade):** local físico onde existem TVs. Define CPM, horários e políticas.
- **TV/Device:** tela/dispositivo que executa o player. Sempre pertence a uma Location.
- **Public TV:** TV marcada para participar do marketplace (visível para entrega comercial).
- **Window (Janela):** intervalo de horário selecionável no wizard (ex.: 09:00–12:00).
- **Slot:** unidade base de exibição (ex.: 15s). Vídeos > slot consomem múltiplos slots.
- **Fill Rate (max_ads_fill_rate):** % máximo da grade ocupada por anúncios (ex.: 20%).
- **Eligibility (TVs elegíveis):** conjunto de TVs com inventário disponível naquela janela e frequência.
- **Availability Level:** HIGH/MED/LOW/FULL — nível de disponibilidade (sem expor capacidade bruta).
- **Quote:** orçamento versionado (snapshot de regras) com validade curta; base para cobrança.
- **InventoryHold:** reserva temporária de inventário (especialmente para cartão).
- **InventoryAllocation:** alocação definitiva (após pagamento confirmado) por janela/TV.
- **PoP / PlayEvent:** evento de prova de execução do anúncio na TV (prova auditável).
- **Delivered Amount:** valor “entregue” (gasto) baseado em entrega comprovada.
- **Credit (Saldo):** crédito interno gerado por não-entrega; cupom para próxima campanha.
- **Partner TV:** TV de terceiro (clínica parceira) com portal read-only e repasse manual.

---

## 4. Personas, papéis e RBAC

### 4.1 Admin (dono da rede) — Web Admin
- **Owner:** configura tenant, locations, TVs, pricing, marketplace, usuários, relatórios.
- **Operator:** opera TVs, conteúdo, campanhas e monitoramento (sem billing sensível).
- **Finance (opcional):** vê relatórios financeiros e vendas; sem alterar inventário/TVs.
- **Viewer (opcional):** somente leitura.

### 4.2 Anunciante — Portal do Anunciante
- Usuário final que cria campanha e paga via link público do tenant.
- **Tenant-scoped** no MVP (login vinculado ao tenantSlug).

### 4.3 Parceiro de TV — Portal do Parceiro
- Terceiro com TV cedida ao dono da rede.
- Recebe apenas link de leitura para métricas agregadas e repasse estimado.

---

## 5. Modos do Tenant (Interno vs Marketplace)

### 5.1 INTERNAL
- Não cria subconta Asaas.
- Sem KYC.
- Sem link público.
- Features: TVs, playlists, schedule, media, monitoramento.

### 5.2 MARKETPLACE
- Ao finalizar onboarding: criar subconta Asaas (idempotente).
- Executar KYC (white-label).
- Até aprovação: marketplace bloqueado (public page, checkout, split).
- Após aprovação: habilitar wizard, link público e split.

---

## 6. Jornadas e fluxos

### 6.1 Admin — criação de conta e onboarding
1. **/app/signup** (nome, email, senha) ou Google.
2. **/app/onboarding/workspace** (criar tenant).
3. **/app/onboarding/mode** (INTERNAL ou MARKETPLACE).
4. Finish:
   - INTERNAL → dashboard
   - MARKETPLACE → cria subconta + inicia KYC → dashboard com marketplace bloqueado

### 6.2 Admin — cadastro de Location (Unidade)
Campos recomendados:
- Nome, endereço/bairro (opcional), timezone, status público.
- Horário de operação (dias/horas).
- **CPM_base** (por Location).
- Políticas (categorias proibidas, tamanho máximo, duração máxima).
- Fill-rate máximo (default 20%, configurável).

### 6.3 Admin — cadastro de TV
MVP (campos obrigatórios):
- Nome da TV (ex.: “Recepção 01”)
- Location vinculada
- Orientação (H/V), resolução (ou “auto detect”), status (ACTIVE/INACTIVE)
- **Public TV (sim/não)** para marketplace
- (Opcional) “TV de parceiro” + parceiro/percentual

Pareamento:
- Gerar QR/token no admin → player usa para obter deviceToken.

### 6.4 Fluxo do Anunciante (cliente final)
1. Acessa **/a/:tenantSlug** (landing).
2. Clica “Criar campanha” → se não logado: /login ou /signup.
3. Wizard cria campanha → pagamento → webhook confirma → campanha ativa.
4. Portal: acompanha entrega, pagamentos e saldo.

### 6.5 Portal do Parceiro
- Dono da rede marca TV como “parceira” e gera link.
- Parceiro acessa link e vê métricas agregadas e repasse estimado.
- Repasse é manual (fora do Telumi).

---

## 7. Experiência (UI/UX) e componentes

### 7.1 Admin — Sidebar (base)
- Dashboard
- Locais (Unidades)
- TVs
- Playlists
- Programação
- Mídias
- Monitoramento
- Usuários
- Assinatura

**Marketplace (somente MARKETPLACE e com gates):**
- KYC
- Monetização (Pricing)
- Inventário
- Página Pública
- Campanhas
- Anunciantes
- Pacotes
- Parceiros

### 7.2 Landing pública (/a/:tenantSlug)
- Branding do tenant
- Locais disponíveis (cards)
- Pacotes (opcional)
- CTA “Criar campanha” e “Entrar”

### 7.3 Portal do anunciante
- Campanhas (lista + detalhes)
- Pagamentos
- Saldo/Créditos
- Perfil

**Componentes-chave:**
- **Availability chips** (✅/⚠️/❌ com X/Y TVs)
- **Delivery bar** (% e R$ entregue)
- **Credit widget** (saldo e aplicação)
- **Campaign timeline** (por dia/janela)

### 7.4 Wizard: princípios
- Disponibilidade **sempre do backend** (Availability API).
- Sugestões “1 clique aplica”, mas **cliente confirma** antes de pagar.
- Não expor capacidade bruta nem agenda completa.

---

## 8. Precificação e inventário

### 8.1 CPM por Location
- CPM configurado na Location.
- Anunciante escolhe Location; TVs são automáticas (não escolhe TV individual no MVP).
- Política B: entrega em TVs elegíveis por janela.

### 8.2 Slot e fill-rate
- Slot default: **15s**.
- Fill-rate default: **20%** por Location.
- Capacidade calculada em **slot units**:
  - vídeo 30s = 2 slots, etc.

### 8.3 Política B (TVs elegíveis por janela)
- Para cada janela selecionada:
  - calcular **eligible_tv_count**
  - mostrar “X/Y TVs” para o anunciante
- Preço e plays planejados baseados no elegível.
- Snapshot no pagamento:
  - elegibilidade por janela (ou contagem + lista quando necessário)
- Execução tenta manter entrega conforme snapshot; realocação só dentro do mesmo local/janela quando possível.

### 8.4 Sugestões inteligentes (ordem recomendada)
1. Trocar horário (janela vizinha)
2. Reduzir frequência
3. Adicionar dias
4. Expandir janelas
5. Trocar/Adicionar local

**Sempre com confirmação do cliente**.

### 8.5 Holds e concorrência (cartão vs pix/boleto)
- **Cartão:** criar InventoryHold (10–15 min) ao entrar no checkout.
- **Pix:** permitir preferencialmente para janelas HIGH/MED com expiração curta.
- **Boleto:** opcional no MVP (ou restrito) pela confirmação tardia.

---

## 9. Pagamentos (Modelo 1) e crédito

### 9.1 Modelo 1 (pagamento direto por campanha)
- Sem “adicionar fundos” obrigatório.
- Métodos: Cartão, Pix, Boleto e Crédito interno (saldo).

### 9.2 Regra de ativação
- Campanha só vira ACTIVE após **webhook de pagamento confirmado/recebido** do Asaas.
- Sem aprovação manual.

### 9.3 Crédito (saldo) — cupom
- Crédito é gerado no **FINALIZED**:
  - credit = paidAmount - deliveredAmount
- Crédito é interno (ledger), não sacável e não transferível.
- No checkout: cliente pode aplicar crédito parcial/total.
- Se total a pagar = 0 → “Paid by Credit” (sem cobrança Asaas).

---

## 10. Asaas: subcontas, KYC, split, webhooks

### 10.1 Estrutura marketplace (conta raiz + subcontas)
- Plataforma: conta raiz.
- Cada tenant comercial: subconta.
- Split usa walletId da plataforma + walletId do tenant.

### 10.2 KYC (white-label)
- Ao criar subconta: iniciar fluxo de documentos.
- Consultar documentos pendentes:
  - se há **onboardingUrl** → cliente envia via link (cadastro.io)
  - se não há onboardingUrl → upload via API com id do grupo
- Acompanhar status até general=approved.
- Enquanto KYC não aprovado:
  - public page desabilitada
  - checkout bloqueado
  - split não utilizado

### 10.3 Webhooks
- **Account status events:** atualizam marketplace_status (KYC).
- **Payment events:** confirmam pagamento e ativam campanha automaticamente.
- Idempotência:
  - armazenar webhook_events com UNIQUE(event_id)
  - processar via worker/fila

---

## 11. Proof-of-Play (PoP) e entrega

### 11.1 Eventos PoP
O player registra PlayEvents contendo:
- campaignId, assetId, tvId
- startedAt/endedAt/duration
- manifestVersion
- assetHash
- play_id (único)

Backend valida:
- janela contratada
- device autenticado
- idempotência (unique play_id)
- consistência com manifesto/snapshot

### 11.2 Entrega e “valor gasto”
- DeliveredPercent = delivered / planned
- DeliveredAmount = paidAmount * DeliveredPercent
- RemainingAmount = paidAmount - DeliveredAmount

Portal exibe:
- barra (% e R$)
- plays planejados vs entregues
- separação “não elegível (lotado)” vs “offline/erro”

### 11.3 Fechamento (T+24h)
- Janela de tolerância para eventos sincronizados com atraso.
- Após fechamento, campanhas vão para FINALIZED e geram crédito se necessário.

---

## 12. Portal do Parceiro (TV de terceiros)

### 12.1 Modelo (sem multi-split)
- Pagamento do anunciante é split apenas (plataforma + rede).
- Parceiro recebe repasse manual.

### 12.2 Link público read-only
- URL com publicId e token (hash armazenado).
- Token rotacionável pelo admin.
- Conteúdo:
  - métricas agregadas (uso, receita estimada, repasse estimado)
  - sem dados sensíveis (anunciantes/campanhas)

---

## 13. APIs (alto nível) + contratos

### 13.1 Admin API (exemplos)
- POST/GET Locations
- POST TV + pair QR/token
- Marketplace: start KYC, fetch requirements, enable public page
- Pricing: set CPM, frequency rules, fill-rate

### 13.2 Portal API (anunciante)
- CRUD Campaign draft
- POST quote (returns availability breakdown, price breakdown, eligibility)
- POST pay (creates Asaas charge, returns instructions/qr/link)
- GET delivery summary
- Credits: balance + ledger

### 13.3 Availability API
- Input: locationId, dates, daysOfWeek, windows, frequency, creative slot units
- Output:
  - availability by window (HIGH/MED/LOW/FULL)
  - eligible_tv_count/total_tv_count
  - suggestions (ranked)
  - “apply-ready” payloads

---

## 14. DTOs, contratos e validação

### 14.1 Princípios
- DTO cruza fronteiras: HTTP, webhooks, events, provider.
- Domínio não depende de DTO.
- Mappers transformam DTO ↔ domain models.
- Versionamento por v1/v2.

### 14.2 packages/contracts
- contracts/http/v1/**: request/response DTOs compartilháveis
- contracts/events/v1/**: eventos internos (ex.: PaymentConfirmed, KycApproved)
- contracts/schemas/v1/**: Zod schemas para validação runtime

### 14.3 Integrações
- packages/integrations/asaas/types: DTOs do provider (não vazam para domínio)

---

## 15. Modelo de dados (alto nível)
Entidades principais:
- tenants, users, roles
- locations (CPM, schedule, policies)
- tvs/devices (pairing, status)
- advertisers (tenant-scoped)
- campaigns, campaign_windows, campaign_assets
- quotes (snapshots)
- payments (asaas ids)
- webhook_events
- play_events + daily aggregates
- credit_ledger
- partners, partner_tvs (public link)

---

## 16. State machines

### 16.1 Marketplace status (tenant)
- SETUP → SUBACCOUNT_CREATED → KYC_PENDING → KYC_APPROVED / KYC_REJECTED → SUSPENDED (admin platform)

### 16.2 Campaign
- DRAFT → WAITING_PAYMENT → PAID → ACTIVE → FINISHED → FINALIZED
- (PaidByCredit é variação de PAID sem Asaas)

### 16.3 Payment
- CREATED → PENDING → CONFIRMED/RECEIVED → FAILED/EXPIRED → CHARGEBACK/REFUNDED

### 16.4 Credit ledger
- CREDIT_ISSUED → CREDIT_APPLIED (parcial) → saldo restante
- CREDIT_EXPIRED (se adotado) / CREDIT_ADJUSTMENT

---

## 17. Prevenção de conflitos e “cookbook” anti-bug

### 17.1 Regras de ouro
1. **Sem inventário, sem checkout** (eligible_tv_count >= 1 por janela)
2. **Revalidar antes de cobrar** (quote validity)
3. **Ativar apenas via webhook**
4. **Idempotência em tudo** (webhook, PoP, créditos)
5. **Snapshots no pagamento** (preço, regras, elegibilidade por janela)
6. **Separar causas** (lotado vs offline)

### 17.2 Cartão vs Pix/Boleto
- Cartão: hold + confirmação rápida
- Pix: expiração curta + preferência por HIGH/MED
- Boleto: opcional/restrito para evitar “pago tarde”

### 17.3 Mudanças pelo admin
- Mudança de CPM, schedule, fill-rate só afeta campanhas novas.
- Desativar TV em campanha ativa exige confirmação e aviso (“pode gerar crédito”).

### 17.4 Webhook atrasou/falhou
- Reconciliador periódico consulta Asaas para corrigir estados pendentes.

---

## 18. Workspace/Monorepo (árvore) e boas práticas

> **Princípio:** `apps/` executáveis, `packages/` bibliotecas e domínios, `integrations/` único ponto de contato com providers.

### 18.1 Árvore (detalhada)
```text
telumi/
├─ apps/
│  ├─ api/                          # HTTP API + webhook ingestion
│  │  ├─ src/
│  │  │  ├─ http/                   # controllers, middleware, auth, rate-limit
│  │  │  ├─ webhooks/               # endpoints: asaas
│  │  │  ├─ modules/                # DI / composition root
│  │  │  └─ bootstrap/              # init, healthchecks
│  │  └─ Dockerfile
│  ├─ workers/                      # consumers/jobs (outbox, webhooks processing, aggregates)
│  │  ├─ src/
│  │  │  ├─ consumers/
│  │  │  ├─ jobs/
│  │  │  └─ bootstrap/
│  │  └─ Dockerfile
│  ├─ web-admin/                    # painel do dono da rede
│  ├─ web-public/                   # landing + wizard anunciante + portal anunciante
│  └─ player-tv/                    # player (kiosk) + cache + PoP
├─ packages/
│  ├─ core/                         # Result/Either, errors, primitives
│  ├─ config/                       # env schema, tsconfig, eslint
│  ├─ observability/                # logger, metrics, tracing
│  ├─ contracts/                    # DTOs versionados + schemas (Zod)
│  ├─ tenancy/                      # tenant, modes, capabilities, RBAC helpers
│  ├─ identity/                     # auth, sessions, device tokens
│  ├─ media/                        # upload, storage abstraction, hashing
│  ├─ devices/                      # TVs, heartbeat, status
│  ├─ playback/                     # schedule resolver, manifest builder
│  ├─ advertising/                  # campaigns, advertisers (domain + usecases)
│  ├─ pricing-engine/               # CPM location + rules (freq/duration/floor)
│  ├─ inventory-engine/             # availability, holds, allocations (finite inventory)
│  ├─ marketplace-finance/          # payments, split policy, ledger, reconciliation
│  └─ integrations/
│     └─ asaas/                     # único ponto Asaas (client + types + adapters)
├─ database/
│  ├─ migrations/
│  ├─ schema/
│  └─ seeds/
├─ infra/
│  ├─ docker/                       # compose dev
│  ├─ ci/
│  └─ terraform/
├─ docs/
│  ├─ product/
│  ├─ architecture/
│  ├─ runbooks/
│  └─ asaas/
└─ scripts/
```

### 18.2 Boas práticas para evitar duplicidade
- Um único `integrations/asaas` (nunca chamar Asaas fora dele).
- Webhooks sempre entram por `apps/api` e são processados em `apps/workers`.
- `contracts/` como fonte de DTOs versionados.
- Domínio (packages/*/domain) sem imports de infra.

---

## 19. Observabilidade, segurança e LGPD
- Logs estruturados (requestId, tenantId, campaignId).
- Métricas: TVs online, lag de webhook, plays/min, falhas de download.
- Segurança:
  - segregação multi-tenant
  - tokens rotacionáveis do parceiro
  - segredos no vault/KMS (api keys Asaas, device secrets)
- LGPD:
  - coletar somente necessário; IP apenas como diagnóstico (opcional)
  - retenção de logs brutos limitada

---

## 20. Parâmetros default e decisões finais
**Defaults:**
- slot = 15s
- fill-rate = 20%
- max criativos por campanha = 5
- fechamento = T+24h
- pix: expira ~60 min; preferir janelas HIGH/MED
- boleto: opcional/restrito (decisão operacional)

**Decisões fechadas:**
- Modelo 1 (paga por campanha; sem wallet obrigatória)
- sem aprovação manual
- CPM por Location
- Política B (TVs elegíveis por janela)
- crédito interno para não-entrega (saldo/cupom)
- portal parceiro read-only; repasse manual; sem multi-split no MVP

---

## 21. Backlog sugerido (MVP)
1. Multi-tenant + RBAC + onboarding (INTERNAL/MARKETPLACE)
2. Locations + TVs + pareamento + player básico
3. Marketplace: KYC subconta (onboardingUrl/upload) + gates
4. Pricing engine (CPM Location) + inventory engine (availability + policy B)
5. Wizard anunciante + checkout (cartão/pix/boleto) + split
6. Webhooks + idempotência + reconciliador
7. PoP + agregação + portal (barra de valor)
8. Crédito ledger + aplicação no checkout
9. Portal parceiro read-only + token rotacionável
10. Observabilidade + runbooks + hardening

---
## Apêndice A — Regras faltantes (fechamento do PRD)

### A1) Política oficial de entrega (PoP) e “TV online” (gasto vs relatório)
**Objetivo:** garantir que o anunciante só veja “valor gasto/entregue” quando houver execução comprovada, com critérios claros e auditáveis.

#### A1.1 Definições
- **Heartbeat TTL:** uma TV é considerada **ONLINE** se `now - last_seen_at <= 90s` (default).
- **PoP (Proof-of-Play):** evento emitido pelo player quando o criativo é exibido.

#### A1.2 Categorias de entrega
- **Delivered (Online-Verified):** conta para *deliveredPlays* e *deliveredAmount* quando:
  1) PoP válido (assinatura/device ok, idempotente),
  2) PoP dentro da janela contratada,
  3) TV online no momento do play (TTL).

- **Delivered (Offline-Synced):** PoP sincronizado depois (TV estava sem rede no momento):
  - **Regra Telumi (MVP):** aparece no relatório como “Sincronizado depois”, mas **NÃO conta** para *deliveredAmount* (valor gasto).
  - Motivo: alinhamento com a regra “só gasto se online no ato”.

- **Not Eligible (Lotado):** TV não estava elegível naquela janela (não foi vendida para aquela janela):
  - aparece como “Indisponível por inventário (lotado)”
  - **não gera crédito por lotação** porque não foi vendido.

#### A1.3 Fórmulas
- `deliveredPercent = deliveredPlaysOnlineVerified / plannedPlays`
- `deliveredAmount = paidAmount * deliveredPercent`
- `creditAmount = max(0, paidAmount - deliveredAmount)` (gerado no FINALIZED)

---

### A2) Alertas operacionais + Runbooks (imprevisibilidades)
**Objetivo:** reduzir falhas de execução e dar visibilidade ao dono da rede.

#### A2.1 Alertas (mínimo do MVP)
- **TV_OFFLINE:** sem heartbeat acima do TTL configurado.
- **TV_NO_CONTENT_UPDATE:** TV online, mas sem atualizar manifesto por X horas (ex.: 6h).
- **DOWNLOAD_FAILED:** falha ao baixar mídia (com retries excedidos).
- **ASSET_CORRUPTED:** checksum/hash divergente.
- **PLAYER_CRASH_LOOP:** reinícios frequentes (watchdog detecta).
- **LOW_STORAGE:** armazenamento abaixo de limiar (ex.: < 500MB).

#### A2.2 Regras anti-spam
- Deduplicar por `(tvId, alertType)` com janela (ex.: 30 min).
- “Silence window” configurável por Location (ex.: noite).
- Escalonamento (opcional): se offline > 2h, elevar severidade.

#### A2.3 Canais
- Admin do Tenant: Email (MVP) + webhook (opcional).
- Notificações no painel: inbox de alertas.

#### A2.4 Runbook (ações recomendadas)
- **TV_OFFLINE:** checar energia → checar internet → reiniciar player → verificar cache/manifesto.
- **DOWNLOAD_FAILED/ASSET_CORRUPTED:** limpar cache parcial → rebaixar qualidade (se existir) → republicar.
- **CRASH_LOOP:** reiniciar app → atualizar versão → coletar logs.

---

### A3) Política Pix/Boleto quando pagamento confirma sem inventário
**Objetivo:** evitar conflitos de “paguei e não cabe mais”.

#### A3.1 Regras de aceitação (checkout)
- **Cartão:** permitido em qualquer availability (com InventoryHold).
- **Pix:** permitido apenas para janelas HIGH/MED e com expiração curta (default 60 min).
- **Boleto:** opcional/restrito no MVP (confirmar tarde aumenta risco). Se habilitado: expiração curta e preferir HIGH.

#### A3.2 Regra quando pagamento confirma e inventário ficou insuficiente
Quando webhook confirma pagamento e não é possível alocar inventário conforme quote snapshot:
1) Telumi coloca campanha em `NEEDS_RESCHEDULE` (estado interno transiente).
2) Sistema gera **3 sugestões** (trocar horário, reduzir frequência, adicionar dias) e notifica o anunciante no portal.
3) O anunciante **precisa confirmar** uma alternativa (1 clique) para ativar.
4) Se anunciante recusar (ou expirar janela de escolha, ex.: 48h):
   - gerar **crédito integral** (100% do valor) e encerrar campanha como `CANCELED_BY_INVENTORY`.

> Observação: isso deve ser raro se Pix/Boleto for restrito a HIGH/MED.

---

### A4) Política de cancelamento, pausa e expiração de crédito
**Objetivo:** regras previsíveis para cliente e rede.

#### A4.1 Cancelamento antes do início
- Se campanha está `WAITING_PAYMENT`: cancelamento livre (sem cobrança).
- Se `PAID` mas ainda não iniciou (startDate futuro): converter 100% em crédito (default).

#### A4.2 Pausa pelo anunciante (MVP)
- **MVP:** não oferecer “pausar campanha” ao anunciante (reduz disputas).
- (Fase 2) Se habilitar pausa: gerar crédito proporcional apenas para a parte não entregue.

#### A4.3 Expiração do crédito (default)
- Créditos expiram em **90 dias** (configurável globalmente).
- Ledger registra `CREDIT_EXPIRED` no vencimento.
- Aviso no portal: “expira em dd/mm”.

---

### A5) Rateio de receita por TV (para Portal do Parceiro)
**Objetivo:** calcular “receita gerada pela TV” sem expor campanhas/anunciantes.

#### A5.1 Regra de rateio (recomendado)
- Base: **slot units entregues (Online-Verified PoP)** por TV no período.
- Para cada campanha no período:
  - calcular `deliveredSlotUnitsByTv`
  - ratear `deliveredAmount` proporcionalmente:
    - `tvShare = deliveredSlotUnitsByTv / totalDeliveredSlotUnitsCampaign`
    - `tvRevenue += deliveredAmountCampaign * tvShare`

#### A5.2 Repasse estimado
- `partnerPayoutEstimate = tvRevenue * partnerRevenueSharePercent`

#### A5.3 Privacidade
- Portal do parceiro exibe apenas agregados:
  - receita por dia/mês
  - ocupação/uso
  - repasse estimado
- Não exibe nomes de anunciantes, criativos ou campanhas.

---

### A6) Matriz de gates/capabilities (regras de permissão por status)
**Objetivo:** evitar “tela mostra botão mas a ação falha” e garantir consistência entre front e back.

#### A6.1 Gates por modo do Tenant
- Se `tenant.mode == INTERNAL`:
  - bloquear todas rotas e ações marketplace (`/app/marketplace/*`, `/a/:slug` checkout, etc.)
- Se `tenant.mode == MARKETPLACE`:
  - aplicar gates adicionais por `marketplace_status`.

#### A6.2 Gates por marketplace_status
- `KYC_PENDING`:
  - permitido: configurar pricing/inventário (opcional), cadastrar TVs/locais.
  - bloqueado: habilitar página pública, aceitar pagamentos, criar cobranças com split.
- `KYC_APPROVED`:
  - permitido: habilitar página pública, wizard, checkout, split.
- `KYC_REJECTED`:
  - bloqueado: vendas.
  - permitido: reenvio/correção de documentos.
- `SUSPENDED`:
  - bloqueado: todas vendas e checkout.

#### A6.3 Gates por “marketplace ready check”
Para permitir `public_page_enable` e `wizard_submit`:
- `public_page_enabled = true`
- `marketplace_status = KYC_APPROVED`
- Location pública tem pelo menos 1 TV ativa e pública
- Pricing mínimo configurado (CPM_base + regras de frequência)
- Split disponível (walletId tenant + walletId plataforma)

#### A6.4 Gates por status de campanha
- `WAITING_PAYMENT`: pode pagar / cancelar.
- `ACTIVE`: pode visualizar entrega; admin pode pausar (opcional).
- `FINALIZED`: pode gerar crédito; não permite alterar parâmetros.

---