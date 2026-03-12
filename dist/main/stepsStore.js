"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSteps = listSteps;
exports.saveSteps = saveSteps;
exports.ensureStepsSeeded = ensureStepsSeeded;
exports.findStepById = findStepById;
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const tools_1 = require("../shared/tools");
const FILE_NAME = "steps.json";
function getStepsPath() {
    return node_path_1.default.join(electron_1.app.getPath("userData"), FILE_NAME);
}
function normalizeSteps(steps) {
    return {
        input: steps.input ?? [],
        transform: steps.transform ?? [],
        output: steps.output ?? []
    };
}
function readSteps() {
    const filePath = getStepsPath();
    if (!node_fs_1.default.existsSync(filePath)) {
        return normalizeSteps(tools_1.starterSteps);
    }
    const raw = node_fs_1.default.readFileSync(filePath, "utf-8");
    try {
        const data = JSON.parse(raw);
        return normalizeSteps(data);
    }
    catch {
        return normalizeSteps(tools_1.starterSteps);
    }
}
function writeSteps(steps) {
    const filePath = getStepsPath();
    node_fs_1.default.writeFileSync(filePath, JSON.stringify(steps, null, 2));
}
function listSteps() {
    return readSteps();
}
function saveSteps(steps) {
    writeSteps(steps);
    return readSteps();
}
function ensureStepsSeeded() {
    const filePath = getStepsPath();
    if (!node_fs_1.default.existsSync(filePath)) {
        writeSteps(tools_1.starterSteps);
    }
}
function findStepById(id) {
    const steps = readSteps();
    return (steps.input.find((step) => step.id === id) ??
        steps.transform.find((step) => step.id === id) ??
        steps.output.find((step) => step.id === id) ??
        null);
}
