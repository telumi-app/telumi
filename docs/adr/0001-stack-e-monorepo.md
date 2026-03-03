# ADR-0001: Stack e Monorepo

**Status:** Aceito  
**Data:** 2026-02-27  
**Contexto:** Decisão de stack e organização do repositório para o MVP do Telumi.

## Decisão

### Monorepo com Turborepo + pnpm

Adotamos **Turborepo** como orquestrador de monorepo e **pnpm** como package manager.

**Motivos:**
- Turborepo oferece caching inteligente, pipelines paralelos e zero-config para workspaces pnpm.
- pnpm é mais rápido e eficiente em disco que npm/yarn, com suporte nativo a workspaces.
- Monorepo permite compartilhar código (DTOs, types, configs) sem publish/versioning manual.

### Organização

```
apps/       → executáveis (API, Admin Web, Player)
packages/   → bibliotecas internas (db, billing, shared, configs)
infra/      → Docker Compose e scripts de infra
docs/       → ADRs e documentação técnica
```

**Regra:** `apps/` nunca importa de outro `app/`. Toda dependência compartilhada vive em `packages/`.

### Backend: NestJS + Prisma + PostgreSQL

- **NestJS** com adapter Fastify (REST + OpenAPI) — DI nativo, guards, interceptors, modularização por domínio.
- **Prisma** como ORM — type-safe, migrations declarativas, geração de client.
- **PostgreSQL 16** — robusto, suporte a JSON, extensões maduras.

### Frontend: Next.js 14 (App Router) + Tailwind

- **Next.js** com App Router para Admin e Player como apps separados.
- **Tailwind CSS** + **shadcn/ui** para UI — componentes headless, fáceis de customizar.

### Cache/Fila: Redis

- Subir Redis no docker-compose desde o dia 1.
- Uso imediato: cache de sessão, rate limiting.
- Uso futuro: BullMQ para jobs/workers.

### Qualidade

- ESLint + Prettier com configs compartilhadas em `packages/`.
- Husky + lint-staged para pre-commit.
- commitlint para Conventional Commits.
- Vitest para testes unitários.

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|------------|-------------------|
| Nx | Mais complexo para o tamanho atual; Turborepo é suficiente |
| Yarn Berry | pnpm tem melhor performance e adoção em monorepos |
| Express puro | Falta DI, guards, modularização nativa |
| Drizzle ORM | Prisma tem melhor DX para migrations e geração de tipos |
| Polyrepo | Duplicação de configs, dificuldade de compartilhar tipos |

## Consequências

- Todo novo pacote/app segue a convenção `packages/` ou `apps/`.
- Configs de lint/ts são herdadas de `packages/eslint-config` e `packages/tsconfig`.
- CI roda `turbo run lint typecheck test build` com cache.
