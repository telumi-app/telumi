# Telumi — SaaS Indoor (Digital Signage)

Marketplace de mídia indoor + operação de player para redes de TVs e telões.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | Turborepo + pnpm + TypeScript |
| Backend | NestJS (REST) + Prisma + PostgreSQL |
| Cache/Fila | Redis 7 (BullMQ futuro) |
| Admin Web | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Player | Next.js 14 (app separado) |
| Infra local | Docker Compose (Postgres + Redis) |
| Qualidade | ESLint + Prettier + Husky + lint-staged + commitlint |
| Auth | JWT + RBAC (role enum) |
| Billing | Interface abstrata (Asaas adapter futuro) |

## Estrutura

```
telumi/
├── apps/
│   ├── api/              # NestJS REST API
│   ├── admin-web/        # Next.js — painel do admin
│   └── player/           # Next.js — player TV
├── packages/
│   ├── db/               # Prisma schema + migrations + client
│   ├── shared/           # tipos, helpers, constantes compartilhados
│   ├── billing/          # interface BillingProvider + stubs
│   ├── eslint-config/    # config ESLint compartilhada
│   └── tsconfig/         # tsconfig bases compartilhados
├── infra/
│   └── docker-compose.yml
├── docs/
│   └── adr/              # Architecture Decision Records
└── _docs/                # PRD e documentos do produto
```

## Pré-requisitos

- Node.js >= 20 LTS
- pnpm >= 9
- Docker + Docker Compose

## Como rodar localmente

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir infra (Postgres + Redis)
docker compose -f infra/docker-compose.yml up -d

# 3. Configurar variáveis de ambiente
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# 4. Rodar migrações e seed (após FASE 2)
pnpm db:migrate
pnpm db:seed

# 5. Iniciar todos os apps em dev
pnpm dev
```

## Scripts principais

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Inicia API + Admin + Player em paralelo |
| `pnpm build` | Build de todos os apps/packages |
| `pnpm lint` | Lint em todo o monorepo |
| `pnpm typecheck` | Type-check em todo o monorepo |
| `pnpm test` | Roda testes em todo o monorepo |
| `pnpm db:migrate` | Aplica migrações Prisma |
| `pnpm db:seed` | Seed do banco |
| `pnpm db:studio` | Abre Prisma Studio |

## Convenções

- **Idioma de código:** inglês (nomes de pastas, tabelas, variáveis)
- **Multi-tenant:** toda tabela de negócio tem `workspaceId`
- **API versionada:** `/v1/...`
- **Módulos NestJS:** organizados por domínio
- **Billing isolado:** nunca chamar provider fora de `packages/billing`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)

## Licença

Proprietário — Telumi © 2026
