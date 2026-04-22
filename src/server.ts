import express, { type Response, type NextFunction } from "express";
import session from "express-session";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync } from "node:fs";
import sessionFileStore from "session-file-store";
import swaggerUi from "swagger-ui-express";
import {
  extractMemorySentencesByWordSample,
} from "memok-ai";
import { applySentenceUsageFeedback } from "memok-ai/bridge";
import { pinoHttp } from "pino-http";
import { buildMemokPipelineConfig } from "./memokEnvConfig.js";
import { runArticleWordPipelineWithResult } from "./runArticleWordPipelineWithResult.js";
import { logger } from "./logger.js";
import { metricsMiddleware, getMetricsHandler } from "./metrics.js";
import { generateOpenAPIDocument } from "./openapi.js";
import { validateBody, validateQuery } from "./validate.js";
import { openDb, getDbStats, getDreamLogs, getDbWordStats, getDbSentenceStats, getDbDreamingTrend } from "./db.js";
import {
  isPasswordSet,
  setupPassword,
  verifyPassword,
  getPasswordHash,
  changePassword,
  closeAuthDb,
} from "./auth.js";
import {
  requireAuth,
  redirectIfAuthenticated,
  redirectIfSetupComplete,
} from "./authMiddleware.js";
import {
  ArticleWordPipelineRequestSchema,
  ArticleWordPipelineBatchRequestSchema,
  ExtractMemoryRequestSchema,
  SentenceUsageFeedbackRequestSchema,
  DreamLogsQuerySchema,
} from "./schemas.js";
import {
  pipelineRunsTotal,
  pipelineDuration,
} from "./metrics.js";
import {
  getEffectiveConfig,
  getConfigMetadata,
  updateConfig,
  resetConfig,
} from "./config.js";
import { startDreamScheduler, restartDreamScheduler } from "./scheduler.js";
import type {
  ArticleWordPipelineRequest,
  ArticleWordPipelineBatchRequest,
  ExtractMemoryRequest,
  SentenceUsageFeedbackRequest,
  DreamLogsQuery,
} from "./schemas.js";
import type { ValidatedRequest } from "./types.js";

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.MEMOK_API_KEY?.trim();
const SESSION_SECRET = process.env.SESSION_SECRET || "memok-dev-secret-change-in-production";
const __dirname = dirname(fileURLToPath(import.meta.url));

const SESSIONS_DIR = join(__dirname, "../data/sessions");
mkdirSync(SESSIONS_DIR, { recursive: true });

const FileStore = sessionFileStore(session);

const app = express();
app.use(express.json({ limit: "32mb" }));
app.use(pinoHttp({ logger }));
app.use(metricsMiddleware);

app.use(
  session({
    name: "memok.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new FileStore({
      path: SESSIONS_DIR,
      ttl: 60 * 60 * 24 * 7,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  }),
);

app.use(requireAuth);

// Auth API routes
app.get("/api/setup-status", (_req, res) => {
  res.json({ initialized: isPasswordSet() });
});

app.post("/api/setup", async (req, res, next) => {
  try {
    if (isPasswordSet()) {
      res.status(403).json({ error: "Password already initialized" });
      return;
    }
    const { password, confirmPassword } = req.body;
    if (!password || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }
    await setupPassword(password);
    (req as any).session.authenticated = true;
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    if (!isPasswordSet()) {
      res.status(403).json({ error: "Password not initialized" });
      return;
    }
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: "Password is required" });
      return;
    }
    const hash = getPasswordHash();
    if (!hash) {
      res.status(500).json({ error: "Server error" });
      return;
    }
    const valid = await verifyPassword(password, hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    (req as any).session.authenticated = true;
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.post("/api/logout", (req, res, next) => {
  try {
    (req as any).session.destroy((err: any) => {
      if (err) {
        res.status(500).json({ error: "Failed to logout" });
        return;
      }
      res.clearCookie("memok.sid");
      res.json({ success: true });
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/change-password", async (req, res, next) => {
  try {
    if (!(req as any).session.authenticated) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      res.status(400).json({ error: "New passwords do not match" });
      return;
    }
    const result = await changePassword(oldPassword, newPassword);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// Service config API
app.get("/api/config", (req, res, next) => {
  try {
    if (!(req as any).session.authenticated) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({
      config: getEffectiveConfig(),
      meta: getConfigMetadata(),
    });
  } catch (e) {
    next(e);
  }
});

app.post("/api/config", (req, res, next) => {
  try {
    if (!(req as any).session.authenticated) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const ok = updateConfig(req.body ?? {});
    if (!ok) {
      res.status(500).json({ error: "failed_to_save_config" });
      return;
    }
    restartDreamScheduler();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/config", (req, res, next) => {
  try {
    if (!(req as any).session.authenticated) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const ok = resetConfig();
    if (!ok) {
      res.status(500).json({ error: "failed_to_reset_config" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

function sendHtml(res: Response, fileName: string): void {
  const filePath = join(__dirname, "../public", fileName);
  try {
    const content = readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(content);
  } catch (err) {
    logger.error({ err, filePath }, "Failed to send HTML file");
    res.status(500).send("Internal Server Error");
  }
}

app.use(express.static(join(__dirname, "../public"), { index: false }));

app.get("/setup", redirectIfSetupComplete, (_req, res) => {
  sendHtml(res, "setup.html");
});

app.get("/login", redirectIfAuthenticated, (_req, res) => {
  sendHtml(res, "login.html");
});

app.get("/settings", (_req, res) => {
  sendHtml(res, "settings.html");
});

app.get("/", (_req, res) => {
  if (!isPasswordSet()) {
    sendHtml(res, "setup.html");
    return;
  }
  sendHtml(res, "index.html");
});

// API key auth
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const h = req.headers.authorization;
  const token =
    typeof h === "string" && h.startsWith("Bearer ")
      ? h.slice(7)
      : req.headers["x-api-key"];
  if (token !== API_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
});

// OpenAPI docs
const openApiDoc = generateOpenAPIDocument();
app.get("/openapi.json", (req, res) => {
  const download = req.query.download === "1" || req.query.download === "true";
  if (download) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="openapi.json"',
    );
    res.send(JSON.stringify(openApiDoc, null, 2));
    return;
  }
  res.json(openApiDoc);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "memok-ai-api", version: "0.2.0" });
});

// Metrics
app.get("/metrics", getMetricsHandler);

function observePipeline(name: string, startTime: number, status: string): void {
  const duration = (Date.now() - startTime) / 1000;
  pipelineDuration.observe({ pipeline: name }, duration);
  pipelineRunsTotal.inc({ pipeline: name, status });
}

/**
 * POST /v1/article-word-pipeline
 */
app.post(
  "/v1/article-word-pipeline",
  validateBody(ArticleWordPipelineRequestSchema),
  async (
    req: ValidatedRequest<ArticleWordPipelineRequest, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { text, today, persist } = req.validatedBody!;
      const base = buildMemokPipelineConfig();
      if (!base.openaiApiKey) {
        res.status(400).json({
          error:
            "openaiApiKey missing: set OPENAI_API_KEY or pass config.openaiApiKey",
        });
        return;
      }
      const persistDb = persist === false ? false : true;
      const start = Date.now();
      const out = await runArticleWordPipelineWithResult(
        text,
        { ...base, ...(today ? { today } : {}) },
        { persist: persistDb },
      );
      observePipeline("article-word-pipeline", start, "success");
      res.json(out);
    } catch (e) {
      observePipeline("article-word-pipeline", Date.now(), "error");
      next(e);
    }
  },
);

/**
 * POST /v1/article-word-pipeline/batch
 */
app.post(
  "/v1/article-word-pipeline/batch",
  validateBody(ArticleWordPipelineBatchRequestSchema),
  async (
    req: ValidatedRequest<ArticleWordPipelineBatchRequest, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { items } = req.validatedBody!;
      const start = Date.now();
      const results = await Promise.all(
        items.map(async (item, index) => {
          try {
            const base = buildMemokPipelineConfig();
            if (!base.openaiApiKey) {
              return {
                index,
                status: "error" as const,
                error:
                  "openaiApiKey missing: set OPENAI_API_KEY or pass config.openaiApiKey",
              };
            }
            const persistDb = item.persist === false ? false : true;
            const out = await runArticleWordPipelineWithResult(
              item.text,
              { ...base, ...(item.today ? { today: item.today } : {}) },
              { persist: persistDb },
            );
            return { index, status: "success" as const, data: out };
          } catch (e) {
            return {
              index,
              status: "error" as const,
              error: e instanceof Error ? e.message : String(e),
            };
          }
        }),
      );
      observePipeline("article-word-pipeline-batch", start, "success");
      res.json({ count: items.length, results });
    } catch (e) {
      observePipeline("article-word-pipeline-batch", Date.now(), "error");
      next(e);
    }
  },
);

/**
 * POST /v1/extract-memory
 */
app.post(
  "/v1/extract-memory",
  validateBody(ExtractMemoryRequestSchema),
  (
    req: ValidatedRequest<ExtractMemoryRequest, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { fraction, longTermFraction } = req.validatedBody!;
      const base = buildMemokPipelineConfig();
      const start = Date.now();
      const result = extractMemorySentencesByWordSample({
        ...base,
        ...(typeof fraction === "number" ? { fraction } : {}),
        ...(typeof longTermFraction === "number" ? { longTermFraction } : {}),
      });
      observePipeline("extract-memory", start, "success");
      res.json(result);
    } catch (e) {
      observePipeline("extract-memory", Date.now(), "error");
      next(e);
    }
  },
);

/**
 * POST /v1/sentence-usage-feedback
 */
app.post(
  "/v1/sentence-usage-feedback",
  validateBody(SentenceUsageFeedbackRequestSchema),
  (
    req: ValidatedRequest<SentenceUsageFeedbackRequest, unknown>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { sentenceIds, lastEditDate } = req.validatedBody!;
      const base = buildMemokPipelineConfig();
      const start = Date.now();
      const result = applySentenceUsageFeedback({
        ...base,
        sentenceIds,
        ...(typeof lastEditDate === "string" ? { lastEditDate } : {}),
      });
      observePipeline("sentence-usage-feedback", start, "success");
      res.json(result);
    } catch (e) {
      observePipeline("sentence-usage-feedback", Date.now(), "error");
      next(e);
    }
  },
);

/**
 * GET /v1/db/stats
 */
app.get("/v1/db/stats", (req, res, next) => {
  try {
    const db = openDb(buildMemokPipelineConfig());
    try {
      const stats = getDbStats(db);
      res.json(stats);
    } finally {
      db.close();
    }
  } catch (e) {
    next(e);
  }
});

/**
 * GET /v1/db/dream-logs
 */
app.get(
  "/v1/db/dream-logs",
  validateQuery(DreamLogsQuerySchema),
  (
    req: ValidatedRequest<unknown, DreamLogsQuery>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const db = openDb(buildMemokPipelineConfig());
      try {
        const logs = getDreamLogs(db, req.validatedQuery!);
        res.json(logs);
      } finally {
        db.close();
      }
    } catch (e) {
      next(e);
    }
  },
);

/**
 * GET /v1/db/words-stats
 */
app.get("/v1/db/words-stats", (req, res, next) => {
  try {
    const db = openDb(buildMemokPipelineConfig());
    try {
      const stats = getDbWordStats(db, 20);
      res.json(stats);
    } finally {
      db.close();
    }
  } catch (e) {
    next(e);
  }
});

/**
 * GET /v1/db/sentences-stats
 */
app.get("/v1/db/sentences-stats", (req, res, next) => {
  try {
    const db = openDb(buildMemokPipelineConfig());
    try {
      const stats = getDbSentenceStats(db);
      res.json(stats);
    } finally {
      db.close();
    }
  } catch (e) {
    next(e);
  }
});

/**
 * GET /v1/db/dreaming-trend
 */
app.get("/v1/db/dreaming-trend", (req, res, next) => {
  try {
    const db = openDb(buildMemokPipelineConfig());
    try {
      const trend = getDbDreamingTrend(db, 30);
      res.json(trend);
    } finally {
      db.close();
    }
  } catch (e) {
    next(e);
  }
});

// Fallback 404 handler
app.use((req: express.Request, res: express.Response) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.accepts("html")) {
    res.redirect("/");
    return;
  }
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  const status = err instanceof Error && "status" in err && typeof err.status === "number" ? err.status : 500;
  logger.error(err, "Unhandled error");
  res.status(status).json({ error: msg });
});

const server = app.listen(PORT, () => {
  logger.info(`memok-ai-api listening on http://127.0.0.1:${PORT}`);
  startDreamScheduler();
});

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  logger.info({ signal }, "Shutting down gracefully...");
  server.close(() => {
    logger.info("HTTP server closed");
    try {
      closeAuthDb();
      logger.info("Auth DB closed");
    } catch {
      // ignore
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
