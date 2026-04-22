import { OpenApiGeneratorV3, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  ArticleWordPipelineRequestSchema,
  ArticleWordPipelineBatchRequestSchema,
  ExtractMemoryRequestSchema,
  SentenceUsageFeedbackRequestSchema,
  DreamLogsQuerySchema,
  ArticleWordPipelineResponseSchema,
  ExtractMemoryResponseSchema,
  SentenceUsageFeedbackResponseSchema,
  DbStatsSchema,
} from "./schemas.js";

const registry = new OpenAPIRegistry();

// Schemas
registry.register("ArticleWordPipelineRequest", ArticleWordPipelineRequestSchema);
registry.register("ArticleWordPipelineBatchRequest", ArticleWordPipelineBatchRequestSchema);

registry.register("ExtractMemoryRequest", ExtractMemoryRequestSchema);
registry.register("SentenceUsageFeedbackRequest", SentenceUsageFeedbackRequestSchema);
registry.register("DreamLogsQuery", DreamLogsQuerySchema);
registry.register("ArticleWordPipelineResponse", ArticleWordPipelineResponseSchema);
registry.register("ExtractMemoryResponse", ExtractMemoryResponseSchema);
registry.register("SentenceUsageFeedbackResponse", SentenceUsageFeedbackResponseSchema);
registry.register("DbStats", DbStatsSchema);

const ErrorResponse = registry.register("ErrorResponse", z.object({
  error: z.string(),
  issues: z.array(z.object({ path: z.array(z.string()), message: z.string() })).optional(),
}));

// Paths
registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["System"],
  description: "Health check",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: z.object({ ok: z.boolean(), service: z.string(), version: z.string() }).openapi("HealthResponse"),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/metrics",
  tags: ["System"],
  description: "Prometheus metrics",
  responses: {
    200: { description: "Prometheus exposition format" },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/article-word-pipeline",
  tags: ["Pipeline"],
  description: "Run article-word-pipeline on a single text",
  request: {
    body: {
      content: {
        "application/json": { schema: ArticleWordPipelineRequestSchema },
      },
      description: "Pipeline input",
    },
  },
  responses: {
    200: {
      description: "Pipeline result",
      content: { "application/json": { schema: ArticleWordPipelineResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
    500: { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/article-word-pipeline/batch",
  tags: ["Pipeline"],
  description: "Batch run article-word-pipeline (max 50 items)",
  request: {
    body: {
      content: {
        "application/json": { schema: ArticleWordPipelineBatchRequestSchema },
      },
      description: "Batch input",
    },
  },
  responses: {
    200: { description: "Batch results" },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
    500: { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/extract-memory",
  tags: ["Memory"],
  description: "Extract memory sentences by word sample",
  request: {
    body: {
      content: {
        "application/json": { schema: ExtractMemoryRequestSchema },
      },
      description: "Extraction parameters",
    },
  },
  responses: {
    200: {
      description: "Extracted sentences",
      content: { "application/json": { schema: ExtractMemoryResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
    500: { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/sentence-usage-feedback",
  tags: ["Memory"],
  description: "Apply sentence usage feedback",
  request: {
    body: {
      content: {
        "application/json": { schema: SentenceUsageFeedbackRequestSchema },
      },
      description: "Feedback parameters",
    },
  },
  responses: {
    200: {
      description: "Feedback result",
      content: { "application/json": { schema: SentenceUsageFeedbackResponseSchema } },
    },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
    500: { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/db/stats",
  tags: ["DB"],
  description: "Get DB statistics",
  responses: {
    200: {
      description: "DB stats",
      content: { "application/json": { schema: DbStatsSchema } },
    },
    500: { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/db/dream-logs",
  tags: ["DB"],
  description: "List dream logs",
  request: { query: DreamLogsQuerySchema },
  responses: {
    200: { description: "Array of dream log rows" },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponse } } },
    500: { description: "Internal error", content: { "application/json": { schema: ErrorResponse } } },
  },
});

export const openApiGenerator = new OpenApiGeneratorV3(registry.definitions);

export function generateOpenAPIDocument() {
  return openApiGenerator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "memok-ai-api",
      version: "0.2.0",
      description: "HTTP API for memok-ai pipelines",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
  });
}
