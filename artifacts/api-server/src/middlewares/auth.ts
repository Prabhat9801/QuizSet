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
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    req.auth = { userId: profile.id, role: profile.role, tenantId: profile.tenantId };
    next();
  } catch (err) {
    next(err);
  }
}
