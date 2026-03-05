# Estado do Ambiente de Produção — Telumi

> **Última atualização:** 03/03/2026  
> **Responsável:** telumi.suporte@gmail.com

---

## 1. Visão Geral da Infraestrutura

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO FINAL                            │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
        telumi.com.br             player.telumi.com.br
                │                         │
    ┌───────────▼──────────┐  ┌───────────▼──────────┐
    │   telumi-admin-web   │  │    telumi-player      │
    │   (Vercel)           │  │   (Vercel)            │
    │   Next.js 15         │  │   Next.js 15          │
    └───────────┬──────────┘  └───────────┬──────────┘
                │                         │
                └──────────┬──────────────┘
                           │ HTTPS
              telumiapi-production.up.railway.app
                           │
              ┌────────────▼────────────┐
              │     @telumi/api         │
              │  (Railway)              │
              │  NestJS + Fastify       │
              │  Porta: 3001            │
              └──────┬──────────┬───────┘
                     │          │
          ┌──────────▼──┐  ┌────▼──────────────┐
          │  Postgres   │  │      Redis         │
          │  (Railway)  │  │   (Railway)        │
          │  Porta 5432 │  │   Porta 6379       │
          └─────────────┘  └────────────────────┘
```

---

## 2. Repositório Git

| Campo            | Valor                                              |
|------------------|----------------------------------------------------|
| Repositório      | https://github.com/telumi-app/telumi               |
| Branch principal | `main`                                             |
| Estratégia       | Trunk-based — commits diretos na `main`            |
| CI/CD            | Push em `main` → deploy automático (Vercel + Railway) |
| Monorepo         | pnpm workspaces + Turborepo                        |

### Commits recentes relevantes

| Hash      | Descrição                                                  |
|-----------|------------------------------------------------------------|
| `55fb1d8` | fix(admin-web): normalizar domínio da API nos dispositivos |
| `1275e5d` | fix(player): usar domínio do painel como fallback no QR    |
| `272ed72` | fix(player): normalizar domínio da API em produção         |
| `cfa1fe8` | fix(admin-web): ajustar payload tipado em login e registro |

---

## 3. Vercel — Apps Frontend

**Conta/Time:** `telumi` (telumi.suporte@gmail.com)  
**Team ID:** `team_NzgyZLTEH6fDHm6BKcbXRe0E`

### 3.1 `telumi-admin-web` (Painel Administrativo)

| Campo              | Valor                                                      |
|--------------------|------------------------------------------------------------|
| **Projeto ID**     | `prj_OudJ3SnCrc1WTNQu48DzL8HV3PCo`                        |
| **Domínio**        | `telumi.com.br` / `www.telumi.com.br`                      |
| **Root Directory** | `apps/admin-web`                                           |
| **Framework**      | Next.js                                                    |
| **Node version**   | 24.x                                                       |
| **Deploy trigger** | Push em `main`                                             |

#### Variáveis de Ambiente (Production)

| Variável                          | Valor configurado                                    | Visibilidade |
|-----------------------------------|------------------------------------------------------|--------------|
| `NEXT_PUBLIC_API_URL`             | `https://telumiapi-production.up.railway.app`        | Pública      |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyA9HuhSC8uIfB9EtHF2Dcyb8UsQSgdRQwE`           | Pública      |

> ⚠️ `NEXT_PUBLIC_*` são variáveis baked no bundle durante o build — qualquer alteração exige um **novo deploy** para entrar em vigor.

---

### 3.2 `telumi-player` (Player Web)

| Campo              | Valor                                                      |
|--------------------|------------------------------------------------------------|
| **Projeto ID**     | `prj_IYEXAsA7Q0SfdnanKpvMeDNqGyM1`                        |
| **Domínio**        | `player.telumi.com.br`                                     |
| **Root Directory** | `apps/player`                                              |
| **Framework**      | Next.js                                                    |
| **Node version**   | 24.x                                                       |
| **Deploy trigger** | Push em `main`                                             |

#### Variáveis de Ambiente (Production)

| Variável                | Valor configurado                                    | Visibilidade |
|-------------------------|------------------------------------------------------|--------------|
| `NEXT_PUBLIC_API_URL`   | `https://telumiapi-production.up.railway.app`        | Pública      |
| `NEXT_PUBLIC_PLAYER_URL`| `https://telumiplayer-production.up.railway.app`     | Pública/Privada |

---

## 4. Railway — Backend e Infraestrutura

> **Serviços ativos:** Postgres, Redis, @telumi/api, @telumi/player, Bucket (MinIO), Console (MinIO)

**Conta:** Telumi (telumi.suporte@gmail.com)  
**Projeto:** `talented-upliftment`  
**Project ID:** `cc4fcbec-2750-47b9-8f01-d1d34fa53a5f`  
**Environment ID:** `028bb3b8-7753-4f68-98a1-e26cfdccbda3`  
**CLI linkado em:** `/Users/blendstudio/Projects/telumi` (raiz do monorepo)

### 4.1 Serviço `@telumi/api` (NestJS)

| Campo                | Valor                                              |
|----------------------|----------------------------------------------------|
| **Service ID**       | `c7a47812-46bd-4db5-8d50-ecb3db1f898a`             |
| **URL pública**      | `https://telumiapi-production.up.railway.app`      |
| **Domínio privado**  | `telumiapi.railway.internal`                       |
| **Porta**            | `3001`                                             |
| **Deploy trigger**   | Push em `main`                                     |

#### Variáveis de Ambiente

| Variável              | Valor / Descrição                                          |
|-----------------------|------------------------------------------------------------|
| `NODE_ENV`            | `production`                                               |
| `API_PORT`            | `3001`                                                     |
| `DATABASE_URL`        | `postgresql://postgres:***@postgres.railway.internal:5432/railway` |
| `REDIS_URL`           | `redis://default:***@redis.railway.internal:6379`          |
| `REDIS_HOST`          | `redis.railway.internal`                                   |
| `REDIS_PORT`          | `6379`                                                     |
| `JWT_SECRET`          | `sua-chave-secreta-longa-e-aleatoria-aqui` ⚠️ **TROCAR!** |
| `JWT_EXPIRES_IN`      | `7d`                                                       |
| `PLAYER_URL`          | `https://player.telumi.com.br`                             |
| `PLAYER_RECOVERY_URL` | `https://player.telumi.com.br`                             |

> ⚠️ **AÇÃO PENDENTE URGENTE:** `JWT_SECRET` está com valor de placeholder. Substituir por uma string aleatória de pelo menos 64 caracteres antes de ir para produção real.
>
> Gerar um segredo seguro: `openssl rand -hex 64`

---

### 4.2 Serviço `Postgres`

| Campo                | Valor                                              |
|----------------------|----------------------------------------------------|
| **Service ID**       | `406f90db-52f9-45bb-a880-0cde24c49b71`             |
| **Host interno**     | `postgres.railway.internal:5432`                   |
| **Host público**     | `centerbeam.proxy.rlwy.net:27985`                  |
| **Database**         | `railway`                                          |
| **User**             | `postgres`                                         |
| **Volume**           | `postgres-volume`                                  |

#### Conexão

```
# Interna (dentro do Railway — usar na API)
DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway

# Pública (uso externo — migrations, inspeção via DBeaver etc.)
DATABASE_PUBLIC_URL=postgresql://postgres:***@centerbeam.proxy.rlwy.net:27985/railway
```

---

### 4.3 Serviço `Redis`

| Campo               | Valor                                                |
|---------------------|------------------------------------------------------|
| **Service ID**      | `b38d0080-8a39-414c-b440-fbb9d6ef23da`               |
| **Host interno**    | `redis.railway.internal:6379`                        |
| **Host público**    | `centerbeam.proxy.rlwy.net:11837`                    |
| **User**            | `default`                                            |
| **Volume**          | `redis-volume`                                       |

#### Conexão

```
# Interna (dentro do Railway)
REDIS_URL=redis://default:***@redis.railway.internal:6379

# Pública (uso externo)
REDIS_PUBLIC_URL=redis://default:***@centerbeam.proxy.rlwy.net:11837
```

---

### 4.4 Serviço `Bucket` (MinIO — Object Storage)

| Campo                    | Valor                                                     |
|--------------------------|-----------------------------------------------------------|
| **Service ID**           | `6983d407-cdda-41e6-bf33-38e8a779eb27`                    |
| **API pública**          | `https://bucket-production-d8d3.up.railway.app`           |
| **Host interno**         | `bucket.railway.internal:9000`                            |
| **User (root)**          | `PMPX0XRhoquNp9whylRTBiVaSbhuvlVY`                        |
| **Bucket**               | `telumi-media`                                            |
| **Volume**               | `bucket-volume`                                           |
| **CORS**                 | Configurado via `PutBucketCorsCommand` no startup da API  |

#### Variáveis configuradas na API (`@telumi/api`)

| Variável                  | Valor                                                      |
|---------------------------|------------------------------------------------------------|
| `STORAGE_ENDPOINT`        | `http://bucket.railway.internal:9000` (rede interna)       |
| `STORAGE_PUBLIC_ENDPOINT` | `https://bucket-production-d8d3.up.railway.app` (browser) |
| `STORAGE_ACCESS_KEY`      | credencial do MinIO (Railway secret)                       |
| `STORAGE_SECRET_KEY`      | credencial do MinIO (Railway secret)                       |
| `STORAGE_BUCKET`          | `telumi-media`                                             |
| `STORAGE_REGION`          | `us-east-1`                                                |

> **Arquitetura de dois endpoints:** A API usa o endpoint interno (`bucket.railway.internal`) para operações diretas (criar bucket, verificar existência, deletar). As **URLs presignadas** usam o endpoint público para que o browser do usuário consiga fazer PUT direto ao MinIO sem passar pela API.

### 4.5 Serviço `Console` (MinIO Web UI)

| Campo           | Valor                                             |
|-----------------|---------------------------------------------------|
| **URL**         | `https://console-production-81b1.up.railway.app`  |
| **Login**       | Mesmo `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`   |
| **Uso**         | Inspeção visual de buckets e objetos              |

---

## 5. Mapeamento de Domínios

| Domínio                                        | Serviço              | Plataforma |
|------------------------------------------------|----------------------|------------|
| `telumi.com.br`                                | `telumi-admin-web`   | Vercel     |
| `www.telumi.com.br`                            | `telumi-admin-web`   | Vercel     |
| `player.telumi.com.br`                         | `telumi-player`      | Vercel     |
| `telumiapi-production.up.railway.app`          | `@telumi/api`        | Railway    |
| `telumiplayer-production.up.railway.app`       | `@telumi/player`     | Railway    |
| `bucket-production-d8d3.up.railway.app`        | `Bucket` (MinIO S3)  | Railway    |
| `console-production-81b1.up.railway.app`       | `Console` (MinIO UI) | Railway    |
| `postgres.railway.internal`                    | `Postgres`           | Railway    |
| `redis.railway.internal`                       | `Redis`              | Railway    |
| `bucket.railway.internal`                      | `Bucket` (MinIO S3)  | Railway    |

> ℹ️ O `@telumi/player` no Railway existe como serviço, mas o frontend do player está no Vercel (`player.telumi.com.br`). O domínio `telumiplayer-production.up.railway.app` não deve ser usado — o correto é `player.telumi.com.br`.

---

## 6. Fluxo de Deploy

### 6.1 Deploy normal (recomendado)

```bash
# 1. Fazer alterações no código
git add .
git commit -m "feat(admin-web): nova funcionalidade"
git push origin main
# → Vercel detecta o push e faz build automático de ambos os apps
# → Railway detecta o push e faz build automático da API
```

### 6.2 Redeploy manual (sem novas alterações de código)

```bash
# Vercel — se mudar variáveis de ambiente
export PATH="$PATH:/opt/homebrew/bin"

# Obter URL do último deploy
vercel ls telumi-admin-web --scope telumi

# Redeploy
vercel redeploy <URL_DO_DEPLOY> --target production --scope telumi
```

### 6.3 Migrations do banco de dados

```bash
# Sempre usar a DATABASE_PUBLIC_URL para rodar migrations externamente
cd apps/api
DATABASE_URL="postgresql://postgres:***@centerbeam.proxy.rlwy.net:27985/railway" \
  npx prisma migrate deploy
```

---

## 7. Boas Práticas e Regras de Operação

### 7.1 Variáveis de ambiente

- **Nunca commitar** valores de variáveis sensíveis em arquivos `.env` para o repositório.
- Arquivos `.env` e `.env.local` estão no `.gitignore` — confirme sempre com `git status` antes de commitar.
- Variáveis `NEXT_PUBLIC_*` são **embarcadas no bundle** durante o build. Alterar no Vercel/Railway sem refazer o deploy não tem efeito.
- Usar a conexão **interna** do Railway (`*.railway.internal`) para comunicação entre serviços (zero latência, sem custo de egress).
- Usar a conexão **pública** (`centerbeam.proxy.rlwy.net`) apenas para acesso externo (migrations locais, ferramentas de inspeção).

### 7.2 URL da API

A URL correta da API é:

```
https://telumiapi-production.up.railway.app
```

> ⚠️ Existe uma URL incorreta com hífen extra: `https://telumi-api-production.up.railway.app`. Essa URL retorna 404 sem headers CORS. **Nunca usar.**

Ambos `apps/admin-web/src/lib/api/devices.ts` e `apps/player/src/lib/api.ts` possuem a função `normalizeApiBaseUrl()` como proteção de fallback contra esse bug.

### 7.3 JWT Secret

O valor atual de `JWT_SECRET` no Railway é `sua-chave-secreta-longa-e-aleatoria-aqui` — um placeholder inseguro. Execute:

```bash
openssl rand -hex 64
```

E atualize via Railway Dashboard → `@telumi/api` → Variables → `JWT_SECRET`.

**Após atualizar**, todos os tokens existentes serão invalidados (usuários precisarão fazer login novamente). Agende para horário de baixo uso.

### 7.4 Google Maps API Key

A chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` está exposta publicamente no bundle do Next.js (por design do prefixo `NEXT_PUBLIC_`). Recomendações:

- Restringir a chave no [Google Cloud Console](https://console.cloud.google.com) aos domínios `telumi.com.br` e `www.telumi.com.br`.
- Ativar apenas as APIs necessárias (Maps JavaScript API, Places API).

### 7.5 Banco de dados

- **Não rodar `prisma migrate reset`** em produção — apaga todos os dados.
- Sempre usar `prisma migrate deploy` para aplicar migrações em produção.
- Antes de uma migração destrutiva, fazer backup via `pg_dump` com a `DATABASE_PUBLIC_URL`.
- O volume `postgres-volume` garante persistência dos dados mesmo com reinicios do serviço.

### 7.6 Branch e código

- Toda alteração deve passar pela branch `main` — não existem branches de staging configuradas.
- Executar `pnpm typecheck` localmente antes de fazer push (evita builds quebrados no Vercel).
- O Vercel builda as apps com Turborepo — alterações em `packages/` também trigam rebuild dos apps que dependem deles.

---

## 8. Acesso às Ferramentas

### Railway CLI

```bash
# Instalar (se necessário)
brew install railway

# Autenticar
railway login

# Linkar ao projeto
cd /Users/blendstudio/Projects/telumi
railway link --project cc4fcbec-2750-47b9-8f01-d1d34fa53a5f --environment production

# Ver variáveis de um serviço
railway variables --service "@telumi/api"

# Ver logs de um serviço
railway logs --service "@telumi/api"
```

### Vercel CLI

```bash
# Instalar (se necessário)
brew install vercel-cli

# Autenticar (abrirá o navegador)
vercel login
vercel teams switch telumi

# Listar variáveis de ambiente
cd apps/admin-web && vercel env ls

# Adicionar variável
printf "valor" | vercel env add NOME_VAR production

# Remover e recriar variável
vercel env rm NOME_VAR production --yes
printf "novo_valor" | vercel env add NOME_VAR production

# Forçar redeploy
vercel redeploy <URL_DO_DEPLOY_ATUAL> --target production
```

### Prisma Studio (inspeção visual do banco)

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:***@centerbeam.proxy.rlwy.net:27985/railway" \
  npx prisma studio
```

---

## 9. Checklist de Verificação Pós-Deploy

Após qualquer deploy significativo, verificar:

- [ ] `https://telumi.com.br` carrega sem erros no console do navegador
- [ ] Login/registro funcionando (`https://telumi.com.br/login`)
- [ ] `https://player.telumi.com.br` exibe tela de pareamento
- [ ] Gerar código em `/telas` → inserir no player → pareamento concluído com sucesso
- [ ] Network tab do navegador: chamadas para `telumiapi-production.up.railway.app` retornando 2xx
- [ ] Railway Dashboard: todos os 5 serviços com status `Online`

---

## 10. Histórico de Incidentes e Bugs Corrigidos

| Data       | Bug                                                        | Causa                                                           | Correção                                                             |
|------------|------------------------------------------------------------|-----------------------------------------------------------------|----------------------------------------------------------------------|
| 03/03/2026 | Pareamento 404 "code not found"                           | Vercel sem `NEXT_PUBLIC_API_URL` → bundle com `localhost:3001`  | Adicionada variável no Vercel + redeploy                             |
| 03/03/2026 | Player com URL errada da API (hífen extra + `\n`)         | `NEXT_PUBLIC_API_URL=https://telumi-api-production...` (incorreto) | Corrigido para `telumiapi-production.up.railway.app`              |
| 03/03/2026 | Pareamento 500 (Prisma)                                   | Tabela `devices` não existia no banco de produção               | `prisma migrate deploy` via `DATABASE_PUBLIC_URL`                    |
| 03/03/2026 | CORS bloqueado no player                                  | Player chamava `telumi-api-*` (404, sem headers CORS)           | `normalizeApiBaseUrl()` em `apps/player/src/lib/api.ts`             |
| 03/03/2026 | Build TypeScript falhando no Vercel                       | `login-form.tsx` e `register-form.tsx` com tipos opcionais      | Payload explicitamente tipado com `!` operator                       |
| 03/03/2026 | QR code com URL `localhost:3002`                         | Variável de build-time com `localhost` hardcoded                | `NEXT_PUBLIC_ADMIN_URL` com fallback para `https://telumi.com.br/telas` |
| 03/03/2026 | Redis BROKEN no Railway                                   | `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT` vazios na API           | Adicionadas variáveis corretas manualmente no Railway                |
