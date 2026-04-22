import type { MemokPipelineConfig } from "memok-ai/bridge";
import { getConfig } from "./config.js";

export function buildMemokPipelineConfig(
  overrides: Partial<MemokPipelineConfig> = {},
): MemokPipelineConfig {
  const cfg = getConfig();
  const openaiApiKey =
    overrides.openaiApiKey ?? process.env.OPENAI_API_KEY ?? cfg.openaiApiKey ?? "";
  const dbPath =
    overrides.dbPath ?? process.env.MEMOK_DB_PATH ?? cfg.dbPath ?? "./data/memok.sqlite";
  const llmModel =
    overrides.llmModel ?? process.env.MEMOK_LLM_MODEL ?? cfg.llmModel ?? "gpt-4o-mini";
  const llmMaxWorkers = pickInt(
    overrides.llmMaxWorkers,
    process.env.MEMOK_LLM_MAX_WORKERS,
    cfg.llmMaxWorkers,
    4,
    { min: 1, max: 64 },
  );
  const articleSentencesMaxOutputTokens = pickInt(
    overrides.articleSentencesMaxOutputTokens,
    process.env.MEMOK_V2_ARTICLE_SENTENCES_MAX_OUTPUT_TOKENS,
    cfg.articleSentencesMaxOutputTokens,
    8192,
    { min: 1, max: 2_000_000 },
  );
  const coreWordsNormalizeMaxOutputTokens = pickInt(
    overrides.coreWordsNormalizeMaxOutputTokens,
    process.env.MEMOK_CORE_WORDS_NORMALIZE_MAX_OUTPUT_TOKENS,
    cfg.coreWordsNormalizeMaxOutputTokens,
    32768,
    { min: 1, max: 2_000_000 },
  );
  const sentenceMergeMaxCompletionTokens = pickInt(
    overrides.sentenceMergeMaxCompletionTokens,
    process.env.MEMOK_SENTENCE_MERGE_MAX_COMPLETION_TOKENS,
    cfg.sentenceMergeMaxCompletionTokens,
    2048,
    { min: 1, max: 2_000_000 },
  );
  const openaiBaseUrl =
    overrides.openaiBaseUrl !== undefined
      ? overrides.openaiBaseUrl
      : emptyToUndefined(process.env.OPENAI_BASE_URL) ??
        emptyToUndefined(cfg.openaiBaseUrl) ??
        "https://api.deepseek.com/v1";
  const skipLlmStructuredParse =
    overrides.skipLlmStructuredParse !== undefined
      ? overrides.skipLlmStructuredParse
      : envTruthy(process.env.MEMOK_SKIP_LLM_STRUCTURED_PARSE) ??
        cfg.skipLlmStructuredParse;
  const articleWordImportInitialWeight = pickInt(
    overrides.articleWordImportInitialWeight,
    process.env.MEMOK_ARTICLE_WORD_IMPORT_INITIAL_WEIGHT,
    cfg.articleWordImportInitialWeight,
    1,
    { min: 0, max: 2_000_000 },
  );
  const articleWordImportInitialDuration = pickInt(
    overrides.articleWordImportInitialDuration,
    process.env.MEMOK_ARTICLE_WORD_IMPORT_INITIAL_DURATION,
    cfg.articleWordImportInitialDuration,
    7,
    { min: 1, max: 2_000_000 },
  );
  const dreamShortTermToLongTermWeightThreshold = pickInt(
    overrides.dreamShortTermToLongTermWeightThreshold,
    process.env.MEMOK_DREAM_SHORT_TERM_TO_LONG_TERM_WEIGHT_THRESHOLD,
    cfg.dreamShortTermToLongTermWeightThreshold,
    7,
    { min: 1, max: 2_000_000 },
  );
  const relevanceScoreMaxLlmAttempts = pickInt(
    overrides.relevanceScoreMaxLlmAttempts,
    process.env.MEMOK_RELEVANCE_SCORE_MAX_LLM_ATTEMPTS,
    cfg.relevanceScoreMaxLlmAttempts,
    5,
    { min: 1, max: 32 },
  );

  return {
    dbPath,
    openaiApiKey,
    ...(openaiBaseUrl !== undefined ? { openaiBaseUrl } : {}),
    llmModel,
    llmMaxWorkers,
    articleSentencesMaxOutputTokens,
    coreWordsNormalizeMaxOutputTokens,
    sentenceMergeMaxCompletionTokens,
    ...(skipLlmStructuredParse !== undefined
      ? { skipLlmStructuredParse }
      : {}),
    articleWordImportInitialWeight,
    articleWordImportInitialDuration,
    dreamShortTermToLongTermWeightThreshold,
    relevanceScoreMaxLlmAttempts,
  };
}

export function resolveDbPath(pathOverride?: string): string {
  const cfg = getConfig();
  return pathOverride ?? process.env.MEMOK_DB_PATH ?? cfg.dbPath ?? "./data/memok.sqlite";
}

function emptyToUndefined(s?: string): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

function envTruthy(v?: string): boolean | undefined {
  if (!v) return undefined;
  const x = String(v).toLowerCase();
  if (x === "1" || x === "true" || x === "yes" || x === "on") return true;
  if (x === "0" || x === "false" || x === "no" || x === "off") return false;
  return undefined;
}

function pickInt(
  override: number | undefined,
  envVal: string | undefined,
  configVal: number | undefined,
  fallback: number,
  bounds: { min: number; max: number },
): number {
  if (typeof override === "number" && Number.isFinite(override)) {
    return clampInt(override, bounds);
  }
  const fromEnv = envVal !== undefined ? Number(envVal) : NaN;
  if (Number.isFinite(fromEnv)) {
    return clampInt(fromEnv, bounds);
  }
  const fromConfig = configVal !== undefined ? Number(configVal) : NaN;
  if (Number.isFinite(fromConfig)) {
    return clampInt(fromConfig, bounds);
  }
  return clampInt(fallback, bounds);
}

function clampInt(n: number, { min, max }: { min: number; max: number }): number {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
