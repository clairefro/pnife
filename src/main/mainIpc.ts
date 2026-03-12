import { IpcMain, BrowserWindow } from "electron";
import { Pipeline, PnifeContext } from "../shared/types";
import { listTools, saveTools } from "./toolStore";
import { listProviders, upsertProvider, deleteProvider, getProviderSecret, setDefaultProvider } from "./providerStore";

type AiTextGenConfig = {
  type: "ai-text-gen";
  providerId?: string;
  prompt?: string;
  model?: string;
};

type MainIpcDeps = {
  ipcMain: IpcMain;
  win: BrowserWindow;
};

type ActivityEvent = {
  id: string;
  type: "info" | "error" | "stream";
  message: string;
  timestamp: number;
  runId?: string;
};

function emitActivity(win: BrowserWindow, event: ActivityEvent) {
  win.webContents.send("pnife:activity:event", event);
}

function now() {
  return Date.now();
}

function pickProviderId(pipeline: Pipeline, context: PnifeContext) {
  const providerFromStep = pipeline.find((step) => step.kind === "transform")?.config?.providerId;
  if (typeof providerFromStep === "string" && providerFromStep.length > 0) {
    return providerFromStep;
  }
  return context.data?.providerId ?? null;
}

function normalizeBaseUrl(baseUrl: string | undefined, fallback: string) {
  const value = (baseUrl ?? fallback).replace(/\/+$/, "");
  return value;
}

function ensureV1(baseUrl: string) {
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

async function resolveProviderId(config: AiTextGenConfig, context: PnifeContext) {
  const explicitId =
    config.providerId ?? (context.data.providerId as string | undefined) ?? null;
  if (explicitId) {
    return explicitId;
  }

  const providers = await listProviders();
  const defaultProvider = providers.find((item) => item.isDefault);
  if (!defaultProvider) {
    throw new Error("No default provider configured.");
  }
  if (!defaultProvider.enabled) {
    throw new Error("Default provider is disabled.");
  }
  return defaultProvider.id;
}

async function runAiTextGen(
  win: BrowserWindow,
  config: AiTextGenConfig,
  context: PnifeContext,
  runId: string
): Promise<PnifeContext> {
  const providerId = await resolveProviderId(config, context);
  if (!providerId) {
    throw new Error("No provider configured for ai-text-gen");
  }

  const provider = await getProviderSecret(providerId);
  if (!provider || !provider.enabled) {
    throw new Error("Provider not found or disabled");
  }

  const prompt = config.prompt ?? "Summarize the following text.";
  const model = config.model ?? provider.model;
  if (!model || model.trim().length === 0) {
    throw new Error("No model configured for provider");
  }

  const apiKey = provider.apiKey ?? "";
  const sanitizedApiKey = apiKey.trim();
  if (sanitizedApiKey && /[^\x20-\x7E]/.test(sanitizedApiKey)) {
    throw new Error("API key contains non-ASCII characters. Re-enter the key.");
  }
  const baseUrl =
    provider.vendor === "openai"
      ? normalizeBaseUrl(provider.baseUrl, "https://api.openai.com/v1")
      : ensureV1(normalizeBaseUrl(provider.baseUrl, "http://localhost:11434"));

  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: context.text }
    ],
    temperature: 0.3
  };

  emitActivity(win, {
    id: `evt_${now()}`,
    type: "info",
    message: `Requesting ${provider.name} / ${model}`,
    timestamp: now(),
    runId
  });

  emitActivity(win, {
    id: `evt_${now()}`,
    type: "info",
    message: "Processing...",
    timestamp: now(),
    runId
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sanitizedApiKey ? { Authorization: `Bearer ${sanitizedApiKey}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider error (${response.status}): ${text}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  const output = json?.choices?.[0]?.message?.content ?? "";
  if (!output) {
    const errorMessage = json?.error?.message ?? "Provider returned no choices.";
    throw new Error(errorMessage);
  }

  return {
    ...context,
    text: output
  };
}

export function createMainIpc({ ipcMain, win }: MainIpcDeps) {
  ipcMain.handle("pnife:providers:list", async () => listProviders());
  ipcMain.handle("pnife:providers:upsert", async (_event, provider) => upsertProvider(provider));
  ipcMain.handle("pnife:providers:delete", async (_event, id) => deleteProvider(id));
  ipcMain.handle("pnife:providers:setDefault", async (_event, id) => setDefaultProvider(id));
  ipcMain.handle("pnife:tools:list", () => listTools());
  ipcMain.handle("pnife:tools:save", (_event, tools) => saveTools(tools));

  ipcMain.handle("pnife:pipeline:run", async (_event, pipeline: Pipeline, context: PnifeContext) => {
    const runId = `run_${now()}`;

    const providers = await listProviders();
    const hasEnabledProvider = providers.some((item) => item.enabled);
    if (!hasEnabledProvider) {
      emitActivity(win, {
        id: `evt_${now()}`,
        type: "error",
        message: "No enabled provider configured.",
        timestamp: now(),
        runId
      });
      throw new Error("No enabled provider configured.");
    }
    emitActivity(win, {
      id: `evt_${now()}`,
      type: "info",
      message: `Pipeline started with ${pipeline.length} steps`,
      timestamp: now(),
      runId
    });

    let updated: PnifeContext = {
      ...context,
      metadata: {
        ...context.metadata,
        timestamp: now()
      }
    };

    for (const step of pipeline) {
      if (!step.enabled) {
        continue;
      }

      if (step.kind === "transform" && step.config?.type === "ai-text-gen") {
        const config = step.config as AiTextGenConfig;
        try {
          const providerId = await resolveProviderId(config, updated);
          const providerInfo = await getProviderSecret(providerId);
          const modelName = config.model ?? providerInfo?.model ?? "";
          const providerLabel = providerInfo ? `${providerInfo.name} • ${modelName}` : modelName;
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "info",
            message: `Processing: ${step.name}${providerLabel ? ` | ${providerLabel}` : ""}`,
            timestamp: now(),
            runId
          });
          updated = await runAiTextGen(win, config, updated, runId);
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "info",
            message: `Done: ${step.name}`,
            timestamp: now(),
            runId
          });
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "stream",
            message: updated.text,
            timestamp: now(),
            runId
          });
          if (!updated.text) {
            emitActivity(win, {
              id: `evt_${now()}`,
              type: "error",
              message: "Provider returned empty output.",
              timestamp: now(),
              runId
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Provider error.";
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "error",
            message,
            timestamp: now(),
            runId
          });
          throw error;
        }
      }
    }

    emitActivity(win, {
      id: `evt_${now()}`,
      type: "info",
      message: "Pipeline complete",
      timestamp: now(),
      runId
    });

    return { runId, context: updated };
  });
}
