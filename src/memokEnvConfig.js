/**
 * 将进程环境变量与请求体中的局部覆盖合并为 {@link MemokPipelineConfig}。
 * 与 memok-ai README / `MemokPipelineConfig` 字段对齐。
 *
 * @param {import('memok-ai/bridge').MemokPipelineConfig | undefined} overrides
 * @returns {import('memok-ai/bridge').MemokPipelineConfig}
 */
export function buildMemokPipelineConfig(overrides = {}) {
  const openaiApiKey =
    overrides.openaiApiKey ?? process.env.OPENAI_API_KEY ?? "";
  const dbPath =
    overrides.dbPath ?? process.env.MEMOK_DB_PATH ?? "./memok.sqlite";
  const llmModel =
    overrides.llmModel ?? process.env.MEMOK_LLM_MODEL ?? "gpt-4o-mini";
  const llmMaxWorkers = pickInt(
    overrides.llmMaxWorkers,
    process.env.MEMOK_LLM_MAX_WORKERS,
    4,
    { min: 1, max: 64 },
  );
  const articleSentencesMaxOutputTokens = pickInt(
    overrides.articleSentencesMaxOutputTokens,
    process.env.MEMOK_V2_ARTICLE_SENTENCES_MAX_OUTPUT_TOKENS,
    8192,
    { min: 1, max: 2_000_000 },
  );
  const coreWordsNormalizeMaxOutputTokens = pickInt(
    overrides.coreWordsNormalizeMaxOutputTokens,
    process.env.MEMOK_CORE_WORDS_NORMALIZE_MAX_OUTPUT_TOKENS,
    32768,
    { min: 1, max: 2_000_000 },
  );
  const sentenceMergeMaxCompletionTokens = pickInt(
    overrides.sentenceMergeMaxCompletionTokens,
    process.env.MEMOK_SENTENCE_MERGE_MAX_COMPLETION_TOKENS,
    2048,
    { min: 1, max: 2_000_000 },
  );
  const openaiBaseUrl =
    overrides.openaiBaseUrl !== undefined
      ? overrides.openaiBaseUrl
      : emptyToUndefined(process.env.OPENAI_BASE_URL);
  const skipLlmStructuredParse =
    overrides.skipLlmStructuredParse !== undefined
      ? overrides.skipLlmStructuredParse
      : envTruthy(process.env.MEMOK_SKIP_LLM_STRUCTURED_PARSE);

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
  };
}

/**
 * @param {string | undefined} pathOverride
 */
export function resolveDbPath(pathOverride) {
  return pathOverride ?? process.env.MEMOK_DB_PATH ?? "./memok.sqlite";
}

function emptyToUndefined(s) {
  const t = s?.trim();
  return t ? t : undefined;
}

function envTruthy(v) {
  if (!v) return undefined;
  const x = String(v).toLowerCase();
  if (x === "1" || x === "true" || x === "yes" || x === "on") return true;
  if (x === "0" || x === "false" || x === "no" || x === "off") return false;
  return undefined;
}

/**
 * @param {number | undefined} override
 * @param {string | undefined} envVal
 * @param {number} fallback
 * @param {{ min: number; max: number }} bounds
 */
function pickInt(override, envVal, fallback, bounds) {
  if (typeof override === "number" && Number.isFinite(override)) {
    return clampInt(override, bounds);
  }
  const fromEnv = envVal !== undefined ? Number(envVal) : NaN;
  if (Number.isFinite(fromEnv)) {
    return clampInt(fromEnv, bounds);
  }
  return clampInt(fallback, bounds);
}

function clampInt(n, { min, max }) {
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
