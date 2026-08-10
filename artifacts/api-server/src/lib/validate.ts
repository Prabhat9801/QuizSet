import { badRequest } from "./http-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Throws a clean 400 instead of letting an invalid uuid hit Postgres and
 * surface as an opaque 500 (`invalid input syntax for type uuid`). */
export function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) throw badRequest(`${label} must be a valid uuid.`);
  return value;
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`${label} is required and must be a non-empty string.`);
  }
  return value;
}

export function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw badRequest(`${label} must be a string.`);
  return value;
}

export function requireInt(value: unknown, label: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n)) {
    throw badRequest(`${label} must be an integer.`);
  }
  return n;
}

export function optionalInt(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requireInt(value, label);
}

export function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function optionalOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined || value === null) return undefined;
  return requireOneOf(value, allowed, label);
}

export function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw badRequest(`${label} must be an array of strings.`);
  }
  return value;
}
