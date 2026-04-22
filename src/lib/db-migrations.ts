// Database migration utilities

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "hospitality.db");

interface Migration {
  version: number;
  name: string;
  up: string[];
  down: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "add_indexes",
    up: [
      "CREATE INDEX IF NOT EXISTS idx_transactions_guest_name ON transactions(guest_name);",
      "CREATE INDEX IF NOT EXISTS idx_transactions_phone ON transactions(phone_number);",
      "CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(voucher_code);",
      "CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);",
      "CREATE INDEX IF NOT EXISTS idx_vouchers_transaction_id ON vouchers(transaction_id);",
    ],
    down: [
      "DROP INDEX IF EXISTS idx_transactions_guest_name;",
      "DROP INDEX IF EXISTS idx_transactions_phone;",
      "DROP INDEX IF EXISTS idx_vouchers_code;",
      "DROP INDEX IF EXISTS idx_vouchers_status;",
      "DROP INDEX IF EXISTS idx_vouchers_transaction_id;",
    ],
  },
  {
    version: 2,
    name: "add_audit_columns",
    up: [
      "ALTER TABLE users ADD COLUMN updated_at TEXT;",
      "ALTER TABLE rooms ADD COLUMN updated_at TEXT;",
      "ALTER TABLE vendors ADD COLUMN updated_at TEXT;",
      "ALTER TABLE transactions ADD COLUMN updated_at TEXT;",
    ],
    down: [],
  },
  {
    version: 3,
    name: "add_soft_delete_columns",
    up: [
      "ALTER TABLE rooms ADD COLUMN deleted_at TEXT;",
      "ALTER TABLE vendors ADD COLUMN deleted_at TEXT;",
      "ALTER TABLE transactions ADD COLUMN deleted_at TEXT;",
    ],
    down: [],
  },
];

function getDb(): DatabaseSync {
  fs.mkdirSync(dataDirectory, { recursive: true });
  return new DatabaseSync(databasePath);
}

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getAppliedMigrations(db: DatabaseSync): Set<number> {
  const rows = db.prepare("SELECT version FROM _migrations").all() as Array<{ version: number }>;
  return new Set(rows.map((r) => r.version));
}

export function runMigrations(): { applied: number; failed: string[] } {
  const db = getDb();
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const failed: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    try {
      for (const sql of migration.up) {
        db.exec(sql);
      }
      db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.name,
      );
    } catch (error) {
      failed.push(`v${migration.version} ${migration.name}: ${error}`);
    }
  }

  return { applied: migrations.length - failed.length, failed };
}

export function rollbackMigration(version: number): void {
  const db = getDb();
  ensureMigrationsTable(db);

  const migration = migrations.find((m) => m.version === version);
  if (!migration) {
    throw new Error(`Migration v${version} not found`);
  }

  for (const sql of migration.down) {
    db.exec(sql);
  }
  db.prepare("DELETE FROM _migrations WHERE version = ?").run(version);
}

export function getSchemaVersion(): number {
  const db = getDb();
  ensureMigrationsTable(db);
  const row = db.prepare("SELECT MAX(version) as v FROM _migrations").get() as { v: number | null };
  return row.v ?? 0;
}

export function createBackup(): string {
  const db = getDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(dataDirectory, `hospitality-backup-${timestamp}.db`);

  fs.mkdirSync(dataDirectory, { recursive: true });

  db.exec(`
    VACUUM INTO '${backupPath}';
  `);

  return backupPath;
}

export function restoreFromBackup(backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const db = getDb();
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = OFF;
  `);

  fs.copyFileSync(backupPath, databasePath);
  runMigrations();
}

if (require.main === module) {
  console.log("Running migrations...");
  const result = runMigrations();
  console.log(`Applied: ${result.applied}, Failed: ${result.failed.length}`);
  if (result.failed.length > 0) {
    console.error("Failures:", result.failed);
  }
  console.log(`Schema version: ${getSchemaVersion()}`);
}