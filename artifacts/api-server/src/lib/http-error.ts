/** A deliberate, client-facing error with an HTTP status code attached.
 * Route handlers can `throw new HttpError(404, "...")` directly — Express 5
 * forwards rejected promises/thrown errors from async handlers to `next()`
 * automatically, so no try/catch wrapper is needed at each call site. The
 * error-handling middleware mounted at the end of `app.ts` turns this into
 * a JSON `{ error: message }` response with the right status; anything that
 * ISN'T an HttpError is logged and reported as a generic 500 so internal
 * details (SQL, stack traces) never leak to the client. */
export class HttpError extends Error {
  readonly status: number;
  /** Optional machine-readable discriminator for a client that needs to
   * react differently to specific error causes (not just the status code)
   * — e.g. SESSION_SUPERSEDED, which should force a real sign-out rather
   * than being treated as a generic 401. Absent for ordinary errors. */
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = "Authentication required.") => new HttpError(401, message);
export const forbidden = (message = "You do not have access to this resource.") => new HttpError(403, message);
export const notFound = (message = "Not found.") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
