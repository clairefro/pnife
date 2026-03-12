import { Pipeline, PnifeContext, ProviderConfig } from "../shared/types";
import { ToolDefinition } from "../shared/tools";

type ActivityEvent = {
  id: string;
  type: "info" | "error" | "stream";
  message: string;
  timestamp: number;
  runId?: string;
};

declare global {
  interface Window {
    pnife: {
      providers: {
        list: () => Promise<ProviderConfig[]>;
        upsert: (provider: ProviderConfig) => Promise<ProviderConfig>;
        delete: (id: string) => Promise<{ deleted: boolean }>;
        setDefault: (id: string) => Promise<ProviderConfig[]>;
      };
      tools: {
        list: () => Promise<ToolDefinition[]>;
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
