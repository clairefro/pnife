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
function normalizeTools(tools) {
    return tools.map((tool) => ({
        ...tool,
        pipeline: tool.pipeline.map((step) => {
            if (step.config && typeof step.config === "object") {
                const config = { ...step.config };
                if (config.providerId === "provider_mock") {
                    delete config.providerId;
                }
                return { ...step, config };
            }
            return step;
        })
    }));
}
function readTools() {
    const filePath = getToolsPath();
    if (!node_fs_1.default.existsSync(filePath)) {
        return normalizeTools([...tools_1.starterTools]);
    }
    const raw = node_fs_1.default.readFileSync(filePath, "utf-8");
    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? normalizeTools(data) : normalizeTools([...tools_1.starterTools]);
    }
    catch {
        return normalizeTools([...tools_1.starterTools]);
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
        writeTools(normalizeTools(tools_1.starterTools));
    }
}
