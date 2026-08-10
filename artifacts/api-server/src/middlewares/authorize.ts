import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/http-error";
import type { AuthContext, Role } from "./auth";

/** 403s unless `req.auth.role` is one of `roles`. Must run after `authenticate`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(forbidden(`This action requires one of these roles: ${roles.join(", ")}.`));
    }
    next();
  };
}

/** True if `auth` may act on tenant `tenantId` — platform spans every
 * tenant; coaching/student are confined to their own. There is no Postgres
 * RLS in this pass (documented decision, see CLAUDE.md / PROJECT_HISTORY.md
 * on the sibling repo's pattern this one follows) — this is the actual
 * tenant-isolation boundary, so every route that reads/writes tenant-scoped
 * rows must call this (directly or via `requireOwnTenant`). */
export function canAccessTenant(auth: AuthContext, tenantId: string | null | undefined): boolean {
  if (auth.role === "platform") return true;
  return !!tenantId && auth.tenantId === tenantId;
}

/** Middleware form of `canAccessTenant` for routes where the target tenant
 * id is known up front (a query/body/param value) rather than only knowable
 * after a DB lookup. For by-:id routes where the row must be fetched first
 * to learn its tenantId, call `canAccessTenant` inline in the handler
 * instead. */
export function requireOwnTenant(getTenantId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(unauthorized());
    const tenantId = getTenantId(req);
    if (!canAccessTenant(req.auth, tenantId)) {
      return next(forbidden("You do not have access to this tenant's data."));
    }
    next();
  };
}

/** Throws (via caller's try/async-forwarding) if `auth` can't act on `tenantId`. */
export function assertTenantAccess(auth: AuthContext, tenantId: string | null | undefined) {
  if (!canAccessTenant(auth, tenantId)) {
    throw forbidden("You do not have access to this tenant's data.");
  }
}
