// Cognito authorization-code + PKCE for a public browser client.
// Session storage deliberately avoids persistent tokens across browser restarts.
// Backend decisions ALWAYS rely on API Gateway verified JWT claims, never this UI.
const PREFIX = "thesis-auth-";
const domain = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
const encoder = new TextEncoder();

function callbackUrl() { return window.location.origin + "/auth/callback"; }
function config() {
  if (!domain || !/^https:\/\/[a-z0-9.-]+$/.test(domain) || !clientId) {
    throw new Error("Cognito configuration missing. Set VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.");
  }
  return { domain, clientId };
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function randomString() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
function safeNext(path: string | null): string {
  return path?.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/order";
}
export async function login(next?: string) {
  const c = config();
  const verifier = randomString();
  const state = randomString();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier)));
  sessionStorage.setItem(PREFIX + "verifier", verifier);
  sessionStorage.setItem(PREFIX + "state", state);
  sessionStorage.setItem(PREFIX + "next", safeNext(next ?? "/order"));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: callbackUrl(),
    scope: "openid email profile",
    state,
    code_challenge_method: "S256",
    code_challenge: base64url(digest),
  });
  window.location.assign(c.domain + "/oauth2/authorize?" + params);
}
export async function finishLogin(): Promise<string> {
  const c = config();
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const state = query.get("state");
  const expected = sessionStorage.getItem(PREFIX + "state");
  const verifier = sessionStorage.getItem(PREFIX + "verifier");
  if (!code || !state || !expected || state !== expected || !verifier) {
    throw new Error("Invalid OAuth callback state. Start login again.");
  }
  sessionStorage.removeItem(PREFIX + "state");
  sessionStorage.removeItem(PREFIX + "verifier");
  const response = await fetch(c.domain + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: c.clientId,
      code, code_verifier: verifier, redirect_uri: callbackUrl(),
    }),
  });
  if (!response.ok) throw new Error("Cognito code exchange failed; sign in again.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("access_token" in data) || typeof data.access_token !== "string") {
    throw new Error("Cognito did not return an access token.");
  }
  sessionStorage.setItem(PREFIX + "access-token", data.access_token);
  const next = safeNext(sessionStorage.getItem(PREFIX + "next"));
  sessionStorage.removeItem(PREFIX + "next");
  return next;
}
type Claims = { sub?: string; exp?: number; token_use?: string; client_id?: string; "cognito:groups"?: string[] | string };
function claims(): Claims | null {
  const token = sessionStorage.getItem(PREFIX + "access-token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const parsed = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Claims;
    if (parsed.token_use !== "access" || parsed.client_id !== clientId || !parsed.exp || Date.now() / 1000 >= parsed.exp - 30) return null;
    return parsed;
  } catch { return null; }
}
export function accessToken(): string | null {
  return claims() ? sessionStorage.getItem(PREFIX + "access-token") : null;
}
export type UiRole = "CUSTOMER" | "KITCHEN" | "CASHIER" | "MANAGER";
export function roles(): UiRole[] {
  const raw = claims()?.["cognito:groups"];
  const groups = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const staff = (["KITCHEN", "CASHIER", "MANAGER"] as UiRole[]).filter(r => groups.includes(r));
  return staff.length ? staff : ["CUSTOMER"];
}
export function hasRole(allowed: UiRole[]) {
  return !!accessToken() && roles().some(r => allowed.includes(r));
}
export function logout() {
  sessionStorage.removeItem(PREFIX + "access-token");
  const c = config();
  const query = new URLSearchParams({ client_id: c.clientId, logout_uri: window.location.origin });
  window.location.assign(c.domain + "/logout?" + query);
}
