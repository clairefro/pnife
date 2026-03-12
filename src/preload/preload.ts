import { contextBridge, ipcRenderer } from "electron";
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

contextBridge.exposeInMainWorld("pnife", {
  providers: {
    list: (): Promise<ProviderConfig[]> => ipcRenderer.invoke("pnife:providers:list"),
    upsert: (provider: ProviderConfig): Promise<ProviderConfig> =>
      ipcRenderer.invoke("pnife:providers:upsert", provider),
    delete: (id: string): Promise<{ deleted: boolean }> =>
      ipcRenderer.invoke("pnife:providers:delete", id),
    setDefault: (id: string): Promise<ProviderConfig[]> =>
      ipcRenderer.invoke("pnife:providers:setDefault", id),
    test: (
      id: string
    ): Promise<{ ok: boolean; output?: string; error?: string }> =>
      ipcRenderer.invoke("pnife:providers:test", id)
  },
  tools: {
    list: (): Promise<ToolDefinition[]> => ipcRenderer.invoke("pnife:tools:list"),
    save: (tools: ToolDefinition[]): Promise<ToolDefinition[]> =>
      ipcRenderer.invoke("pnife:tools:save", tools)
  },
  pipeline: {
    run: (pipeline: Pipeline, context: PnifeContext): Promise<{ runId: string; context: PnifeContext }> =>
      ipcRenderer.invoke("pnife:pipeline:run", pipeline, context)
  },
  activity: {
    onEvent: (callback: (event: ActivityEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, event: ActivityEvent) => callback(event);
      ipcRenderer.on("pnife:activity:event", listener);
      return () => ipcRenderer.removeListener("pnife:activity:event", listener);
    }
  }
});
