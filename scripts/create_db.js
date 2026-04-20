/**
 * 项目初始化：在 `MEMOK_DB_PATH`（默认 `./memok.sqlite`）创建空 memok SQLite 库。
 * 覆盖已有文件：`MEMOK_DB_REPLACE=1 npm run create-db`
 */
import { createFreshMemokSqliteFile } from "memok-ai/bridge";
import { resolveDbPath } from "../src/memokEnvConfig.js";

const dbPath = resolveDbPath();
const replace = process.env.MEMOK_DB_REPLACE === "1";

createFreshMemokSqliteFile(dbPath, replace ? { replace: true } : {});
console.log(`memok database ready: ${dbPath}`);
