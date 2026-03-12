# Pnife Architecture

## Project Overview

Pnife is a minimalist, professional desktop utility for modular AI workflows. Users compose multi-step Pipelines (Input → Transformation → Output) that execute in the Electron main process while the renderer manages UI state.

## Core Concepts

### Pipeline Contract

A Pipeline is an ordered array of Step objects. Each Step has a `kind`, `id`, `name`, `config`, and `enabled` flag.

```ts
export type PnifeContext = {
  text: string;
  data: any;
  attachments: any[];
};

export type StepKind = "input" | "transform" | "output";

export type Step = {
  id: string;
  name: string;
  kind: StepKind;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type Pipeline = Step[];
```

### Data Handshake

Every step receives and returns a `PnifeContext`:

- `text`: primary text payload
- `data`: structured payload for step-specific data
- `attachments`: array of file-like or binary artifacts

Steps are pure functions from `(context, stepConfig) -> context`, with side effects restricted to I/O steps in the main process.

### Input → Transformation → Output Flow

**Input (capture data):**

- clipboard-read (via `nut.js`)
- file-read
- ui-text

**Transformation (process data):**

- LLM via Vercel AI SDK Core (`ai`) using configured providers
- json-extraction
- regex-replace

**Output (deliver results):**

- clipboard-write
- system-notification
- ui-display

### Process Bridge

- **Main Process:** Executes AI and I/O logic, pipeline execution, provider access, and secure credential storage.
- **Renderer:** UI state, pipeline composition, configuration screens, and observability surfaces.
- **Preload:** Context bridge exposing whitelisted API endpoints to the renderer.

## Provider Management

Providers are configured once and referenced by ID in steps.

### Provider Types

- Cloud: OpenAI, Anthropic, Google (BYO API key)
- Local: Ollama, LM Studio (custom base URL)

### Storage

Credentials are stored securely using `electron-store` or encrypted `better-sqlite3`. The renderer never receives raw secrets; only provider metadata or masked data is shared.

### Provider Reference

Transformation steps store a `providerId` and `model` in `config`.

## Launcher & Shortcut Logic

- Leader key: `Alt+Space` toggles the centered launcher overlay.
- Namespace mode: While open, single-key triggers fire tools instantly (e.g., `S` for Summary).
- Search: Fuzzy-search palette across all tools/pipelines.

## Pipeline Composer & Monitoring

- **Editor UI:** Vertical Stack view to reorder and configure steps.
- **Test Bench:** Split-pane debugger for mock input and per-step output.
- **Observability:** Progress updates via `win.setProgressBar` and in-app Activity Feed.

## Execution Model

1. Renderer requests pipeline execution via preload bridge.
2. Main process validates pipeline, resolves providers, and executes steps sequentially.
3. Each step receives a `PnifeContext` and returns an updated `PnifeContext`.
4. Observability updates are emitted to renderer via IPC events.

## Security Boundaries

- Secrets are stored and accessed in the main process only.
- Renderer receives only masked values and provider metadata.
- IPC channels are allowlisted in preload.

## Future Extensions

- Pipeline export/import (JSON)
- Versioned pipeline runs and history
