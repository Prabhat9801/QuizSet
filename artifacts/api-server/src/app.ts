import path from "path";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { HttpError } from "./lib/http-error";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Optional single-service deploy mode: when STATIC_DIR points at a built SPA
// (the quizset frontend's `dist/public`), this same process also serves it —
// one Render Web Service instead of a separate frontend + backend. Mounted
// AFTER `/api` so a request to a real API route is never shadowed by the SPA
// fallback. Unset in local dev (frontend runs via its own Vite dev server),
// so this middleware is simply absent then rather than serving a stale/empty
// directory.
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  const publicDir = path.resolve(staticDir);
  app.use(express.static(publicDir));
  // SPA fallback: any non-API, non-file GET resolves to index.html so
  // client-side routing (react-router) owns the path instead of a 404.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// Central error handler. Route handlers throw `HttpError` (or let Express 5
// auto-forward a rejected async handler's error here) instead of each
// individually try/catching and formatting a response. Anything that is NOT
// an `HttpError` is logged and reported as a generic 500 so internal details
// (SQL errors, stack traces) never leak to the client.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
