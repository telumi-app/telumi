import { expect, test, type APIRequestContext } from '@playwright/test';

const API_URL = 'http://localhost:3001/v1';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l8x8AAAAASUVORK5CYII=',
  'base64',
);

const createUniqueEmail = () =>
  `e2e-campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

const createUniqueSlug = () =>
  `e2e-cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

async function registerAndGetToken(request: APIRequestContext) {
  const email = createUniqueEmail();
  const password = '12345678';

  const registerRes = await request.post(`${API_URL}/auth/register`, {
    data: {
      name: 'Usuário E2E Campaign',
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
  expect(registerBody.data?.accessToken).toBeTruthy();

  return registerBody.data!.accessToken;
}

async function bootstrapWorkspace(request: APIRequestContext, token: string) {
  const slug = createUniqueSlug();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const workspaceRes = await request.patch(`${API_URL}/onboarding/workspace`, {
    headers: authHeaders,
    data: {
      name: `Workspace ${slug}`,
      slug,
    },
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
      companyName: `Empresa ${slug}`,
      city: 'São Paulo',
      state: 'SP',
      screenCount: 'ONE_TO_TWO',
      goalProfile: 'INTERNAL',
    },
  });
  expect(setupRes.ok()).toBeTruthy();
}

async function createLocation(request: APIRequestContext, token: string, name: string) {
  const res = await request.post(`${API_URL}/locations`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      city: 'São Paulo',
      state: 'SP',
      address: 'Rua E2E, 100',
    },
  });

  expect(res.ok()).toBeTruthy();

  const body = (await res.json()) as {
    success: boolean;
    data?: { id: string };
  };

  expect(body.success).toBeTruthy();
  expect(body.data?.id).toBeTruthy();

  return body.data!.id;
}

async function createAndPairDevice(
  request: APIRequestContext,
  token: string,
  locationId: string,
  name: string,
) {
  const createRes = await request.post(`${API_URL}/devices`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      locationId,
      orientation: 'HORIZONTAL',
      operationalStatus: 'ACTIVE',
      resolution: 'AUTO',
    },
  });

  expect(createRes.ok()).toBeTruthy();

  const createBody = (await createRes.json()) as {
    success: boolean;
    data?: { id: string; pairingCode: string };
  };

  expect(createBody.success).toBeTruthy();
  expect(createBody.data?.id).toBeTruthy();
  expect(createBody.data?.pairingCode).toBeTruthy();

  const pairRes = await request.post(`${API_URL}/devices/public/pair`, {
    data: { code: createBody.data!.pairingCode },
  });

  expect(pairRes.ok()).toBeTruthy();

  const pairBody = (await pairRes.json()) as {
    success: boolean;
    data?: { deviceToken: string; device: { id: string } };
  };

  expect(pairBody.success).toBeTruthy();
  expect(pairBody.data?.deviceToken).toBeTruthy();

  return {
    id: createBody.data!.id,
    token: pairBody.data!.deviceToken,
  };
}

async function createReadyMedia(request: APIRequestContext, token: string, suffix: string) {
  const reqRes = await request.post(`${API_URL}/media/upload-url`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: `Mídia ${suffix}`,
      originalName: `banner-${suffix}.png`,
      mimeType: 'image/png',
      fileSize: TINY_PNG.length,
      width: 1,
      height: 1,
    },
  });

  expect(reqRes.ok()).toBeTruthy();

  const reqBody = (await reqRes.json()) as {
    success: boolean;
    data?: { mediaId: string; uploadUrl: string };
  };

  expect(reqBody.success).toBeTruthy();
  expect(reqBody.data?.mediaId).toBeTruthy();
  expect(reqBody.data?.uploadUrl).toBeTruthy();

  const uploadRes = await fetch(reqBody.data!.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: TINY_PNG,
  });

  expect(uploadRes.ok).toBeTruthy();

  const confirmRes = await request.post(`${API_URL}/media/${reqBody.data!.mediaId}/confirm`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  expect(confirmRes.ok()).toBeTruthy();

  return reqBody.data!.mediaId;
}

async function createCampaignWithAsset(
  request: APIRequestContext,
  token: string,
  name: string,
  mediaId: string,
) {
  const createRes = await request.post(`${API_URL}/campaigns`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      objective: 'Teste E2E',
      description: 'Campanha criada em teste Playwright',
      assets: [{ mediaId, position: 0, durationMs: 15000 }],
    },
  });

  expect(createRes.ok()).toBeTruthy();

  const body = (await createRes.json()) as {
    success: boolean;
    data?: { id: string };
  };

  expect(body.success).toBeTruthy();
  expect(body.data?.id).toBeTruthy();

  return body.data!.id;
}

async function createAndPublishSchedule(
  request: APIRequestContext,
  token: string,
  campaignId: string,
  deviceIds: string[],
  frequencyPerHour: number,
) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const day = today.getDay();

  const createRes = await request.post(`${API_URL}/schedules`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: `Prog ${campaignId.slice(0, 6)}`,
      sourceType: 'CAMPAIGN',
      campaignId,
      startDate: todayIso,
      endDate: todayIso,
      startTime: '00:00',
      endTime: '23:59',
      frequencyPerHour,
      daysOfWeek: [day],
      priority: 0,
      deviceIds,
    },
  });

  expect(createRes.ok()).toBeTruthy();
  const createBody = (await createRes.json()) as { success: boolean; data?: { id: string } };
  expect(createBody.success).toBeTruthy();

  const pubRes = await request.post(`${API_URL}/schedules/${createBody.data!.id}/publish`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(pubRes.ok()).toBeTruthy();

  const activateRes = await request.patch(`${API_URL}/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { status: 'ACTIVE' },
  });
  expect(activateRes.ok()).toBeTruthy();
}

async function getManifestCampaignIds(request: APIRequestContext, deviceToken: string) {
  const manifestRes = await request.post(`${API_URL}/devices/public/manifest`, {
    data: { deviceToken },
  });
  expect(manifestRes.ok()).toBeTruthy();

  const body = (await manifestRes.json()) as {
    success: boolean;
    data?: {
      items?: Array<{ campaignId?: string }>;
    };
  };

  expect(body.success).toBeTruthy();
  const ids = new Set((body.data?.items ?? []).map((i) => i.campaignId).filter(Boolean) as string[]);
  return [...ids];
}

test.describe.configure({ mode: 'serial' });

test('manifesta múltiplas campanhas na mesma tela e em telas diferentes', async ({ request }) => {
  test.setTimeout(8 * 60 * 1000);

  const token = await registerAndGetToken(request);
  await bootstrapWorkspace(request, token);

  const locationId = await createLocation(request, token, `Loc ${Date.now()}`);
  const deviceA = await createAndPairDevice(request, token, locationId, `TV A ${Date.now()}`);
  const deviceB = await createAndPairDevice(request, token, locationId, `TV B ${Date.now()}`);

  const media1 = await createReadyMedia(request, token, 'm1');
  const media2 = await createReadyMedia(request, token, 'm2');
  const media3 = await createReadyMedia(request, token, 'm3');

  const campaignA1 = await createCampaignWithAsset(request, token, `Camp A1 ${Date.now()}`, media1);
  const campaignA2 = await createCampaignWithAsset(request, token, `Camp A2 ${Date.now()}`, media2);
  const campaignB1 = await createCampaignWithAsset(request, token, `Camp B1 ${Date.now()}`, media3);

  await createAndPublishSchedule(request, token, campaignA1, [deviceA.id], 6);
  await createAndPublishSchedule(request, token, campaignA2, [deviceA.id], 4);
  await createAndPublishSchedule(request, token, campaignB1, [deviceB.id], 5);

  await expect
    .poll(async () => getManifestCampaignIds(request, deviceA.token), {
      timeout: 120_000,
      intervals: [1000, 2000, 3000],
    })
    .toEqual(expect.arrayContaining([campaignA1, campaignA2]));

  await expect
    .poll(async () => getManifestCampaignIds(request, deviceB.token), {
      timeout: 120_000,
      intervals: [1000, 2000, 3000],
    })
    .toEqual(expect.arrayContaining([campaignB1]));
});

test('edita, pausa, reativa e exclui campanha corretamente', async ({ request }) => {
  test.setTimeout(6 * 60 * 1000);

  const token = await registerAndGetToken(request);
  await bootstrapWorkspace(request, token);

  const locationId = await createLocation(request, token, `Loc Edit ${Date.now()}`);
  const device = await createAndPairDevice(request, token, locationId, `TV Edit ${Date.now()}`);
  const media = await createReadyMedia(request, token, 'edit-1');

  const campaignId = await createCampaignWithAsset(request, token, `Camp Edit ${Date.now()}`, media);
  await createAndPublishSchedule(request, token, campaignId, [device.id], 4);

  const updateRes = await request.patch(`${API_URL}/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      name: 'Campanha Editada E2E',
      objective: 'Objetivo atualizado',
      description: 'Descrição atualizada',
    },
  });
  expect(updateRes.ok()).toBeTruthy();

  const pauseRes = await request.patch(`${API_URL}/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { status: 'PAUSED' },
  });
  expect(pauseRes.ok()).toBeTruthy();

  await expect
    .poll(async () => getManifestCampaignIds(request, device.token), {
      timeout: 120_000,
      intervals: [1000, 2000, 3000],
    })
    .not.toContain(campaignId);

  const reactivateRes = await request.patch(`${API_URL}/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { status: 'ACTIVE' },
  });
  expect(reactivateRes.ok()).toBeTruthy();

  await expect
    .poll(async () => getManifestCampaignIds(request, device.token), {
      timeout: 120_000,
      intervals: [1000, 2000, 3000],
    })
    .toContain(campaignId);

  const deleteRes = await request.delete(`${API_URL}/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(deleteRes.ok()).toBeTruthy();

  const getDeleted = await request.get(`${API_URL}/campaigns/${campaignId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(getDeleted.status()).toBe(404);
});
