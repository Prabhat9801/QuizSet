import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profiles, roleEnum } from "@workspace/db/schema";
import { HttpError, unauthorized } from "../lib/http-error";

export type Role = (typeof roleEnum.enumValues)[number];

export interface AuthContext {
  userId: string;
  role: Role;
  tenantId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// ---------------------------------------------------------------------------
// Auth approach
// ---------------------------------------------------------------------------
// Real end-user auth is handled by Supabase Auth; this API never issues or
// signs its own tokens, it only *verifies* the Supabase-issued JWT a client
// sends in `Authorization: Bearer <token>`.
//
// Two ways to verify a Supabase JWT exist:
//   1. Verify the HS256 signature locally against the project's JWT secret.
//   2. Call Supabase's own `GET /auth/v1/user` with the token and let
//      Supabase Auth verify it server-side.
//
// This module deliberately uses (2). Reasons:
//   - No JWT secret was provided/available in this environment (only
//     DATABASE_URL was) — hardcoding or guessing one would be worse than not
//     verifying at all.
//   - (2) also transparently handles token *revocation* (a signed-out or
//     deleted user's token stops working immediately) and any future secret
//     rotation on Supabase's side, neither of which a local HS256 check gets
//     for free.
//   - The extra network round-trip per request is a real cost, but this API
//     is a low-traffic B2B2C admin/study surface, not a hot path — verifying
//     correctness beats shaving latency here. If this ever needs to scale,
//     swap in local `jose`-based HS256 verification using
//     `SUPABASE_JWT_SECRET` and cache verified tokens for their remaining TTL.
// Falls back to the VITE_-prefixed vars so a single-service deploy (this
// api-server also serving the built frontend, see STATIC_DIR in app.ts) only
// needs ONE Supabase URL/anon-key pair set in Render, not two copies of the
// same value under different names — VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// are already required for the frontend build, so reuse them here too.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

/** Exported so `POST /api/profiles/me` (self-service profile creation, which
 * by definition runs before any `profiles` row exists) can verify identity
 * without going through `authenticate` below, which requires one. */
export async function verifySupabaseJwt(
  token: string,
): Promise<{ id: string; email: string; name: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new HttpError(
      500,
      "Server auth is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY.",
    );
  }
  let res: globalThis.Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
  } catch {
    throw new HttpError(502, "Could not reach Supabase Auth to verify the token.");
  }
  if (!res.ok) {
    throw unauthorized("Invalid or expired token.");
  }
  const data = (await res.json()) as {
    id?: string;
    email?: string;
    user_metadata?: { name?: string };
  };
  if (!data.id) throw unauthorized("Token did not resolve to a user.");
  return {
    id: data.id,
    email: data.email ?? "",
    name: data.user_metadata?.name || data.email?.split("@")[0] || "New student",
  };
}

/** Bearer-token extraction shared by `authenticate` and the self-service
 * profile-creation route, which can't use `authenticate` itself (it 404s
 * when no profile exists yet — exactly the state this route exists to fix). */
export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized("Missing bearer token.");
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw unauthorized("Missing bearer token.");
  return token;
}

// ---------------------------------------------------------------------------
// Single-active-session enforcement
// ---------------------------------------------------------------------------
// Closes a real business risk: a student can hand their join code + login to
// friends/family, letting many real people share one paid "seat" while the
// coaching owner's per-student counts silently undercount actual usage. At
// most one device may hold the current `active_session_token` at a time.
//
// `POST /api/auth/claim-session` (see routes/auth.ts) overwrites the token
// right after every login, invalidating whatever device held the previous
// one. The client is expected to send its token back as `X-Session-Token`
// on every request; `authenticate` below rejects a stale one with 401
// SESSION_SUPERSEDED so the frontend can force a real sign-out rather than
// silently keep working as a "logged in but actually kicked" zombie session.
//
// Deliberately NOT enforced when the client sends no `X-Session-Token`
// header at all (as opposed to sending a wrong one) — this keeps the check
// additive for any caller that hasn't been updated to send it yet (e.g. a
// mid-rollout frontend build, or a future service-to-service caller that has
// no concept of "device"), rather than a de-facto forced-logout for
// everyone the moment this ships. A wrong/stale token, in contrast, always
// means a genuinely different device has since logged in and must be
// rejected — there is no safe "maybe" for that case.
export const SESSION_TOKEN_HEADER = "x-session-token";

/** Verifies the bearer token, loads the matching `profiles` row, and attaches
 * `{ userId, role, tenantId }` to `req.auth`. A valid token with no profile
 * row yet is a real "not onboarded" state, not a crash — reported as 404. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    const { id } = await verifySupabaseJwt(token);

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (!profile) {
      throw new HttpError(404, "No profile exists yet for this account.");
    }

    const sentToken = req.headers[SESSION_TOKEN_HEADER];
    if (
      typeof sentToken === "string" &&
      sentToken.length > 0 &&
      profile.activeSessionToken !== null &&
      sentToken !== profile.activeSessionToken
    ) {
      throw new HttpError(401, "This session has been superseded by a login on another device.", "SESSION_SUPERSEDED");
    }

    req.auth = { userId: profile.id, role: profile.role, tenantId: profile.tenantId };
    next();
  } catch (err) {
    next(err);
  }
}
