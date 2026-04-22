import { createFreshMemokSqliteFile } from "memok-ai/bridge";
import { resolveDbPath } from "../memokEnvConfig.js";

const dbPath = resolveDbPath();
const replace = process.env.MEMOK_DB_REPLACE === "1";

createFreshMemokSqliteFile(dbPath, replace ? { replace: true } : {});
console.log(`memok database ready: ${dbPath}`);
