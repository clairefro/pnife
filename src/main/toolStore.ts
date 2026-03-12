import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ToolDefinition } from "../shared/tools";
import { starterTools } from "../shared/tools";

const FILE_NAME = "tools.json";

function getToolsPath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function normalizeTools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    ...tool,
    pipeline: tool.pipeline.map((step) => {
      if (step.config && typeof step.config === "object") {
        const config = { ...step.config } as Record<string, unknown>;
        if (config.providerId === "provider_mock") {
          delete config.providerId;
        }
        return { ...step, config };
      }
      return step;
    })
  }));
}

function readTools(): ToolDefinition[] {
  const filePath = getToolsPath();
  if (!fs.existsSync(filePath)) {
    return normalizeTools([...starterTools]);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as ToolDefinition[];
    return Array.isArray(data) ? normalizeTools(data) : normalizeTools([...starterTools]);
  } catch {
    return normalizeTools([...starterTools]);
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
    writeTools(normalizeTools(starterTools));
  }
}
