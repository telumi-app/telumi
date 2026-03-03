# Convenções e Boas Práticas — Telumi

**Última atualização:** 2026-03-01

Este documento descreve as convenções de código, boas práticas e padrões arquiteturais adotados no projeto Telumi. Deve ser lido por qualquer desenvolvedor antes de contribuir com o codebase.

---

## 1. Organização do Monorepo

```
apps/       → aplicações executáveis (nunca se importam entre si)
packages/   → bibliotecas internas compartilhadas
infra/      → docker-compose e scripts de infra
docs/       → ADRs, arquitetura, status de implementação
```

**Regra central:** `apps/` nunca importa de outro `app/`. Toda lógica ou tipo compartilhado vive em `packages/`.

### Packages existentes

| Package | Responsabilidade |
|---|---|
| `packages/db` | Prisma schema, migrations, client, seed |
| `packages/shared` | constantes e tipos globais |
| `packages/ui` | componentes shadcn/ui compartilháveis |
| `packages/billing` | abstração do provider Asaas |
| `packages/tsconfig` | tsconfigs base reutilizáveis |
| `packages/eslint-config` | configs ESLint compartilhadas |

---

## 2. Backend (NestJS + Fastify)

### 2.1 Estrutura de módulo

Cada domínio segue a estrutura:

```
src/{domínio}/
  {domínio}.module.ts        → registro do módulo NestJS
  {domínio}.controller.ts    → endpoints autenticados (JWT)
  {domínio}-public.controller.ts  → endpoints sem auth (ex: pair, heartbeat)
  {domínio}-stream.controller.ts  → SSE quando aplicável
  {domínio}.service.ts       → toda a lógica de negócio
  dto/
    create-{domínio}.dto.ts
    update-{domínio}.dto.ts
  constants/
    error-codes.ts           → enum de códigos de erro do domínio
    index.ts
  guards/                    → guards específicos do módulo
  utils/                     → funções puras do domínio
```

### 2.2 Controllers

- **Controllers apenas orquestram** — sem lógica de negócio.
- Recebem `@CurrentUser() user: AuthUser` via decorator (nunca do body).
- `workspaceId` é sempre derivado do JWT, nunca do request body.
- Todos os endpoints têm `@ApiOperation()` para o Swagger.

```typescript
// ✅ Correto
@Post()
create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
  return this.devicesService.create(user.workspaceId, dto);
}

// ❌ Errado — workspaceId no body é vulnerabilidade de tenant poisoning
@Post()
create(@Body() dto: CreateDeviceWithWorkspaceDto) { ... }
```

### 2.3 Services

- **Toda lógica de negócio fica no service.**
- Services recebem `workspaceId` como primeiro parâmetro em toda operação de domínio.
- Lançam `HttpException` tipadas (`NotFoundException`, `ForbiddenException`, `ConflictException`).
- **Nunca lançam strings brutas** — sempre objetos com `{ code, message }`.

```typescript
// ✅ Correto
throw new NotFoundException({
  code: DeviceErrorCode.DEVICE_TOKEN_INVALID,
  message: 'Dispositivo não encontrado para este token.',
});

// ❌ Errado
throw new Error('not found');
throw new NotFoundException('not found'); // sem code
```

### 2.4 DTOs

- Usam `class-validator` + `class-transformer`.
- Campos opcionais com `@IsOptional()` antes das demais anotações.
- Validações de negócio no service, não no DTO.

### 2.5 Códigos de erro

Cada módulo tem seu `constants/error-codes.ts` com um enum:

```typescript
export enum DeviceErrorCode {
  LOCATION_NOT_IN_WORKSPACE  = 'LOCATION_NOT_IN_WORKSPACE',
  DEVICE_LIMIT_REACHED       = 'DEVICE_LIMIT_REACHED',
  DEVICE_NAME_DUPLICATE      = 'DEVICE_NAME_DUPLICATE',
  // ...
}
```

Os erros HTTP sempre retornam `{ code: string, message: string }` no corpo. Isso permite que o frontend diferencie o tipo de erro sem depender de strings de mensagem.

### 2.6 Multi-tenancy

- **Toda** tabela de domínio tem `workspaceId`.
- Toda query de busca inclui `where: { ..., workspaceId }`.
- Índices compostos sempre começam com `workspaceId`.

```prisma
// ✅ sempre
@@index([workspaceId])
@@unique([workspaceId, name])
```

### 2.7 Rate limiting

Endpoints públicos (sem auth) usam `@nestjs/throttler` com `FastifyThrottlerGuard`:

- TTL em **segundos** (não milissegundos).
- Throttle por rota com `@Throttle({ short: { ttl: 60, limit: N } })`.
- Limites conservadores em endpoints de autenticação/pareamento.

### 2.8 Testes

- Testes unitários com **Vitest** em `src/{domínio}/{domínio}.service.spec.ts`.
- Dependências externas (Prisma, crypto) são mocadas via `vi.mock()`.
- Cada caso de teste: `arrange → act → assert`.
- Testes de erro verificam tipo da exceção e o código de erro:

```typescript
await expect(service.pairDevice('EXPIRED')).rejects.toThrow(GoneException);
```

---

## 3. Frontend (Next.js — Admin Web)

### 3.1 Estrutura de pastas

```
src/
  app/
    (auth)/         → rotas de login/registro (sem sidebar)
    (app)/          → rotas do painel (com sidebar e autenticação)
    onboarding/     → fluxo de onboarding
  components/
    atoms/          → componentes mínimos (sem estado de negócio)
    molecules/      → composições de atoms
    organisms/      → componentes complexos com estado (wizards, cards)
    ui/             → shadcn/ui components
    maps/           → componentes de mapa (Google Places)
  hooks/            → hooks reutilizáveis
  lib/
    api/            → funções de chamada à API (por domínio)
    auth/           → helpers de sessão
    validation/     → Zod schemas de validação de formulários
```

### 3.2 Client API (`lib/api/`)

- Um arquivo por domínio: `devices.ts`, `locations.ts`, `auth.ts`.
- Toda chamada passa por `authenticatedRequest<T>()` que injeta o token JWT.
- Erros de rede têm mensagem amigável padronizada.
- Os tipos de request/response são exportados junto com a API:

```typescript
export type Device = { ... };
export const devicesApi = {
  list: () => authenticatedRequest<Device[]>('/devices', 'GET'),
  create: (payload: CreateDevicePayload) => ...,
};
```

### 3.3 Convenções de componente

- **Organisms** gerenciam estado de negócio; atoms/molecules são stateless.
- Nunca colocar lógica de API diretamente em páginas — usar `lib/api/`.
- `'use client'` apenas onde necessário (interatividade).
- Validação de formulários com **Zod** (`lib/validation/`), sem lógica duplicada no handler.

### 3.4 Tratamento de erros no UI

- Erros de validação exibidos inline (próximo ao campo).
- Erros de API exibidos em área dedicada no formulário.
- Erros de rede exibem mensagem genérica amigável.
- Ações destrutivas (excluir) sempre pedem confirmação em dialog separado.

### 3.5 Hidratação (SSR / Client)

- Componentes que dependem de `window`, `localStorage` ou IDs aleatórios usam `mounted` state para evitar divergência SSR/client:

```tsx
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => { setMounted(true) }, []);
if (!mounted) return fallback;
```

---

## 4. Schema Prisma

### 4.1 Convenções de nomenclatura

- Nomes de modelo em **PascalCase** singular: `Device`, `Location`, `Workspace`.
- Nomes de campo em **camelCase** no schema; mapeados para **snake_case** no banco via `@map`.
- Nomes de tabela em **snake_case** plural via `@@map`.

```prisma
model Device {
  workspaceId String @map("workspace_id")
  @@map("devices")
}
```

### 4.2 Campos obrigatórios em toda entidade de domínio

```prisma
id          String   @id @default(cuid())
workspaceId String   @map("workspace_id")
createdAt   DateTime @default(now()) @map("created_at")
updatedAt   DateTime @updatedAt @map("updated_at")
```

### 4.3 Cascades

- Toda FK de domínio usa `onDelete: Cascade` para garantir limpeza automática.
- Nunca deixar registros órfãos (heartbeats sem device, eventos sem device, etc.).

### 4.4 Migrations

- Geradas com `npx prisma migrate dev --name <descricao>` dentro de `packages/db`.
- Nome descritivo em inglês snake_case: `add_partner_telemetry_pop`.
- Nunca editar um arquivo de migration já aplicado.

---

## 5. Segurança

| Prática | Onde |
|---|---|
| `workspaceId` sempre do JWT, nunca do body | todos os controllers autenticados |
| `deviceToken` / `deviceSecret` gerados com `randomBytes(32)` | `devices.service.ts` |
| HMAC-SHA256 para validação de Proof-of-Play | `devices.service.ts` |
| Rate limiting em todos os endpoints públicos | `FastifyThrottlerGuard` |
| Nunca logar `deviceSecret`, tokens ou API keys | boa prática geral |
| Secrets em variáveis de ambiente (`.env`) | nunca hardcoded |

---

## 6. Git e Commits

- Commits seguem **Conventional Commits** (configurado em `commitlint.config.js`):
  - `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- PRs focados em uma feature/fix por vez.
- Cada feature nova deve ter testes unitários cobrindo os casos principais.
