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

export type ProviderKind = "cloud" | "local" | "mock";

export type ProviderConfig = {
  id: string;
  name: string;
  kind: ProviderKind;
  vendor: "openai" | "anthropic" | "google" | "ollama" | "lmstudio" | "mock";
  apiKey?: string;
  baseUrl?: string;
  model: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
};
