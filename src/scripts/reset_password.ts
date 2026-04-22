import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const AUTH_DB_PATH = join(DATA_DIR, "auth.db");

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Allow --delete flag to simply remove auth.db
  if (args.includes("--delete") || args.includes("-d")) {
    if (existsSync(AUTH_DB_PATH)) {
      unlinkSync(AUTH_DB_PATH);
      console.log(`Deleted ${AUTH_DB_PATH}`);
      console.log("Next time you start the server, you will be prompted to set up a new password.");
    } else {
      console.log("No auth.db found. Already in uninitialized state.");
    }
    rl.close();
    return;
  }

  if (!existsSync(AUTH_DB_PATH)) {
    console.log("No auth.db found. The server is not initialized with a password yet.");
    rl.close();
    return;
  }

  const db = new Database(AUTH_DB_PATH);

  const password = await ask("Enter new password: ");
  if (!password || password.length < 6) {
    console.error("Password must be at least 6 characters.");
    db.close();
    rl.close();
    process.exit(1);
  }

  const confirm = await ask("Confirm new password: ");
  if (password !== confirm) {
    console.error("Passwords do not match.");
    db.close();
    rl.close();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const now = Date.now();
  db.prepare(
    `INSERT INTO admin_config (key, value, updated_at)
     VALUES ('password_hash', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(hash, now);

  db.close();
  console.log("Password reset successfully.");
  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
