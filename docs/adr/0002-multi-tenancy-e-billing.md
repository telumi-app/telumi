# ADR-0002: Multi-Tenancy e Boundaries de Billing

**Status:** Aceito  
**Data:** 2026-02-27  
**Contexto:** Definir estratégia de multi-tenancy e isolamento do provider de pagamento.

## Decisão

### Multi-Tenancy: workspaceId everywhere

Toda tabela de domínio de negócio inclui a coluna `workspaceId` como FK para `Workspace`.

**Regras:**
1. **workspaceId nunca vem do body** em operações comuns — é derivado do JWT do usuário autenticado.
2. **Toda query de domínio filtra por workspaceId** — via middleware/interceptor no NestJS.
3. **Índices compostos** incluem `workspaceId` como primeiro campo para performance.
4. **Tabelas globais** (ex.: configurações de plataforma) são a exceção explícita e documentada.

**Modelo:**
```
Workspace
  ├── User (workspaceId)
  ├── Device (workspaceId)
  ├── MediaAsset (workspaceId)
  ├── Playlist (workspaceId)
  ├── Schedule (workspaceId)
  └── ... (toda entidade de negócio)
```

### Estratégia de banco: Single Database, Shared Schema

Usamos **uma única base PostgreSQL** com isolamento lógico por `workspaceId`.

**Motivos:**
- Simples de operar e migrar no MVP.
- Prisma não suporta nativamente schema-per-tenant.
- RLS (Row Level Security) pode ser adicionado futuramente sem mudança de schema.

**Preparação para escala:**
- A coluna `workspaceId` em todas as tabelas permite migração futura para RLS ou database-per-tenant.
- O código de aplicação nunca assume acesso cross-tenant.

### Billing: Interface abstrata + Adapter isolado

O módulo de pagamento é isolado em `packages/billing`:

```typescript
// packages/billing/src/billing-provider.interface.ts
export interface BillingProvider {
  createCustomer(input: CreateCustomerInput): Promise<Customer>;
  createCharge(input: CreateChargeInput): Promise<Charge>;
  cancelCharge(chargeId: string): Promise<void>;
  handleWebhook(payload: unknown): Promise<WebhookResult>;
}
```

**Regras:**
1. **Nenhum código fora de `packages/billing`** pode importar SDK/HTTP client do Asaas.
2. **`apps/api`** depende apenas da interface `BillingProvider`, injetada via DI do NestJS.
3. **`AsaasBillingProvider`** é a implementação concreta, registrada no módulo de billing.
4. **Webhooks do Asaas** entram via endpoint em `apps/api`, mas a lógica de parsing/validação fica em `packages/billing`.

**MVP:** implementação stub (métodos retornam `TODO` / throw `NotImplemented`).

### Preparação para White-Label (sem implementar agora)

A arquitetura suporta subcontas futuras:
- `Workspace` pode ganhar campos como `parentWorkspaceId`, `billingAccountId`.
- O `BillingProvider` pode ser estendido para `createSubAccount`.
- Nenhum código atual assume que existe apenas um nível de tenant.

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|------------|-------------------|
| Schema-per-tenant | Complexo demais para MVP; Prisma não suporta bem |
| Database-per-tenant | Over-engineering para < 100 tenants |
| Billing inline no controller | Acoplamento; impossível trocar provider |
| Chamar Asaas direto nos services | Viola single responsibility; dificulta teste e troca |

## Consequências

- Todo PR que adicionar tabela nova DEVE incluir `workspaceId` (review checklist).
- Testes devem validar que queries filtram por workspace (não retornam dados de outro tenant).
- Billing pode ser trocado de provider (Asaas → Stripe) alterando apenas `packages/billing`.
