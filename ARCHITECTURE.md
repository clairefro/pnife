# Pnife Architecture

## Project Overview
Pnife is a minimalist, professional desktop utility for modular AI workflows. Users compose multi-step Pipelines (Input → Transformation → Output) that execute in the Electron main process while the renderer manages UI state. The UI uses Vanilla CSS Modules and a flat, high-contrast dark aesthetic (solid backgrounds #0a0a0a, 1px borders #262626, no glassmorphism).

## Core Concepts

### Pipeline Contract
A Pipeline is an ordered array of Step objects. Each Step has a `kind`, `id`, `name`, `config`, and `enabled` flag.

```ts
export type PnifeAttachment = {
  id: string;
  mimeType: string; // e.g., "image/png", "application/pdf"
  data: Uint8Array; // Store binary data directly for efficiency
  name?: string;
  size: number;
};

export type PnifeContext = {
  text: string; // Primary text for prompts/summaries
  data: Record<string, any>; // Structured JSON results from steps
  attachments: PnifeAttachment[]; // Multimodal payload
  metadata: {
    timestamp: number;
    sourceApp?: string; // Captured from nut.js active window
  };
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
- `attachments`: binary-first multimodal payload
- `metadata`: timestamp and source app context

Steps are pure functions from `(context, stepConfig) -> context`, with side effects restricted to I/O steps in the main process.

### Input → Transformation → Output Flow

**Input (capture data):**
- clipboard-read (via `nut.js`)
- file-read
- ui-text

**Transformation (process data):**
- LLM via provider adapters using OpenAI-compatible endpoints
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
Provider metadata is stored in a **SQLite database** under app data. API keys are encrypted with `electron.safeStorage` and persisted as encrypted values in SQLite. The renderer never receives raw secrets; only provider metadata is shared.

### Provider Reference
Transformation steps store a `providerId` and `model` in `config`. If a step does not specify a provider, the **default provider** is used. If the default provider is disabled, execution must error.

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
3. Clipboard input uses a dedicated `ClipboardManager` utility:
   - Snapshot current clipboard (text + image + formats) before issuing `Cmd+C` via `nut.js`.
   - Capture selected text from the clipboard.
   - Immediately restore the original snapshot to prevent data loss.
4. Each step receives a `PnifeContext` and returns an updated `PnifeContext`.
5. Streaming events are emitted during LLM generation so the Activity Feed can show partial text updates.
6. Observability updates are emitted to renderer via IPC events.

## Transformation Updates
- `ai-text-gen` steps must check `attachments` for images and pass them to Vision-capable models when supported by the provider.
- JSON extraction and regex steps operate on `context.text` and may populate `context.data`.

## Security Boundaries
- Secrets are stored and accessed in the main process only.
- `PnifeAttachment` binary data remains in the main process.
- Renderer receives only safe previews (Object URLs or Base64 thumbnails) and provider metadata.
- IPC channels are allowlisted in preload.

## Future Extensions
- Pipeline export/import (JSON)
- Step marketplace
- Versioned pipeline runs and history
