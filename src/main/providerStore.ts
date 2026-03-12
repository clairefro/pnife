import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import initSqlJs, { Database } from "sql.js";
import { ProviderConfig } from "../shared/types";

let dbPromise: Promise<Database> | null = null;
let sqlInitPromise: ReturnType<typeof initSqlJs> | null = null;

function getDbPath() {
  return path.join(app.getPath("userData"), "pnife.sqlite");
}

function requireEncryption() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Encryption unavailable: cannot store API keys securely.");
  }
}

function encryptApiKey(apiKey?: string) {
  if (!apiKey) {
    return null;
  }
  requireEncryption();
  return safeStorage.encryptString(apiKey).toString("base64");
}

function decryptApiKey(apiKeyEnc: string | null) {
  if (!apiKeyEnc) {
    return null;
  }
  requireEncryption();
  return safeStorage.decryptString(Buffer.from(apiKeyEnc, "base64"));
}

async function getSql() {
  if (!sqlInitPromise) {
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    sqlInitPromise = initSqlJs({ locateFile: () => wasmPath });
  }
  return sqlInitPromise;
}

async function getDb() {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = (async () => {
    const SQL = await getSql();
    const dbPath = getDbPath();
    let db: Database;
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath);
      db = new SQL.Database(data);
    } else {
      db = new SQL.Database();
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        vendor TEXT NOT NULL,
        apiKeyEnc TEXT,
        baseUrl TEXT,
        model TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        isDefault INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);
    return db;
  })();
  return dbPromise;
}

async function persistDb() {
  const db = await getDb();
  const data = db.export();
  fs.writeFileSync(getDbPath(), Buffer.from(data));
}

function rowToProvider(row: Record<string, unknown>): ProviderConfig {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as ProviderConfig["kind"],
    vendor: row.vendor as ProviderConfig["vendor"],
    baseUrl: row.baseUrl ? String(row.baseUrl) : undefined,
    model: String(row.model),
    enabled: Number(row.enabled) === 1,
    isDefault: Number(row.isDefault) === 1,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt)
  };
}

type SqlParam = string | number | null;

async function queryAll(sql: string, params: SqlParam[] = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function queryOne(sql: string, params: SqlParam[] = []) {
  const rows = await queryAll(sql, params);
  return rows[0] ?? null;
}

async function run(sql: string, params: SqlParam[] = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

export async function listProviders() {
  const rows = await queryAll(
    "SELECT id, name, kind, vendor, apiKeyEnc, baseUrl, model, enabled, isDefault, createdAt, updatedAt FROM providers ORDER BY createdAt DESC"
  );
  return rows.map(rowToProvider);
}

export async function upsertProvider(
  input: Omit<ProviderConfig, "createdAt" | "updatedAt" | "isDefault"> & {
    isDefault?: boolean;
    apiKey?: string;
  }
) {
  const timestamp = Date.now();
  const existing = await queryOne("SELECT * FROM providers WHERE id = ?", [input.id]);
  const shouldBeDefault = Boolean(input.isDefault);
  if (shouldBeDefault) {
    await run("UPDATE providers SET isDefault = 0 WHERE id != ?", [input.id]);
  }

  const apiKeyEnc =
    input.apiKey !== undefined ? encryptApiKey(input.apiKey) : (existing?.apiKeyEnc as string | null) ?? null;

  if (existing) {
    await run(
      `UPDATE providers
       SET name = ?, kind = ?, vendor = ?, apiKeyEnc = ?, baseUrl = ?, model = ?, enabled = ?, isDefault = ?, updatedAt = ?
       WHERE id = ?`,
      [
        input.name,
        input.kind,
        input.vendor,
        apiKeyEnc,
        input.baseUrl ?? null,
        input.model,
        input.enabled ? 1 : 0,
        shouldBeDefault ? 1 : Number(existing.isDefault),
        timestamp,
        input.id
      ]
    );
  } else {
    const hasDefault = await queryOne("SELECT COUNT(1) as count FROM providers WHERE isDefault = 1");
    const isDefault = shouldBeDefault || Number(hasDefault?.count ?? 0) === 0;
    if (isDefault) {
      await run("UPDATE providers SET isDefault = 0");
    }
    await run(
      `INSERT INTO providers (id, name, kind, vendor, apiKeyEnc, baseUrl, model, enabled, isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.name,
        input.kind,
        input.vendor,
        apiKeyEnc,
        input.baseUrl ?? null,
        input.model,
        input.enabled ? 1 : 0,
        isDefault ? 1 : 0,
        timestamp,
        timestamp
      ]
    );
  }

  await persistDb();
  const providers = await listProviders();
  return providers.find((item) => item.id === input.id) ?? null;
}

export async function deleteProvider(id: string) {
  const existing = await queryOne("SELECT * FROM providers WHERE id = ?", [id]);
  if (!existing) {
    return { deleted: false };
  }
  await run("DELETE FROM providers WHERE id = ?", [id]);

  if (Number(existing.isDefault) === 1) {
    const next = await queryOne(
      "SELECT id FROM providers WHERE enabled = 1 ORDER BY createdAt DESC LIMIT 1"
    );
    if (next?.id) {
      await run("UPDATE providers SET isDefault = 1 WHERE id = ?", [String(next.id)]);
    }
  }

  await persistDb();
  return { deleted: true };
}

export async function setDefaultProvider(id: string) {
  await run("UPDATE providers SET isDefault = 0");
  await run("UPDATE providers SET isDefault = 1, enabled = 1 WHERE id = ?", [id]);
  await persistDb();
  return listProviders();
}

export async function getProviderSecret(id: string) {
  const row = await queryOne("SELECT * FROM providers WHERE id = ?", [id]);
  if (!row) {
    return null;
  }
  const apiKey = decryptApiKey(row.apiKeyEnc as string | null);
  return {
    ...rowToProvider(row),
    apiKey: apiKey ?? undefined
  };
}
