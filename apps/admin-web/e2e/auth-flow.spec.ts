import { expect, test } from '@playwright/test';

const createUniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test('cria conta e redireciona para onboarding', async ({ page }) => {
  const email = createUniqueEmail();

  await page.goto('/register');

  await page.getByLabel('Nome completo').fill('Usuário E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[name="password"]').fill('12345678');
  await page.locator('input[name="confirmPassword"]').fill('12345678');

  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/onboarding\/workspace/);
});

test('faz login com conta existente e entra no onboarding', async ({ page, request }) => {
  const email = createUniqueEmail();
  const password = '12345678';

  const registerResponse = await request.post('http://localhost:3001/v1/auth/register', {
    data: {
      name: 'Usuário Login E2E',
      email,
      password,
      confirmPassword: password,
    },
  });

  expect(registerResponse.ok()).toBeTruthy();

  await page.goto('/login');

  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page).toHaveURL(/\/onboarding\/workspace/);
});
