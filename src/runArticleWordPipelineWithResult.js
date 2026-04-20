import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  articleWordPipelineV2,
  buildPipelineContext,
  importAwpV2Tuple,
} from "memok-ai";

const memokDistDir = dirname(fileURLToPath(import.meta.resolve("memok-ai")));
const { openSqlite } = await import(
  pathToFileURL(join(memokDistDir, "sqlite", "openSqlite.js")).href,
);

/**
 * 与 bridge {@link import('memok-ai/bridge').articleWordPipeline} 相同的 LLM + 写库流程，
 * 并在响应中返回 v2 元组（`sentenceCore` / `normalized`）。
 *
 * @param {string} text
 * @param {import('memok-ai/bridge').ArticleWordPipelineSaveDbOptions} options
 * @param {{ persist?: boolean }} [runOpts] `persist: false` 时只跑流水线、不写 SQLite
 */
export async function runArticleWordPipelineWithResult(
  text,
  options,
  runOpts = {},
) {
  const persist = runOpts.persist !== false;
  const ctx = buildPipelineContext(options);
  const [sentenceCore, normalized] = await articleWordPipelineV2(text.trim(), {
    ctx,
  });
  if (persist) {
    const db = openSqlite(options.dbPath);
    try {
      const tx = db.transaction(() => {
        importAwpV2Tuple(db, sentenceCore, normalized, {
          today: options.today,
        });
      });
      tx();
    } finally {
      db.close();
    }
  }
  return { sentenceCore, normalized, persisted: persist };
}
