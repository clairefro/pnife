"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProviders = listProviders;
exports.upsertProvider = upsertProvider;
exports.deleteProvider = deleteProvider;
exports.setDefaultProvider = setDefaultProvider;
exports.getProviderSecret = getProviderSecret;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const sql_js_1 = __importDefault(require("sql.js"));
let dbPromise = null;
let sqlInitPromise = null;
function getDbPath() {
    return node_path_1.default.join(electron_1.app.getPath("userData"), "pnife.sqlite");
}
function requireEncryption() {
    if (!electron_1.safeStorage.isEncryptionAvailable()) {
        throw new Error("Encryption unavailable: cannot store API keys securely.");
    }
}
function encryptApiKey(apiKey) {
    if (!apiKey) {
        return null;
    }
    requireEncryption();
    return electron_1.safeStorage.encryptString(apiKey).toString("base64");
}
function decryptApiKey(apiKeyEnc) {
    if (!apiKeyEnc) {
        return null;
    }
    requireEncryption();
    return electron_1.safeStorage.decryptString(Buffer.from(apiKeyEnc, "base64"));
}
async function getSql() {
    if (!sqlInitPromise) {
        const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
        sqlInitPromise = (0, sql_js_1.default)({ locateFile: () => wasmPath });
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
        let db;
        if (node_fs_1.default.existsSync(dbPath)) {
            const data = node_fs_1.default.readFileSync(dbPath);
            db = new SQL.Database(data);
        }
        else {
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
    node_fs_1.default.writeFileSync(getDbPath(), Buffer.from(data));
}
function rowToProvider(row) {
    return {
        id: String(row.id),
        name: String(row.name),
        kind: row.kind,
        vendor: row.vendor,
        baseUrl: row.baseUrl ? String(row.baseUrl) : undefined,
        model: String(row.model),
        enabled: Number(row.enabled) === 1,
        isDefault: Number(row.isDefault) === 1,
        createdAt: Number(row.createdAt),
        updatedAt: Number(row.updatedAt)
    };
}
async function queryAll(sql, params = []) {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}
async function queryOne(sql, params = []) {
    const rows = await queryAll(sql, params);
    return rows[0] ?? null;
}
async function run(sql, params = []) {
    const db = await getDb();
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
}
async function listProviders() {
    const rows = await queryAll("SELECT id, name, kind, vendor, apiKeyEnc, baseUrl, model, enabled, isDefault, createdAt, updatedAt FROM providers ORDER BY createdAt DESC");
    return rows.map(rowToProvider);
}
async function upsertProvider(input) {
    const timestamp = Date.now();
    const existing = await queryOne("SELECT * FROM providers WHERE id = ?", [input.id]);
    const shouldBeDefault = Boolean(input.isDefault);
    if (shouldBeDefault) {
        await run("UPDATE providers SET isDefault = 0 WHERE id != ?", [input.id]);
    }
    const apiKeyEnc = input.apiKey !== undefined ? encryptApiKey(input.apiKey) : existing?.apiKeyEnc ?? null;
    if (existing) {
        await run(`UPDATE providers
       SET name = ?, kind = ?, vendor = ?, apiKeyEnc = ?, baseUrl = ?, model = ?, enabled = ?, isDefault = ?, updatedAt = ?
       WHERE id = ?`, [
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
        ]);
    }
    else {
        const hasDefault = await queryOne("SELECT COUNT(1) as count FROM providers WHERE isDefault = 1");
        const isDefault = shouldBeDefault || Number(hasDefault?.count ?? 0) === 0;
        if (isDefault) {
            await run("UPDATE providers SET isDefault = 0");
        }
        await run(`INSERT INTO providers (id, name, kind, vendor, apiKeyEnc, baseUrl, model, enabled, isDefault, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
        ]);
    }
    await persistDb();
    const providers = await listProviders();
    return providers.find((item) => item.id === input.id) ?? null;
}
async function deleteProvider(id) {
    const existing = await queryOne("SELECT * FROM providers WHERE id = ?", [id]);
    if (!existing) {
        return { deleted: false };
    }
    await run("DELETE FROM providers WHERE id = ?", [id]);
    if (Number(existing.isDefault) === 1) {
        const next = await queryOne("SELECT id FROM providers WHERE enabled = 1 ORDER BY createdAt DESC LIMIT 1");
        if (next?.id) {
            await run("UPDATE providers SET isDefault = 1 WHERE id = ?", [String(next.id)]);
        }
    }
    await persistDb();
    return { deleted: true };
}
async function setDefaultProvider(id) {
    await run("UPDATE providers SET isDefault = 0");
    await run("UPDATE providers SET isDefault = 1, enabled = 1 WHERE id = ?", [id]);
    await persistDb();
    return listProviders();
}
async function getProviderSecret(id) {
    const row = await queryOne("SELECT * FROM providers WHERE id = ?", [id]);
    if (!row) {
        return null;
    }
    const apiKey = decryptApiKey(row.apiKeyEnc);
    return {
        ...rowToProvider(row),
        apiKey: apiKey ?? undefined
    };
}
