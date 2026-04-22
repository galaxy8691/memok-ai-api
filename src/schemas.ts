import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const MemokPipelineConfigSchema = z
  .object({
    openaiApiKey: z.string().min(1).optional().openapi({
      description: "OpenAI API key (or set OPENAI_API_KEY env)",
      example: "sk-...",
    }),
    dbPath: z.string().min(1).optional().openapi({
      description: "SQLite database path",
      example: "./memok.sqlite",
    }),
    openaiBaseUrl: z.string().url().optional().openapi({
      description: "Custom OpenAI-compatible base URL",
      example: "https://api.openai.com/v1",
    }),
    llmModel: z.string().min(1).optional().openapi({
      description: "LLM model name",
      example: "gpt-4o-mini",
    }),
    llmMaxWorkers: z.number().int().min(1).max(64).optional().openapi({
      description: "Max concurrent LLM workers",
      example: 4,
    }),
    articleSentencesMaxOutputTokens: z.number().int().min(1).optional(),
    coreWordsNormalizeMaxOutputTokens: z.number().int().min(1).optional(),
    sentenceMergeMaxCompletionTokens: z.number().int().min(1).optional(),
    skipLlmStructuredParse: z.boolean().optional(),
    // === aligned with memok-ai core (memokPipeline.ts) ===
    articleWordImportInitialWeight: z.number().int().min(0).optional().openapi({
      description: "Initial weight for newly imported sentences (default 1)",
      example: 1,
    }),
    articleWordImportInitialDuration: z.number().int().min(0).optional().openapi({
      description: "Initial duration for newly imported sentences (default 7)",
      example: 7,
    }),
    dreamShortTermToLongTermWeightThreshold: z.number().int().min(0).optional().openapi({
      description: "Weight threshold for short-term sentences to be promoted to long-term during predream (default 7)",
      example: 7,
    }),
    relevanceScoreMaxLlmAttempts: z.number().int().min(1).max(32).optional().openapi({
      description: "Max LLM retry attempts for relevance scoring (default 5, max 32)",
      example: 5,
    }),
  })
  .optional()
  .openapi("MemokPipelineConfig");

export const ArticleWordPipelineRequestSchema = z.object({
  text: z.string().min(1).openapi({
    description: "Article text to process",
    example: "Hello world.",
  }),
  today: z.string().optional().openapi({
    description: "Override today's date (YYYY-MM-DD)",
    example: "2026-04-21",
  }),
  persist: z.boolean().optional().openapi({
    description: "Persist results to DB (default true)",
    example: true,
  }),
}).openapi("ArticleWordPipelineRequest");

export type ArticleWordPipelineRequest = z.infer<
  typeof ArticleWordPipelineRequestSchema
>;

export const ArticleWordPipelineBatchRequestSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1),
        today: z.string().optional(),
        persist: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(50)
    .openapi({
      description: "Batch of articles to process concurrently",
    }),
}).openapi("ArticleWordPipelineBatchRequest");

export type ArticleWordPipelineBatchRequest = z.infer<
  typeof ArticleWordPipelineBatchRequestSchema
>;

export const DreamingPipelineRequestSchema = z.object({
  maxWords: z.number().int().positive().optional().openapi({
    description: "Max words for dream text generation",
    example: 200,
  }),
  fraction: z.number().min(0).max(1).optional().openapi({
    description: "Sampling fraction",
    example: 0.3,
  }),
  minRuns: z.number().int().positive().optional().openapi({
    description: "Minimum story runs",
    example: 3,
  }),
  maxRuns: z.number().int().positive().optional().openapi({
    description: "Maximum story runs",
    example: 5,
  }),
}).openapi("DreamingPipelineRequest");

export type DreamingPipelineRequest = z.infer<
  typeof DreamingPipelineRequestSchema
>;

export const ExtractMemoryRequestSchema = z.object({
  fraction: z.number().min(0).max(1).optional().openapi({
    description: "Short-term sampling fraction",
    example: 0.2,
  }),
  longTermFraction: z.number().min(0).max(1).optional().openapi({
    description: "Long-term sampling fraction",
    example: 0.1,
  }),
}).openapi("ExtractMemoryRequest");

export type ExtractMemoryRequest = z.infer<typeof ExtractMemoryRequestSchema>;

export const SentenceUsageFeedbackRequestSchema = z.object({
  sentenceIds: z.array(z.number().int()).min(1).openapi({
    description: "Sentence IDs to apply feedback to",
    example: [1, 2, 3],
  }),
  lastEditDate: z.string().optional().openapi({
    description: "Last edit date (YYYY-MM-DD)",
    example: "2026-04-21",
  }),
}).openapi("SentenceUsageFeedbackRequest");

export type SentenceUsageFeedbackRequest = z.infer<
  typeof SentenceUsageFeedbackRequestSchema
>;

export const DreamLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50).openapi({
    description: "Max rows to return",
    example: 50,
  }),
  offset: z.coerce.number().int().min(0).default(0).openapi({
    description: "Offset for pagination",
    example: 0,
  }),
  status: z.string().optional().openapi({
    description: "Filter by status",
    example: "success",
  }),
}).openapi("DreamLogsQuery");

export type DreamLogsQuery = z.infer<typeof DreamLogsQuerySchema>;

// ===== Response schemas (aligned with memok-ai core types) =====

/** {@link ArticleSentenceCoreItem} from core */
export const ArticleSentenceCoreItemSchema = z.object({
  sentence: z.string(),
  core_words: z.array(z.string()),
}).strict().openapi("ArticleSentenceCoreItem");

/** {@link ArticleSentenceCoreCombinedData} from core */
export const ArticleSentenceCoreCombinedDataSchema = z.object({
  sentence_core: z.array(ArticleSentenceCoreItemSchema),
}).strict().openapi("ArticleSentenceCoreCombinedData");

/** {@link ArticleCoreWordNomalizePair} from core */
export const ArticleCoreWordNomalizePairSchema = z.object({
  original_text: z.string(),
  new_text: z.string(),
}).strict().openapi("ArticleCoreWordNomalizePair");

/** {@link ArticleCoreWordsNomalizedData} from core */
export const ArticleCoreWordsNomalizedDataSchema = z.object({
  nomalized: z.array(ArticleCoreWordNomalizePairSchema),
}).strict().openapi("ArticleCoreWordsNomalizedData");

/** POST /v1/article-word-pipeline response */
export const ArticleWordPipelineResponseSchema = z.object({
  sentenceCore: ArticleSentenceCoreCombinedDataSchema,
  normalized: ArticleCoreWordsNomalizedDataSchema,
  persisted: z.boolean(),
}).openapi("ArticleWordPipelineResponse");

export type ArticleWordPipelineResponse = z.infer<
  typeof ArticleWordPipelineResponseSchema
>;

/** {@link WordMatchLink} from core */
export const WordMatchLinkSchema = z.object({
  word: z.string(),
  normal_word: z.string(),
}).strict().openapi("WordMatchLink");

/** {@link MemoryExtractedSentence} from core */
export const MemoryExtractedSentenceSchema = z.object({
  id: z.number().int(),
  sentence: z.string(),
  weight: z.number().int(),
  duration: z.number().int(),
  is_short_term: z.boolean(),
  matched_word: WordMatchLinkSchema,
}).strict().openapi("MemoryExtractedSentence");

/** POST /v1/extract-memory response (aligned with {@link MemoryExtractResponse}) */
export const ExtractMemoryResponseSchema = z.object({
  sentences: z.array(MemoryExtractedSentenceSchema),
}).strict().openapi("ExtractMemoryResponse");

export type ExtractMemoryResponse = z.infer<typeof ExtractMemoryResponseSchema>;

/** POST /v1/sentence-usage-feedback response (aligned with {@link applySentenceUsageFeedback} return type) */
export const SentenceUsageFeedbackResponseSchema = z.object({
  updatedCount: z.number().int().min(0),
}).openapi("SentenceUsageFeedbackResponse");

export type SentenceUsageFeedbackResponse = z.infer<
  typeof SentenceUsageFeedbackResponseSchema
>;

// ===== DB meta schemas =====

export const DbStatsSchema = z.object({
  words: z.number().int().min(0),
  normalWords: z.number().int().min(0),
  sentences: z.number().int().min(0),
  wordToNormalLinks: z.number().int().min(0),
  sentenceToNormalLinks: z.number().int().min(0),
  dreamLogs: z.number().int().min(0),
  // extended
  wordsDiskBytes: z.number().int().min(0).optional(),
  normalWordsDiskBytes: z.number().int().min(0).optional(),
  sentencesDiskBytes: z.number().int().min(0).optional(),
  linksDiskBytes: z.number().int().min(0).optional(),
  dreamLogsDiskBytes: z.number().int().min(0).optional(),
  totalDiskBytes: z.number().int().min(0).optional(),
  lastInsertRowId: z.number().int().min(0).optional(),
}).openapi("DbStats");

export type DbStats = z.infer<typeof DbStatsSchema>;

export const DbWordTopItemSchema = z.object({
  word: z.string(),
  linkCount: z.number().int().min(0),
}).openapi("DbWordTopItem");

export const DbWordStatsSchema = z.object({
  topNormalWords: z.array(DbWordTopItemSchema),
  weightDistribution: z.object({
    low: z.number().int(),      // weight <= 3
    medium: z.number().int(),   // 4 <= weight <= 7
    high: z.number().int(),     // weight >= 8
  }),
  recentlyAdded: z.array(z.object({
    word: z.string(),
    normalWord: z.string(),
    sentenceCount: z.number().int(),
  })),
}).openapi("DbWordStats");

export type DbWordStats = z.infer<typeof DbWordStatsSchema>;

export const DbSentenceStatsSchema = z.object({
  total: z.number().int().min(0),
  avgLength: z.number(),
  shortTermCount: z.number().int().min(0),
  longTermCount: z.number().int().min(0),
  linkDensity: z.number(), // sentence_to_normal_links / sentences
  weightDistribution: z.object({
    low: z.number().int(),
    medium: z.number().int(),
    high: z.number().int(),
  }),
}).openapi("DbSentenceStats");

export type DbSentenceStats = z.infer<typeof DbSentenceStatsSchema>;

export const DreamingTrendItemSchema = z.object({
  dreamDate: z.string(),
  status: z.string(),
  elapsedMs: z.number().int().optional(),
}).openapi("DreamingTrendItem");

export const DbDreamingTrendSchema = z.object({
  recent: z.array(DreamingTrendItemSchema),
  successRate7d: z.number().min(0).max(1).optional(),
  avgElapsedMs7d: z.number().int().optional(),
}).openapi("DbDreamingTrend");

export type DbDreamingTrend = z.infer<typeof DbDreamingTrendSchema>;
