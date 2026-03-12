import { Pipeline, PnifeContext, ProviderConfig } from "../shared/types";
import { ToolDefinition } from "../shared/tools";

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

declare global {
  interface Window {
    pnife: {
      providers: {
        list: () => Promise<ProviderConfig[]>;
        upsert: (provider: ProviderConfig) => Promise<ProviderConfig>;
        delete: (id: string) => Promise<{ deleted: boolean }>;
        setDefault: (id: string) => Promise<ProviderConfig[]>;
        test: (id: string) => Promise<{ ok: boolean; output?: string; error?: string }>;
      };
      tools: {
        list: () => Promise<ToolDefinition[]>;
        save: (tools: ToolDefinition[]) => Promise<ToolDefinition[]>;
      };
      pipeline: {
        run: (pipeline: Pipeline, context: PnifeContext) => Promise<{ runId: string; context: PnifeContext }>;
      };
      activity: {
        onEvent: (callback: (event: ActivityEvent) => void) => () => void;
      };
    };
  }
}

export {};
