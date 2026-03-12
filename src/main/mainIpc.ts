import { IpcMain, BrowserWindow } from "electron";
import { Pipeline, PnifeContext, ProviderConfig } from "../shared/types";
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
  stepId?: string;
  stepName?: string;
  stepStatus?: "started" | "completed" | "errored";
  output?: string;
};

function emitActivity(win: BrowserWindow, event: ActivityEvent) {
  win.webContents.send("pnife:activity:event", event);
}

function now() {
  return Date.now();
}

function normalizeBaseUrl(baseUrl: string | undefined, fallback: string) {
  const value = (baseUrl ?? fallback).replace(/\/+$/, "");
  return value;
}

function ensureV1(baseUrl: string) {
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function ensureApiV1(baseUrl: string) {
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

type LmStudioInputFormat = "string" | "array";

function buildProviderRequest(
  provider: ProviderConfig,
  model: string,
  prompt: string,
  input: string,
  lmStudioInputFormat: LmStudioInputFormat = "string"
) {
  const isLmStudio = provider.vendor === "lmstudio";
  const baseUrl =
    provider.vendor === "openai"
      ? normalizeBaseUrl(provider.baseUrl, "https://api.openai.com/v1")
      : isLmStudio
      ? ensureApiV1(normalizeBaseUrl(provider.baseUrl, "http://localhost:1234/api/v1"))
      : ensureV1(normalizeBaseUrl(provider.baseUrl, "http://localhost:11434"));

  const url = isLmStudio ? `${baseUrl}/chat` : `${baseUrl}/chat/completions`;
  const body = isLmStudio
    ? {
        model,
        system_prompt: prompt,
        input:
          lmStudioInputFormat === "array"
            ? [{ type: "text", content: input }]
            : input,
      }
    : {
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: input }
        ],
        temperature: 0.3
      };

  return { url, body, baseUrl, isLmStudio };
}

async function executeProviderRequest(
  provider: ProviderConfig,
  model: string,
  prompt: string,
  input: string
) {
  if (!model || model.trim().length === 0) {
    throw new Error("No model configured for provider");
  }

  const apiKey = provider.apiKey ?? "";
  const sanitizedApiKey = apiKey.trim();
  if (sanitizedApiKey && /[^\x20-\x7E]/.test(sanitizedApiKey)) {
    throw new Error("API key contains non-ASCII characters. Re-enter the key.");
  }

  const formats: LmStudioInputFormat[] =
    provider.vendor === "lmstudio" ? ["string", "array"] : ["string"];
  let lastError: Error | null = null;

  for (const format of formats) {
    const { url, body, baseUrl, isLmStudio } = buildProviderRequest(
      provider,
      model,
      prompt,
      input,
      format
    );

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sanitizedApiKey ? { Authorization: `Bearer ${sanitizedApiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const isLocal = provider.vendor === "ollama" || provider.vendor === "lmstudio";
      const detail = error instanceof Error ? error.message : String(error);
      const message = isLocal
        ? `Connection failed to ${baseUrl} (${provider.name}). Is the local server running?`
        : `Request failed: ${detail}`;
      throw new Error(message);
    }

    if (!response.ok) {
      const text = await response.text();
      const lower = text.toLowerCase();
      const shouldRetry =
        provider.vendor === "lmstudio" &&
        (lower.includes("invalid discriminator") ||
          lower.includes("expected string") ||
          lower.includes("invalid_union"));
      lastError = new Error(`Provider error (${response.status}): ${text}`);
      if (shouldRetry && format === "string") {
        continue;
      }
      if (shouldRetry && format === "array") {
        continue;
      }
      throw lastError;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
      output?: string | { type?: string; content?: unknown }[];
      message?: string;
    };
    let output = "";
    if (isLmStudio) {
      if (Array.isArray(json?.output)) {
        const messageItem = json.output.find((item) => item?.type === "message");
        if (messageItem && typeof messageItem.content === "string") {
          output = messageItem.content;
        } else if (messageItem && messageItem.content !== undefined) {
          output = String(messageItem.content);
        }
      } else if (typeof json?.output === "string") {
        output = json.output;
      } else if (typeof json?.message === "string") {
        output = json.message;
      } else {
        output = json?.choices?.[0]?.message?.content ?? "";
      }
    } else {
      output = json?.choices?.[0]?.message?.content ?? "";
    }
    if (!output) {
      const errorMessage = json?.error?.message ?? "Provider returned no choices.";
      throw new Error(errorMessage);
    }

    return output;
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Provider request failed.");
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
  const { baseUrl } = buildProviderRequest(provider, model, prompt, context.text);

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

  return {
    ...context,
    text: await executeProviderRequest(provider, model, prompt, context.text)
  };
}

export function createMainIpc({ ipcMain, win }: MainIpcDeps) {
  ipcMain.handle("pnife:providers:list", async () => listProviders());
  ipcMain.handle("pnife:providers:upsert", async (_event, provider) => upsertProvider(provider));
  ipcMain.handle("pnife:providers:delete", async (_event, id) => deleteProvider(id));
  ipcMain.handle("pnife:providers:setDefault", async (_event, id) => setDefaultProvider(id));
  ipcMain.handle("pnife:providers:test", async (_event, id) => {
    const provider = await getProviderSecret(id);
    if (!provider) {
      return { ok: false, error: "Provider not found." };
    }
    try {
      const output = await executeProviderRequest(
        provider,
        provider.model,
        "Reply with the single word pong.",
        "ping"
      );
      return { ok: true, output };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  });
  ipcMain.handle("pnife:tools:list", () => listTools());
  ipcMain.handle("pnife:tools:save", (_event, tools) => saveTools(tools));

  ipcMain.handle("pnife:pipeline:run", async (_event, pipeline: Pipeline, context: PnifeContext) => {
    const runId = `run_${now()}`;
    const startedAt = now();

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

      emitActivity(win, {
        id: `evt_${now()}`,
        type: "info",
        message: `Step started: ${step.name}`,
        timestamp: now(),
        runId,
        stepId: step.id,
        stepName: step.name,
        stepStatus: "started"
      });

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
            runId,
            stepId: step.id,
            stepName: step.name
          });
          updated = await runAiTextGen(win, config, updated, runId);
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "info",
            message: `Done: ${step.name}`,
            timestamp: now(),
            runId,
            stepId: step.id,
            stepName: step.name,
            stepStatus: "completed",
            output: updated.text
          });
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "stream",
            message: updated.text,
            timestamp: now(),
            runId,
            stepId: step.id,
            stepName: step.name,
            output: updated.text
          });
          if (!updated.text) {
            emitActivity(win, {
              id: `evt_${now()}`,
              type: "error",
              message: "Provider returned empty output.",
              timestamp: now(),
              runId,
              stepId: step.id,
              stepName: step.name,
              stepStatus: "errored"
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Provider error.";
          emitActivity(win, {
            id: `evt_${now()}`,
            type: "error",
            message,
            timestamp: now(),
            runId,
            stepId: step.id,
            stepName: step.name,
            stepStatus: "errored"
          });
          throw error;
        }
      } else {
        emitActivity(win, {
          id: `evt_${now()}`,
          type: "info",
          message: `Done: ${step.name}`,
          timestamp: now(),
          runId,
          stepId: step.id,
          stepName: step.name,
          stepStatus: "completed",
          output: updated.text
        });
      }
    }

    emitActivity(win, {
      id: `evt_${now()}`,
      type: "info",
      message: `Pipeline complete | ${formatElapsed(now() - startedAt)}`,
      timestamp: now(),
      runId
    });

    return { runId, context: updated };
  });
}

function formatElapsed(ms: number) {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  return `${(ms / 1000).toFixed(1)} s`;
}
