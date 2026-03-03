const TOKEN_KEY = 'telumi_access_token';
const TOKEN_COOKIE = 'telumi_access_token';

export function setSessionToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax`;
}

export function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSessionToken() {
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
