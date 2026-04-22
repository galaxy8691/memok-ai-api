import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Database } from "better-sqlite3";
import type { MemokPipelineConfig } from "memok-ai/bridge";
import { logger } from "./logger.js";
import { dbQueryTotal } from "./metrics.js";

const memokDistDir = dirname(fileURLToPath(import.meta.resolve("memok-ai")));
const { openSqlite } = await import(
  pathToFileURL(join(memokDistDir, "sqlite", "openSqlite.js")).href
);

export function openDb(config?: Partial<MemokPipelineConfig>): Database {
  const dbPath = config?.dbPath ?? process.env.MEMOK_DB_PATH ?? "./memok.sqlite";
  return openSqlite(dbPath) as Database;
}

function query<T = unknown>(db: Database, sql: string, params: unknown[] = [], operation = "select"): T[] {
  dbQueryTotal.inc({ operation });
  try {
    return db.prepare(sql).all(...params) as T[];
  } catch (e) {
    logger.error({ err: e, sql }, "DB query failed");
    throw e;
  }
}

function queryGet<T = unknown>(db: Database, sql: string, params: unknown[] = [], operation = "select"): T | undefined {
  dbQueryTotal.inc({ operation });
  try {
    return db.prepare(sql).get(...params) as T | undefined;
  } catch (e) {
    logger.error({ err: e, sql }, "DB query failed");
    throw e;
  }
}

// ===== DbStats (extended) =====

export interface DbStats {
  words: number;
  normalWords: number;
  sentences: number;
  wordToNormalLinks: number;
  sentenceToNormalLinks: number;
  dreamLogs: number;
  // extended
  wordsDiskBytes?: number;
  normalWordsDiskBytes?: number;
  sentencesDiskBytes?: number;
  linksDiskBytes?: number;
  dreamLogsDiskBytes?: number;
  totalDiskBytes?: number;
  lastInsertRowId?: number;
}

export function getDbStats(db: Database): DbStats {
  const words = queryGet<{ count: number }>(db, "SELECT COUNT(*) AS count FROM words", [], "count");
  const normalWords = queryGet<{ count: number }>(db, "SELECT COUNT(*) AS count FROM normal_words", [], "count");
  const sentences = queryGet<{ count: number }>(db, "SELECT COUNT(*) AS count FROM sentences", [], "count");
  const wordLinks = queryGet<{ count: number }>(db, "SELECT COUNT(*) AS count FROM word_to_normal_link", [], "count");
  const sentenceLinks = queryGet<{ count: number }>(db, "SELECT COUNT(*) AS count FROM sentence_to_normal_link", [], "count");
  const dreamLogs = queryGet<{ count: number }>(db, "SELECT COUNT(*) AS count FROM dream_logs", [], "count");

  // SQLite page_size * number of pages for the whole file
  const pageSize = queryGet<{ page_size: number }>(db, "PRAGMA page_size", [], "pragma");
  const pageCount = queryGet<{ page_count: number }>(db, "PRAGMA page_count", [], "pragma");
  const totalDiskBytes = (pageSize?.page_size ?? 0) * (pageCount?.page_count ?? 0);

  // Per-table size estimates (SQLite doesn't expose per-table disk usage natively;
  // we approximate via row count ratios when total is available)
  const totalRows =
    (words?.count ?? 0) +
    (normalWords?.count ?? 0) +
    (sentences?.count ?? 0) +
    (wordLinks?.count ?? 0) +
    (sentenceLinks?.count ?? 0) +
    (dreamLogs?.count ?? 0);

  const approxBytes = (rowCount: number): number | undefined => {
    if (totalDiskBytes === 0 || totalRows === 0) return undefined;
    return Math.round((rowCount / totalRows) * totalDiskBytes);
  };

  return {
    words: words?.count ?? 0,
    normalWords: normalWords?.count ?? 0,
    sentences: sentences?.count ?? 0,
    wordToNormalLinks: wordLinks?.count ?? 0,
    sentenceToNormalLinks: sentenceLinks?.count ?? 0,
    dreamLogs: dreamLogs?.count ?? 0,
    wordsDiskBytes: approxBytes(words?.count ?? 0),
    normalWordsDiskBytes: approxBytes(normalWords?.count ?? 0),
    sentencesDiskBytes: approxBytes(sentences?.count ?? 0),
    linksDiskBytes: approxBytes((wordLinks?.count ?? 0) + (sentenceLinks?.count ?? 0)),
    dreamLogsDiskBytes: approxBytes(dreamLogs?.count ?? 0),
    totalDiskBytes,
    lastInsertRowId: (db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number } | undefined)?.id,
  };
}

// ===== Dream logs =====

export interface DreamLogRow {
  id: number;
  dream_date: string;
  ts: string;
  status: string;
  log_json: string;
}

export function getDreamLogs(
  db: Database,
  { limit, offset, status }: { limit: number; offset: number; status?: string },
): DreamLogRow[] {
  let sql = "SELECT id, dream_date, ts, status, log_json FROM dream_logs";
  const params: unknown[] = [];
  if (status) {
    sql += " WHERE status = ?";
    params.push(status);
  }
  sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  return query<DreamLogRow>(db, sql, params, "select");
}

// ===== Word stats =====

export interface DbWordTopItem {
  word: string;
  linkCount: number;
}

export interface DbWordStats {
  topNormalWords: DbWordTopItem[];
  weightDistribution: {
    low: number;    // weight <= 3
    medium: number; // 4 <= weight <= 7
    high: number;   // weight >= 8
  };
  recentlyAdded: Array<{
    word: string;
    normalWord: string;
    sentenceCount: number;
  }>;
}

export function getDbWordStats(db: Database, topN = 20): DbWordStats {
  const topNormalWords = query<DbWordTopItem>(
    db,
    `SELECT nw.word, COUNT(snl.sentence_id) AS linkCount
     FROM normal_words nw
     JOIN sentence_to_normal_link snl ON snl.normal_id = nw.id
     GROUP BY nw.id
     ORDER BY linkCount DESC
     LIMIT ?`,
    [topN],
    "select",
  );

  const low = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE COALESCE(weight, 0) <= 3", [], "count");
  const medium = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE COALESCE(weight, 0) BETWEEN 4 AND 7", [], "count");
  const high = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE COALESCE(weight, 0) >= 8", [], "count");

  const recentlyAdded = query<{ word: string; normalWord: string; sentenceCount: number }>(
    db,
    `SELECT w.word, nw.word AS normalWord, COUNT(snl.sentence_id) AS sentenceCount
     FROM words w
     JOIN word_to_normal_link wtn ON wtn.word_id = w.id
     JOIN normal_words nw ON nw.id = wtn.normal_id
     JOIN sentence_to_normal_link snl ON snl.normal_id = wtn.normal_id
     GROUP BY w.id
     ORDER BY w.id DESC
     LIMIT ?`,
    [topN],
    "select",
  );

  return {
    topNormalWords,
    weightDistribution: {
      low: low?.c ?? 0,
      medium: medium?.c ?? 0,
      high: high?.c ?? 0,
    },
    recentlyAdded,
  };
}

// ===== Sentence stats =====

export interface DbSentenceStats {
  total: number;
  avgLength: number;
  shortTermCount: number;
  longTermCount: number;
  linkDensity: number;
  weightDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export function getDbSentenceStats(db: Database): DbSentenceStats {
  const total = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences", [], "count");
  const avgLen = queryGet<{ avg: number }>(db, "SELECT AVG(LENGTH(sentence)) AS avg FROM sentences", [], "select");
  const shortTerm = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE is_short_term = 1", [], "count");
  const longTerm = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE is_short_term = 0 OR is_short_term IS NULL", [], "count");
  const links = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentence_to_normal_link", [], "count");

  const low = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE COALESCE(weight, 0) <= 3", [], "count");
  const medium = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE COALESCE(weight, 0) BETWEEN 4 AND 7", [], "count");
  const high = queryGet<{ c: number }>(db, "SELECT COUNT(*) AS c FROM sentences WHERE COALESCE(weight, 0) >= 8", [], "count");

  const t = total?.c ?? 0;
  return {
    total: t,
    avgLength: avgLen?.avg ?? 0,
    shortTermCount: shortTerm?.c ?? 0,
    longTermCount: longTerm?.c ?? 0,
    linkDensity: t > 0 ? (links?.c ?? 0) / t : 0,
    weightDistribution: {
      low: low?.c ?? 0,
      medium: medium?.c ?? 0,
      high: high?.c ?? 0,
    },
  };
}

// ===== Dreaming trend =====

export interface DreamingTrendItem {
  dreamDate: string;
  status: string;
  elapsedMs?: number;
}

export interface DbDreamingTrend {
  recent: DreamingTrendItem[];
  successRate7d?: number;
  avgElapsedMs7d?: number;
}

export function getDbDreamingTrend(db: Database, limit = 30): DbDreamingTrend {
  const rows = query<{ dream_date: string; status: string; log_json: string }>(
    db,
    "SELECT dream_date, status, log_json FROM dream_logs ORDER BY id DESC LIMIT ?",
    [limit],
    "select",
  );

  const recent: DreamingTrendItem[] = rows.map((r) => {
    let elapsedMs: number | undefined;
    try {
      const payload = JSON.parse(r.log_json) as Record<string, unknown>;
      if (payload.ts && typeof payload.ts === "string") {
        // dreamingPipeline 的 log_payload 没有直接记录 elapsedMs，
        // 但 storyWordSentencePipeline 各 run 有 startTime/endTime；
        // 这里取最外层的 ts 作为开始，log_json 写入时间即结束，近似估算
      }
    } catch {
      // ignore parse errors
    }
    return {
      dreamDate: r.dream_date,
      status: r.status,
      elapsedMs,
    };
  });

  // 7-day success rate approximation (using dream_date)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().slice(0, 10);

  const successCount = queryGet<{ c: number }>(
    db,
    "SELECT COUNT(*) AS c FROM dream_logs WHERE dream_date >= ? AND status = 'ok'",
    [dateStr],
    "count",
  );
  const totalCount = queryGet<{ c: number }>(
    db,
    "SELECT COUNT(*) AS c FROM dream_logs WHERE dream_date >= ?",
    [dateStr],
    "count",
  );

  return {
    recent,
    successRate7d: totalCount && totalCount.c > 0 ? (successCount?.c ?? 0) / totalCount.c : undefined,
  };
}
