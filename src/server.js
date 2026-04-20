import express from "express";
import {
  applySentenceUsageFeedback,
  dreamingPipeline,
  extractMemorySentencesByWordSample,
} from "memok-ai/bridge";
import { buildMemokPipelineConfig } from "./memokEnvConfig.js";
import { runArticleWordPipelineWithResult } from "./runArticleWordPipelineWithResult.js";

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.MEMOK_API_KEY?.trim();

const app = express();
app.use(express.json({ limit: "32mb" }));

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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * POST /v1/article-word-pipeline
 * body: { text, today?, persist?, config? }
 * 返回 bridge 同语义之 v2 结果：`sentenceCore`、`normalized`；默认 `persist: true` 写库。
 */
app.post("/v1/article-word-pipeline", async (req, res, next) => {
  try {
    const { text, today, persist, config: bodyCfg } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text (non-empty string) is required" });
      return;
    }
    const base = buildMemokPipelineConfig(bodyCfg);
    if (!base.openaiApiKey) {
      res.status(400).json({
        error:
          "openaiApiKey missing: set OPENAI_API_KEY or pass config.openaiApiKey",
      });
      return;
    }
    const persistDb = persist === false ? false : true;
    const out = await runArticleWordPipelineWithResult(
      text,
      { ...base, ...(today ? { today } : {}) },
      { persist: persistDb },
    );
    res.json(out);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /v1/dreaming-pipeline
 * body: { config?: Partial<DreamingPipelineConfig> }（不含 dreamLogWarn，由服务端记录）
 */
app.post("/v1/dreaming-pipeline", async (req, res, next) => {
  try {
    const bodyCfg = req.body?.config ?? req.body ?? {};
    const base = buildMemokPipelineConfig(bodyCfg);
    if (!base.openaiApiKey) {
      res.status(400).json({
        error:
          "openaiApiKey missing: set OPENAI_API_KEY or pass config.openaiApiKey",
      });
      return;
    }
    const dreamLogWarn = (msg) => {
      console.warn(`[memok dream_log] ${msg}`);
    };
    const { maxWords, fraction, minRuns, maxRuns } = bodyCfg;
    /** @type {import('memok-ai/bridge').DreamingPipelineConfig} */
    const input = {
      ...base,
      dreamLogWarn,
      ...(typeof maxWords === "number" ? { maxWords } : {}),
      ...(typeof fraction === "number" ? { fraction } : {}),
      ...(typeof minRuns === "number" ? { minRuns } : {}),
      ...(typeof maxRuns === "number" ? { maxRuns } : {}),
    };
    const result = await dreamingPipeline(input);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /v1/extract-memory
 * body: { fraction?, longTermFraction?, config?: Partial<MemokPipelineConfig> }
 */
app.post("/v1/extract-memory", (req, res, next) => {
  try {
    const { fraction, longTermFraction, config: bodyCfg } = req.body ?? {};
    const base = buildMemokPipelineConfig(bodyCfg);
    const result = extractMemorySentencesByWordSample({
      ...base,
      ...(typeof fraction === "number" ? { fraction } : {}),
      ...(typeof longTermFraction === "number" ? { longTermFraction } : {}),
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /v1/sentence-usage-feedback
 * body: { sentenceIds: number[], lastEditDate?: string, config?: Partial<MemokPipelineConfig> }
 */
app.post("/v1/sentence-usage-feedback", (req, res, next) => {
  try {
    const { sentenceIds, lastEditDate, config: bodyCfg } = req.body ?? {};
    if (!Array.isArray(sentenceIds)) {
      res.status(400).json({ error: "sentenceIds (number[]) is required" });
      return;
    }
    const base = buildMemokPipelineConfig(bodyCfg);
    const result = applySentenceUsageFeedback({
      ...base,
      sentenceIds,
      ...(typeof lastEditDate === "string" ? { lastEditDate } : {}),
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  const msg = err instanceof Error ? err.message : String(err);
  const status = err instanceof Error && err.status ? err.status : 500;
  console.error(err);
  res.status(status).json({ error: msg });
});

app.listen(PORT, () => {
  console.log(`memok-ai-api listening on http://127.0.0.1:${PORT}`);
});
