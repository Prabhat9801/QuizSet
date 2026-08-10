/**
 * Thin HTTP layer for the real API client.
 *
 * Built on top of `@workspace/api-client-react`'s hand-written `customFetch`
 * (base-URL prefixing via `setBaseUrl`, bearer-token injection via
 * `setAuthTokenGetter`, typed `ApiError`/`ResponseParseError`, content-type
 * sniffing) instead of a new fetch wrapper — see
 * `lib/api-client-react/src/custom-fetch.ts` for the implementation this
 * reuses.
 *
 * Note: `customFetch`/`ApiError`/`ResponseParseError` were NOT previously
 * re-exported from that package's public entry point
 * (`lib/api-client-react/src/index.ts` only exported `setBaseUrl` /
 * `setAuthTokenGetter`, which would have been dead weight here without the
 * fetch function that actually reads their module-level state). A one-line
 * additive re-export was added there — see the two `export` lines in that
 * file — so this module can genuinely reuse the real implementation instead
 * of duplicating ~250 lines of hand-written fetch/error-parsing logic.
 */
import {
  customFetch,
  openStream,
  ApiError,
  setBaseUrl,
  setAuthTokenGetter,
  type AuthTokenGetter,
} from '@workspace/api-client-react';

export { ApiError };
export type { AuthTokenGetter };

/**
 * The auth seam this module exists for: real session-based login (a real
 * Supabase JWT) is NOT wired into this frontend yet — see the top comment in
 * `services/api.ts` for the full scope note. Whoever wires it later calls
 * this once with a getter that returns the current session's access token
 * (or `null` when signed out); every request made through this file will
 * then carry `Authorization: Bearer <token>` automatically.
 */
export function setApiAuthTokenGetter(getter: AuthTokenGetter | null): void {
  setAuthTokenGetter(getter);
}

/**
 * Base URL for the real API server (e.g. an `import.meta.env.VITE_API_URL`
 * value once one exists). Nothing calls this by default — the app keeps
 * using `services/mock.ts` until something explicitly flips that switch,
 * which is a deliberate later step, not part of this change.
 */
export function setApiBaseUrl(url: string | null): void {
  setBaseUrl(url);
}

type QueryValue = string | number | boolean | undefined;

function toQueryString(params?: Record<string, QueryValue>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number | boolean][];
  if (entries.length === 0) return '';
  const search = new URLSearchParams();
  for (const [key, value] of entries) search.set(key, String(value));
  return `?${search.toString()}`;
}

/** GET with query-string params. `path` must be an absolute path (starting
 * with `/`) so `setApiBaseUrl`'s prefix actually applies — see
 * `applyBaseUrl` in custom-fetch.ts. */
export function apiGet<T>(path: string, params?: Record<string, QueryValue>): Promise<T> {
  return customFetch<T>(`${path}${toQueryString(params)}`, { method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return customFetch<T>(path, { method: 'DELETE' });
}

/** POST that returns the raw streaming Response (server-sent events), for
 * endpoints like /api/chatbot/chat that stream a reply token-by-token
 * instead of returning one JSON body. */
export function apiPostStream(path: string, body?: unknown): Promise<Response> {
  return openStream(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
