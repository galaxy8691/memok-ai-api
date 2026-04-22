# memok-ai-api

基于 [memok-ai `feature/pipeline-config`](https://github.com/galaxy8691/memok-ai/tree/feature/pipeline-config) 的 `memok-ai/bridge` 能力，用 **Express + TypeScript** 暴露 HTTP API。

- **Zod** 输入校验与类型安全
- **OpenAPI 3.x** 文档（`/api-docs`）
- **Prometheus** 指标（`/metrics`）
- **Pino** 结构化日志
- **SSE** 流式 dreaming 进度推送
- 批量 article-word-pipeline
- DB 元信息查询（统计、dream_logs）

## 要求

- Node.js **≥ 20**

## 安装与启动

```bash
npm install
npm run create-db
export OPENAI_API_KEY=sk-...
# 可选
export OPENAI_BASE_URL=https://api.openai.com/v1
export MEMOK_DB_PATH=./data/memok.sqlite
export PORT=3000
# 可选：保护接口
export MEMOK_API_KEY=your-secret
npm run dev
```

生产构建与运行：

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t memok-ai-api .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... memok-ai-api
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | 调用 LLM 的密钥（也可在请求体 `config.openaiApiKey` 传入） |
| `OPENAI_BASE_URL` | 可选，兼容网关地址 |
| `MEMOK_DB_PATH` | 默认 `./memok.sqlite` |
| `MEMOK_LLM_MODEL` | 默认 `gpt-4o-mini` |
| `MEMOK_LLM_MAX_WORKERS` | 默认 `4`（1–64） |
| `MEMOK_V2_ARTICLE_SENTENCES_MAX_OUTPUT_TOKENS` | 默认 `8192` |
| `MEMOK_CORE_WORDS_NORMALIZE_MAX_OUTPUT_TOKENS` | 默认 `32768` |
| `MEMOK_SENTENCE_MERGE_MAX_COMPLETION_TOKENS` | 默认 `2048` |
| `MEMOK_SKIP_LLM_STRUCTURED_PARSE` | `1` / `true` / `yes` / `on` |
| `PORT` | 默认 `3000` |
| `MEMOK_API_KEY` | 若设置，则要求 `Authorization: Bearer <key>` 或 `x-api-key: <key>` |
| `LOG_LEVEL` | 默认 `info`（`trace` / `debug` / `info` / `warn` / `error` / `fatal`） |
| `MEMOK_DB_REPLACE` | 设为 `1` 时，`npm run create-db` 会删除已存在的库再重建 |

## 初始化数据库

首次部署在启动 API 前执行（使用 `MEMOK_DB_PATH`，默认 `./memok.sqlite`）：

```bash
npm run create-db
```

若路径上已有文件且需覆盖：`MEMOK_DB_REPLACE=1 npm run create-db`

## 路由

### 基础

- `GET /health` — 存活检查
- `GET /metrics` — Prometheus 指标
- `GET /openapi.json` — OpenAPI 规范 JSON
- `GET /api-docs` — Swagger UI 文档

### Article Word Pipeline

- `POST /v1/article-word-pipeline` — 单条文章处理
  - body: `{ "text": string, "today"?: string, "persist"?: boolean（默认 true）, "config"?: MemokPipelineConfig }`
  - 响应: `{ sentenceCore, normalized, persisted }`

- `POST /v1/article-word-pipeline/batch` — 批量并发处理（最多 50 条）
  - body: `{ "items": Array<{ text, today?, persist?, config? }> }`
  - 响应: `{ count: number, results: Array<{ index, status: "success" | "error", data? | error? }> }`

### Dreaming Pipeline

- `POST /v1/dreaming-pipeline` — 同步 dreaming
  - body: `{ "config"?: MemokPipelineConfig, "maxWords"?: number, "fraction"?: number, "minRuns"?: number, "maxRuns"?: number }`

- `POST /v1/dreaming-pipeline/stream` — **SSE 流式 dreaming**
  - 请求体与同步端点相同
  - 事件流:
    - `event: start` — 开始
    - `event: predream` — predream 阶段完成（含衰减统计）
    - `event: story` — story-word-sentence 阶段完成
    - `event: done` — 全部完成，含完整结果
    - `event: error` — 发生错误

### Memory & Feedback

- `POST /v1/extract-memory` — `extractMemorySentencesByWordSample`
  - body: `{ "fraction"?: number, "longTermFraction"?: number, "config"?: MemokPipelineConfig }`

- `POST /v1/sentence-usage-feedback` — `applySentenceUsageFeedback`
  - body: `{ "sentenceIds": number[], "lastEditDate"?: string, "config"?: MemokPipelineConfig }`

### DB 元信息

- `GET /v1/db/stats` — 统计各表行数
  - 响应: `{ words, normalWords, sentences, wordToNormalLinks, sentenceToNormalLinks, dreamLogs }`

- `GET /v1/db/dream-logs` — 查询 `dream_logs`
  - query: `?limit=50&offset=0&status=`

## 可观测性

### 日志

服务使用 **Pino** 输出结构化 JSON 日志。开发环境下会自动美化。

### Metrics

`/metrics` 暴露以下指标：

| 指标名 | 类型 | 说明 |
|--------|------|------|
| `http_request_duration_seconds` | Histogram | HTTP 请求延迟（按 method / route / status） |
| `http_requests_total` | Counter | HTTP 请求总数 |
| `memok_pipeline_runs_total` | Counter | 各 pipeline 运行次数与结果状态 |
| `memok_pipeline_duration_seconds` | Histogram | Pipeline 运行耗时 |
| `memok_db_queries_total` | Counter | DB 查询次数（按 operation） |
| `memok_sse_connections_active` | Gauge | 活跃 SSE 连接数 |
| `process_*` / `node_*` | — | `prom-client` 默认 Node.js 进程指标 |

## 许可

与上游 [memok-ai](https://github.com/galaxy8691/memok-ai) 一致（MIT）。
