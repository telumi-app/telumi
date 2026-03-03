# Deploy em Produção — Vercel (Monorepo Telumi)

Este guia deixa o projeto pronto para deploy contínuo por commit na branch `main`.

## 1) Estratégia recomendada (escalável)

Use **1 projeto Vercel por app web**:

- `@telumi/admin-web` (painel)
- `@telumi/player` (player web)

> A API NestJS (`apps/api`) não é o alvo ideal no Vercel. Hospede API em serviço de backend (Railway/Render/Fly/EC2) e aponte `NEXT_PUBLIC_API_URL` dos apps web para ela.

---

## 2) Importar repositório

1. Acesse Vercel → **Add New... → Project**
2. Selecione `telumi-app/telumi`
3. Crie o projeto do Admin Web com:
   - **Root Directory:** `apps/admin-web`
   - **Framework:** Next.js
4. Repita para o Player com:
   - **Root Directory:** `apps/player`
   - **Framework:** Next.js

---

## 3) Variáveis de ambiente

Configure em cada projeto Vercel:

### Admin Web (`apps/admin-web`)

- `NEXT_PUBLIC_API_URL` = URL pública da API de produção (ex.: `https://api.seudominio.com`)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = chave browser do Google Maps

### Player (`apps/player`)

- `NEXT_PUBLIC_API_URL` = URL pública da API de produção

### API (fora do Vercel)

Use no host da API:

- `API_PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

---

## 4) Build e deploy automático

- Defina `main` como **Production Branch**.
- Cada push em `main` gera deploy automático.
- Pull Requests geram preview deploys (quando habilitado no projeto).

---

## 5) Boas práticas de produção

- Ative **Branch Protection** em `main` (PR obrigatório + checks obrigatórios).
- Exija o workflow de CI (`.github/workflows/ci.yml`) antes de merge.
- Nunca commitar `.env` real (somente `.env.example`).
- Rotacione segredos periodicamente (`JWT_SECRET`, chaves de provider).

---

## 6) Checklist final

- [ ] API de produção online e acessível via HTTPS
- [ ] `NEXT_PUBLIC_API_URL` configurada nos dois projetos
- [ ] `Production Branch = main`
- [ ] CI verde em `main`
- [ ] Primeiro deploy validado (login, listagem de telas, campanhas, player)
