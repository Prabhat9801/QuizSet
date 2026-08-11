/**
 * Real Supabase Auth wiring, kept alongside (not instead of) `services/mock.ts`.
 *
 * This module is the ONLY place that talks to `@supabase/supabase-js` directly.
 * It intentionally degrades to a harmless no-op client when the required env
 * vars are missing — mirroring `vite.config.ts`'s validation style for
 * `PORT`/`BASE_PATH`, except here a missing value must NOT crash the app
 * (auth just won't work until it's configured), because the mock demo flow
 * has to keep working for anyone who hasn't set these up yet.
 *
 * Required Vite env vars (read at runtime via `import.meta.env`, inlined at
 * build time like every other `VITE_*` var — see the "Build-time env var
 * trap" note in this repo's CLAUDE.md-equivalent docs):
 *
 *   VITE_SUPABASE_URL       — e.g. https://zfzzutnskxjxkcdznblk.supabase.co
 *   VITE_SUPABASE_ANON_KEY  — the project's public anon key (never the service-role key)
 *
 * Neither var is set anywhere in this repo yet. That's expected: define them
 * in a `.env`/`.env.local` file under `artifacts/quizset/` (gitignored) or in
 * the hosting platform's build-time env panel — see the Vite docs on
 * `.env` files. There is no existing `.env.example` file in this repo to
 * extend, so rather than inventing a new file convention, the two required
 * names are documented here instead.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True only when both env vars are present — gates every helper below. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — ' +
      'real Supabase Auth is disabled and the app falls back to the mock demo login. ' +
      'This is expected in local/dev environments that have not configured them yet.',
  );
}

/**
 * The configured client, or `null` when the env vars are missing. Every
 * exported helper below already checks this and degrades to a safe no-op
 * (never throws), so callers don't need to re-check `isSupabaseConfigured`
 * themselves before calling them.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

/** The current session, or `null` if signed out or Supabase isn't configured. */
export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Subscribes to Supabase auth state changes (sign-in, sign-out, token
 * refresh — including from another tab). Returns an unsubscribe function;
 * a no-op unsubscribe when Supabase isn't configured, so callers can always
 * call the returned function unconditionally on cleanup.
 */
export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Real Supabase sign-up. `name` is passed as `user_metadata.name` so it's
 * available immediately (e.g. for a welcome toast) even before any
 * server-side profile row exists.
 *
 * NOTE — known gap: this does NOT create a matching `profiles` row server-side.
 * `artifacts/api-server/src/routes/profiles.ts` only exposes `GET /profiles/me`
 * (read own row) and `PATCH /profiles/:id` (name/email/status on an existing
 * row) — there is no "create my own profile after signup" endpoint, and
 * `profiles` has no client-facing insert path by design (role/tenantId are
 * security-sensitive — see that file's comments). Until a real endpoint for
 * this exists, a freshly-signed-up real Supabase user has no `profiles` row,
 * so `GET /profiles/me` will 404 for them. This module deliberately does NOT
 * work around that with a client-side direct table insert.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  name: string,
): Promise<{ session: Session | null }> {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return { session: data.session ?? null };
}

/** Real Supabase sign-in with email + password. */
export async function signInWithPassword(email: string, password: string): Promise<{ session: Session | null }> {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { session: data.session ?? null };
}

/** Sends a real password-reset email via Supabase Auth — a genuine 6-digit
 * OTP code (Supabase's default email template for this flow), not a
 * simulated toast. `verifyPasswordResetOtp`/`updatePasswordWithSession`
 * below complete the flow once the student has that code. */
export async function sendPasswordResetOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/** Verifies the 6-digit code from the reset email and returns a real,
 * signed-in session for that account — the standard Supabase "recovery" OTP
 * flow. The caller then immediately calls `updatePassword` while this
 * session is active to actually set the new password. */
export async function verifyPasswordResetOtp(email: string, code: string): Promise<{ session: Session | null }> {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
  if (error) throw error;
  return { session: data.session ?? null };
}

/** Sets a new password for the currently-active (just-verified) session. */
export async function updatePassword(newPassword: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Signs out of the real Supabase session. No-op when Supabase isn't configured. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
