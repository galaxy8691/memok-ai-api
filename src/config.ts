import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import TOML from "@iarna/toml";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "../config.toml");

interface MemokConfig {
  dbPath?: string;
  llmModel?: string;
  llmMaxWorkers?: number;
  articleSentencesMaxOutputTokens?: number;
  coreWordsNormalizeMaxOutputTokens?: number;
  sentenceMergeMaxCompletionTokens?: number;
  openaiBaseUrl?: string;
  skipLlmStructuredParse?: boolean;
  openaiApiKey?: string;
  articleWordImportInitialWeight?: number;
  articleWordImportInitialDuration?: number;
  dreamShortTermToLongTermWeightThreshold?: number;
  relevanceScoreMaxLlmAttempts?: number;
  dreamTime?: string;
}

interface ConfigFile {
  memok?: MemokConfig;
}

let cachedConfig: ConfigFile = {};

export function loadConfig(): void {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = readFileSync(CONFIG_PATH, "utf-8");
      cachedConfig = TOML.parse(data) as ConfigFile;
      logger.info({ path: CONFIG_PATH }, "Loaded config.toml");
    } else {
      cachedConfig = {};
      logger.warn({ path: CONFIG_PATH }, "config.toml not found, using defaults");
    }
  } catch (e) {
    logger.error({ err: e, path: CONFIG_PATH }, "Failed to parse config.toml");
    cachedConfig = {};
  }
}

export function saveConfig(): boolean {
  try {
    writeFileSync(CONFIG_PATH, TOML.stringify(cachedConfig as any));
    logger.info({ path: CONFIG_PATH }, "Saved config.toml");
    return true;
  } catch (e) {
    logger.error({ err: e, path: CONFIG_PATH }, "Failed to save config.toml");
    return false;
  }
}

export function getConfig(): MemokConfig {
  return { ...(cachedConfig.memok ?? {}) };
}

export function updateConfig(updates: Partial<MemokConfig>): boolean {
  const allowedKeys = new Set<keyof MemokConfig>([
    "dbPath",
    "llmModel",
    "llmMaxWorkers",
    "articleSentencesMaxOutputTokens",
    "coreWordsNormalizeMaxOutputTokens",
    "sentenceMergeMaxCompletionTokens",
    "openaiBaseUrl",
    "skipLlmStructuredParse",
    "openaiApiKey",
    "articleWordImportInitialWeight",
    "articleWordImportInitialDuration",
    "dreamShortTermToLongTermWeightThreshold",
    "relevanceScoreMaxLlmAttempts",
    "dreamTime",
  ]);

  const filtered: Partial<MemokConfig> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys.has(key as keyof MemokConfig)) {
      (filtered as any)[key] = value;
    }
  }

  cachedConfig.memok = { ...cachedConfig.memok, ...filtered };
  return saveConfig();
}

export function resetConfig(): boolean {
  cachedConfig.memok = {};
  return saveConfig();
}

export interface ConfigMeta {
  key: string;
  label: string;
  type: "text" | "number" | "url" | "boolean" | "password";
  envKey: string;
  editable: boolean;
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
  restartRequired?: boolean;
}

export function getConfigMetadata(): ConfigMeta[] {
  return [
    {
      key: "dbPath",
      label: "Database Path",
      type: "text",
      envKey: "MEMOK_DB_PATH",
      editable: true,
      defaultValue: "./data/memok.sqlite",
    },
    {
      key: "llmModel",
      label: "LLM Model",
      type: "text",
      envKey: "MEMOK_LLM_MODEL",
      editable: true,
      defaultValue: "gpt-4o-mini",
    },
    {
      key: "llmMaxWorkers",
      label: "LLM Max Workers",
      type: "number",
      envKey: "MEMOK_LLM_MAX_WORKERS",
      editable: true,
      defaultValue: 4,
      min: 1,
      max: 64,
    },
    {
      key: "articleSentencesMaxOutputTokens",
      label: "Article Sentences Max Output Tokens",
      type: "number",
      envKey: "MEMOK_V2_ARTICLE_SENTENCES_MAX_OUTPUT_TOKENS",
      editable: true,
      defaultValue: 8192,
      min: 1,
    },
    {
      key: "coreWordsNormalizeMaxOutputTokens",
      label: "Core Words Normalize Max Output Tokens",
      type: "number",
      envKey: "MEMOK_CORE_WORDS_NORMALIZE_MAX_OUTPUT_TOKENS",
      editable: true,
      defaultValue: 32768,
      min: 1,
    },
    {
      key: "sentenceMergeMaxCompletionTokens",
      label: "Sentence Merge Max Completion Tokens",
      type: "number",
      envKey: "MEMOK_SENTENCE_MERGE_MAX_COMPLETION_TOKENS",
      editable: true,
      defaultValue: 2048,
      min: 1,
    },
    {
      key: "openaiBaseUrl",
      label: "OpenAI Base URL",
      type: "url",
      envKey: "OPENAI_BASE_URL",
      editable: true,
      defaultValue: "https://api.deepseek.com/v1",
    },
    {
      key: "skipLlmStructuredParse",
      label: "Skip LLM Structured Parse",
      type: "boolean",
      envKey: "MEMOK_SKIP_LLM_STRUCTURED_PARSE",
      editable: true,
      defaultValue: false,
    },
    {
      key: "openaiApiKey",
      label: "OpenAI API Key",
      type: "password",
      envKey: "OPENAI_API_KEY",
      editable: true,
      defaultValue: "",
    },
    {
      key: "articleWordImportInitialWeight",
      label: "Article Word Import Initial Weight",
      type: "number",
      envKey: "MEMOK_ARTICLE_WORD_IMPORT_INITIAL_WEIGHT",
      editable: true,
      defaultValue: 1,
      min: 0,
    },
    {
      key: "articleWordImportInitialDuration",
      label: "Article Word Import Initial Duration",
      type: "number",
      envKey: "MEMOK_ARTICLE_WORD_IMPORT_INITIAL_DURATION",
      editable: true,
      defaultValue: 7,
      min: 1,
    },
    {
      key: "dreamShortTermToLongTermWeightThreshold",
      label: "Dream Short-Term to Long-Term Weight Threshold",
      type: "number",
      envKey: "MEMOK_DREAM_SHORT_TERM_TO_LONG_TERM_WEIGHT_THRESHOLD",
      editable: true,
      defaultValue: 7,
      min: 1,
    },
    {
      key: "relevanceScoreMaxLlmAttempts",
      label: "Relevance Score Max LLM Attempts",
      type: "number",
      envKey: "MEMOK_RELEVANCE_SCORE_MAX_LLM_ATTEMPTS",
      editable: true,
      defaultValue: 5,
      min: 1,
      max: 32,
    },
    {
      key: "dreamTime",
      label: "Dream Time",
      type: "text",
      envKey: "MEMOK_DREAM_TIME",
      editable: true,
      defaultValue: "03:00",
    },
  ];
}

export interface ConfigItem {
  value: string | number | boolean;
  source: "env" | "config" | "default";
  raw: string | number | boolean | null;
  editable: boolean;
  restartRequired: boolean;
}

function castValue(value: unknown, type: ConfigMeta["type"]): string | number | boolean {
  if (type === "number") return Number(value);
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const s = String(value).toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return String(value);
}

function maskSecret(s: string): string {
  if (!s || s.length <= 8) return s ? "****" : "";
  return s.slice(0, 4) + "****" + s.slice(-4);
}

export function getEffectiveConfig(): Record<string, ConfigItem> {
  const meta = getConfigMetadata();
  const cfg = getConfig();
  const result: Record<string, ConfigItem> = {};

  for (const m of meta) {
    const envVal = process.env[m.envKey];
    const configVal = cfg[m.key as keyof MemokConfig];

    if (envVal !== undefined && envVal !== "") {
      const cast = castValue(envVal, m.type);
      result[m.key] = {
        value: m.type === "password" ? maskSecret(String(cast)) : cast,
        source: "env",
        raw: m.type === "password" ? null : cast,
        editable: false,
        restartRequired: false,
      };
    } else if (configVal !== undefined && configVal !== "") {
      const cast = castValue(configVal, m.type);
      result[m.key] = {
        value: m.type === "password" ? maskSecret(String(cast)) : cast,
        source: "config",
        raw: m.type === "password" ? null : cast,
        editable: m.editable !== false,
        restartRequired: false,
      };
    } else {
      result[m.key] = {
        value: m.type === "password" ? "" : m.defaultValue,
        source: "default",
        raw: m.type === "password" ? null : m.defaultValue,
        editable: m.editable !== false,
        restartRequired: false,
      };
    }
  }

  return result;
}

loadConfig();
