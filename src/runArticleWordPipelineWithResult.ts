import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  articleWordPipelineV2,
  buildPipelineContext,
  importAwpV2Tuple,
} from "memok-ai";
import type { ArticleWordPipelineSaveDbOptions } from "memok-ai/bridge";
import type {
  ArticleSentenceCoreCombinedData,
  ArticleCoreWordsNomalizedData,
} from "memok-ai";

const memokDistDir = dirname(fileURLToPath(import.meta.resolve("memok-ai")));
const { openSqlite } = await import(
  pathToFileURL(join(memokDistDir, "sqlite", "openSqlite.js")).href
);

export interface RunArticleWordPipelineOpts {
  persist?: boolean;
}

export interface ArticleWordPipelineResult {
  sentenceCore: ArticleSentenceCoreCombinedData;
  normalized: ArticleCoreWordsNomalizedData;
  persisted: boolean;
}

export async function runArticleWordPipelineWithResult(
  text: string,
  options: ArticleWordPipelineSaveDbOptions,
  runOpts: RunArticleWordPipelineOpts = {},
): Promise<ArticleWordPipelineResult> {
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
