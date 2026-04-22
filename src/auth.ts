import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../data");
mkdirSync(DATA_DIR, { recursive: true });

const AUTH_DB_PATH = join(DATA_DIR, "auth.db");

const db = new Database(AUTH_DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_config (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

const SALT_ROUNDS = 12;

export function isPasswordSet(): boolean {
  const row = db
    .prepare("SELECT value FROM admin_config WHERE key = 'password_hash'")
    .get() as { value: string } | undefined;
  return !!row?.value;
}

export function getPasswordHash(): string | undefined {
  const row = db
    .prepare("SELECT value FROM admin_config WHERE key = 'password_hash'")
    .get() as { value: string } | undefined;
  return row?.value;
}

export function setPasswordHash(hash: string): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO admin_config (key, value, updated_at)
     VALUES ('password_hash', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(hash, now);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setupPassword(plain: string): Promise<void> {
  const hash = await hashPassword(plain);
  setPasswordHash(hash);
}

export async function changePassword(
  oldPlain: string,
  newPlain: string,
): Promise<{ success: boolean; error?: string }> {
  const currentHash = getPasswordHash();
  if (!currentHash) {
    return { success: false, error: "Password not initialized" };
  }
  const valid = await verifyPassword(oldPlain, currentHash);
  if (!valid) {
    return { success: false, error: "Incorrect current password" };
  }
  const newHash = await hashPassword(newPlain);
  setPasswordHash(newHash);
  return { success: true };
}

export function closeAuthDb(): void {
  db.close();
}
