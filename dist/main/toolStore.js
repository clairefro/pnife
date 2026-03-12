"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTools = listTools;
exports.saveTools = saveTools;
exports.ensureToolsSeeded = ensureToolsSeeded;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const tools_1 = require("../shared/tools");
const FILE_NAME = "tools.json";
function getToolsPath() {
    return node_path_1.default.join(electron_1.app.getPath("userData"), FILE_NAME);
}
function isStepObject(value) {
    return (typeof value === "object" &&
        value !== null &&
        "id" in value &&
        "name" in value &&
        "kind" in value);
}
function normalizeStep(step) {
    const config = { ...(step.config ?? {}) };
    if (config.providerId === "provider_mock") {
        delete config.providerId;
    }
    return {
        id: step.id,
        name: step.name,
        kind: step.kind,
        enabled: step.enabled ?? true,
        config
    };
}
function normalizeTools(tools) {
    let shouldReset = false;
    const normalized = tools.map((tool) => {
        const pipeline = tool.pipeline
            .map((step) => {
            if (!isStepObject(step)) {
                shouldReset = true;
                return null;
            }
            return normalizeStep(step);
        })
            .filter((step) => Boolean(step));
        return { ...tool, pipeline };
    });
    return { tools: normalized, shouldReset };
}
function readTools() {
    const filePath = getToolsPath();
    if (!node_fs_1.default.existsSync(filePath)) {
        const seeded = normalizeTools([...tools_1.starterTools]).tools;
        writeTools(seeded);
        return seeded;
    }
    const raw = node_fs_1.default.readFileSync(filePath, "utf-8");
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) {
            const seeded = normalizeTools([...tools_1.starterTools]).tools;
            writeTools(seeded);
            return seeded;
        }
        const normalized = normalizeTools(data);
        if (normalized.shouldReset) {
            const seeded = normalizeTools([...tools_1.starterTools]).tools;
            writeTools(seeded);
            return seeded;
        }
        return normalized.tools;
    }
    catch {
        const seeded = normalizeTools([...tools_1.starterTools]).tools;
        writeTools(seeded);
        return seeded;
    }
}
function writeTools(tools) {
    const filePath = getToolsPath();
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(tools, null, 2));
}
function listTools() {
    return readTools();
}
function saveTools(tools) {
    writeTools(tools);
    return readTools();
}
function ensureToolsSeeded() {
    const filePath = getToolsPath();
    if (!node_fs_1.default.existsSync(filePath)) {
        writeTools(normalizeTools(tools_1.starterTools).tools);
    }
}
