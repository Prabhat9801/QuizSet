import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profiles } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";

const router: IRouter = Router();

// POST /api/auth/claim-session — called by the frontend right after every
// successful Supabase login (see AuthContext's claimSession()). Overwrites
// whatever active_session_token the account previously had, which is what
// actually invalidates any OTHER device currently logged in as this account
// — see the long comment on SESSION_TOKEN_HEADER in middlewares/auth.ts for
// why this exists. Uses `authenticate` itself (rather than skipping it like
// POST /api/profiles/me does) since claiming a session only makes sense for
// an account that already has a profile row.
router.post("/auth/claim-session", authenticate, async (req, res) => {
  const token = randomUUID();
  await db.update(profiles).set({ activeSessionToken: token }).where(eq(profiles.id, req.auth!.userId));
  res.json({ sessionToken: token });
});

export default router;
