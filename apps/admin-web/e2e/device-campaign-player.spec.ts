import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/v1';

const createUniqueEmail = () =>
  `e2e-player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

const createUniqueSlug = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function bootstrapWorkspace(
  request: APIRequestContext,
  token: string,
  workspaceName: string,
  slug: string,
) {
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const workspaceRes = await request.patch(`${API_URL}/onboarding/workspace`, {
    headers: authHeaders,
    data: { name: workspaceName, slug },
  });
  expect(workspaceRes.ok()).toBeTruthy();

  const modeRes = await request.patch(`${API_URL}/onboarding/mode`, {
    headers: authHeaders,
    data: { goalProfile: 'INTERNAL' },
  });
  expect(modeRes.ok()).toBeTruthy();

  const setupRes = await request.patch(`${API_URL}/onboarding/setup`, {
    headers: authHeaders,
    data: {
      companyName: 'Empresa E2E',
      city: 'São Paulo',
      state: 'SP',
      screenCount: 'ONE_TO_TWO',
      goalProfile: 'INTERNAL',
    },
  });
  expect(setupRes.ok()).toBeTruthy();
}

async function createLocation(
  request: APIRequestContext,
  token: string,
  locationName: string,
) {
  const locationRes = await request.post(`${API_URL}/locations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: locationName,
      city: 'São Paulo',
      state: 'SP',
      address: 'Rua E2E, 100',
    },
  });

  expect(locationRes.ok()).toBeTruthy();
}

async function setAuthenticatedSession(page: Page, token: string) {
  await page.context().addCookies([
    {
      name: 'telumi_access_token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.addInitScript((authToken: string) => {
    window.localStorage.setItem('telumi_access_token', authToken);
  }, token);
}

async function waitDeviceOnline(request: APIRequestContext, token: string, deviceName: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await request.get(`${API_URL}/devices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();

    const body = (await res.json()) as {
      success: boolean;
      data?: Array<{ name: string; status: 'PENDING' | 'ONLINE' | 'UNSTABLE' | 'OFFLINE' }>;
    };

    const device = body.data?.find((item) => item.name === deviceName);
    if (device && (device.status === 'ONLINE' || device.status === 'UNSTABLE')) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('A tela não entrou em ONLINE/UNSTABLE no tempo esperado.');
}

test.describe.configure({ mode: 'serial' });

test('fluxo completo: cadastrar tela, parear player, criar campanha e reproduzir', async ({ page, browser, request }) => {
  test.setTimeout(8 * 60 * 1000);

  const email = createUniqueEmail();
  const password = '12345678';
  const workspaceName = `Workspace E2E ${Date.now()}`;
  const workspaceSlug = createUniqueSlug();
  const locationName = `Unidade E2E ${Date.now()}`;
  const deviceName = `TV E2E ${Date.now()}`;
  const campaignName = `Campanha E2E ${Date.now()}`;

  const registerRes = await request.post(`${API_URL}/auth/register`, {
    data: {
      name: 'Usuário E2E Player',
      email,
      password,
      confirmPassword: password,
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  const registerBody = (await registerRes.json()) as {
    success: boolean;
    data?: { accessToken: string };
  };
  expect(registerBody.success).toBeTruthy();

  const token = registerBody.data?.accessToken;
  expect(token).toBeTruthy();

  await bootstrapWorkspace(request, token!, workspaceName, workspaceSlug);
  await createLocation(request, token!, locationName);

  await setAuthenticatedSession(page, token!);

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();

  await playerPage.goto('http://localhost:3002');
  await expect(playerPage.getByText('Aguardando pareamento.')).toBeVisible();

  await playerPage.getByPlaceholder('XXXXXX').fill('ZZZZZZ');
  await playerPage.getByRole('button', { name: 'Parear Tela' }).click();
  await expect(playerPage.getByText(/código informado é inválido|Nenhuma tela encontrada/i)).toBeVisible();

  await page.goto('/telas');
  await page.getByRole('button', { name: 'Adicionar tela' }).click();

  await page.getByLabel('Nome da tela').fill(deviceName);
  await page.getByRole('button', { name: 'Criar tela' }).click();

  await expect(page.locator('p', { hasText: 'Código de conexão' }).last()).toBeVisible();

  const codeRaw = await page.locator('p.font-mono.text-3xl').first().innerText();
  const pairingCode = codeRaw.replace(/\s/g, '');
  expect(pairingCode.length).toBe(6);

  await playerPage.goto('http://localhost:3002');
  await playerPage.getByPlaceholder('XXXXXX').fill(pairingCode);
  await playerPage.getByRole('button', { name: 'Parear Tela' }).click();
  await expect(playerPage.getByText('Pareado com sucesso!')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Finalizar' }).click();
  await waitDeviceOnline(request, token!, deviceName);

  await page.goto('/campanhas/criar');

  await page.getByLabel('Nome da campanha').fill(campaignName);
  await page.getByLabel('Objetivo').fill('Validar reprodução automática no player');
  await page.getByLabel('Descrição (opcional)').fill('Campanha criada pelo teste E2E Playwright headed.');
  await page.getByRole('button', { name: 'Avançar' }).click();

  await page.getByRole('button', { name: 'Adicionar conteúdos' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: 'Enviar novo' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'banner-e2e.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l8x8AAAAASUVORK5CYII=',
      'base64',
    ),
  });

  await expect(page.getByRole('button', { name: /Confirmar \(1\)/ })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('button', { name: /Confirmar \(1\)/ }).click();

  await expect(page.getByText('1 clipes')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar playlist' }).click();
  await expect(page.getByText(/Playlist salva com sucesso/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Avançar' }).click();

  await page.locator('label', { hasText: deviceName }).click();
  await page.getByRole('button', { name: 'Avançar' }).click();

  const now = new Date();
  await page.getByLabel('Data de início').fill(now.toISOString().slice(0, 10));
  await page.getByLabel('Horário de início').fill('00:00');
  await page.getByLabel('Horário de fim').fill('23:59');

  const todayLabel = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][now.getDay()]!;
  const todayDayLabel = page.locator('label', { hasText: new RegExp(`^${todayLabel}$`) }).first();
  const todayCheckbox = todayDayLabel.locator('[data-slot="checkbox"]');
  const state = await todayCheckbox.getAttribute('data-state');
  if (state !== 'checked') {
    await todayDayLabel.click();
  }

  await page.getByRole('button', { name: 'Avançar' }).click();
  await page.getByRole('button', { name: 'Publicar agora' }).click();

  await expect(page).toHaveURL(/\/campanhas/, { timeout: 60_000 });

  const deviceToken = await playerPage.evaluate(() => localStorage.getItem('deviceToken'));
  expect(deviceToken).toBeTruthy();

  await expect.poll(async () => {
    const manifestRes = await request.post(`${API_URL}/devices/public/manifest`, {
      data: { deviceToken },
    });
    if (!manifestRes.ok()) {
      return 0;
    }
    const body = (await manifestRes.json()) as { data?: { items?: unknown[] } };
    return body.data?.items?.length ?? 0;
  }, { timeout: 120_000, intervals: [1000, 2000, 3000] }).toBeGreaterThan(0);

  await expect(playerPage.locator('img[alt="Mídia da campanha"], video').first()).toBeVisible({ timeout: 120_000 });

  await playerPage.evaluate(() => {
    localStorage.removeItem('deviceToken');
    localStorage.removeItem('deviceSecret');
  });

  await playerPage.goto(`http://localhost:3002/?pairToken=${encodeURIComponent(deviceToken!)}`);
  await expect.poll(
    () => playerPage.evaluate(() => Boolean(localStorage.getItem('deviceToken'))),
    { timeout: 30_000, intervals: [500, 1000, 2000] },
  ).toBeTruthy();

  await playerContext.close();
});
