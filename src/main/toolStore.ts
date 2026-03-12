import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ToolDefinition, starterTools } from "../shared/tools";
import { Step } from "../shared/types";

const FILE_NAME = "tools.json";

function getToolsPath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function isStepObject(value: unknown): value is Step {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "kind" in value
  );
}

function normalizeStep(step: Step): Step {
  const config = { ...(step.config ?? {}) } as Record<string, unknown>;
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

function normalizeTools(tools: ToolDefinition[]) {
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
      .filter((step): step is Step => Boolean(step));
    return { ...tool, pipeline };
  });

  return { tools: normalized, shouldReset };
}

function readTools(): ToolDefinition[] {
  const filePath = getToolsPath();
  if (!fs.existsSync(filePath)) {
    const seeded = normalizeTools([...starterTools]).tools;
    writeTools(seeded);
    return seeded;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as ToolDefinition[];
    if (!Array.isArray(data)) {
      const seeded = normalizeTools([...starterTools]).tools;
      writeTools(seeded);
      return seeded;
    }
    const normalized = normalizeTools(data);
    if (normalized.shouldReset) {
      const seeded = normalizeTools([...starterTools]).tools;
      writeTools(seeded);
      return seeded;
    }
    return normalized.tools;
  } catch {
    const seeded = normalizeTools([...starterTools]).tools;
    writeTools(seeded);
    return seeded;
  }
}

function writeTools(tools: ToolDefinition[]) {
  const filePath = getToolsPath();
  fs.writeFileSync(filePath, JSON.stringify(tools, null, 2));
}

export function listTools() {
  return readTools();
}

export function saveTools(tools: ToolDefinition[]) {
  writeTools(tools);
  return readTools();
}

export function ensureToolsSeeded() {
  const filePath = getToolsPath();
  if (!fs.existsSync(filePath)) {
    writeTools(normalizeTools(starterTools).tools);
  }
}
