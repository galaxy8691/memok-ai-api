# memok-ai-api

基于 [memok-ai `feature/pipeline-config`](https://github.com/galaxy8691/memok-ai/tree/feature/pipeline-config) 的 `memok-ai/bridge` 能力，用 **Express** 暴露 HTTP API。

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
npm start
```

## 环境变量（与 memok-ai README 对齐）

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
| `MEMOK_DB_REPLACE` | 设为 `1` 时，`npm run create-db` 会删除已存在的库再重建 |

## 初始化数据库

首次部署在启动 API 前执行（使用 `MEMOK_DB_PATH`，默认 `./memok.sqlite`）：

```bash
npm run create-db
```

若路径上已有文件且需覆盖：`MEMOK_DB_REPLACE=1 npm run create-db`

## 路由

- `GET /health` — 存活检查
- `POST /v1/article-word-pipeline` — 与 bridge `articleWordPipeline` 同流程（`articleWordPipelineV2` + `importAwpV2Tuple`），**响应 JSON**：`sentenceCore`、`normalized`（v2 元组）、`persisted`（是否已写库）。body: `{ "text": string, "today"?: string, "persist"?: boolean（默认 true）, "config"?: … }`
- `POST /v1/dreaming-pipeline` — `dreamingPipeline`；body 可为 `MemokPipelineConfig` 与 dreaming 可选字段的扁平对象，或 `{ "config": { ... } }`；`dreamLogWarn` 由服务端写 stderr
- `POST /v1/extract-memory` — `extractMemorySentencesByWordSample`；body: `{ "fraction"?: number, "longTermFraction"?: number, "config"?: ... }`
- `POST /v1/sentence-usage-feedback` — `applySentenceUsageFeedback`；body: `{ "sentenceIds": number[], "lastEditDate"?: string, "config"?: ... }`

请求体中的 `config` 会与进程环境合并，用于覆盖 `MemokPipelineConfig` 的任意字段。

## 许可

与上游 [memok-ai](https://github.com/galaxy8691/memok-ai) 一致（MIT）。
