import { useEffect, useMemo, useState } from "react";
import styles from "./App.module.css";
import { ToolDefinition } from "../shared/tools";
import { ProviderConfig, ProviderKind } from "../shared/types";

export default function App() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [inputText, setInputText] = useState(
    "This is a test paragraph about Pnife. It should be summarized into a shorter, clearer sentence without losing the core meaning or tone."
  );
  const [lastOutput, setLastOutput] = useState("");
  const [activity, setActivity] = useState<{ id: string; message: string }[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: "",
    vendor: "openai",
    kind: "cloud" as ProviderKind,
    apiKey: "",
    baseUrl: "",
    model: "",
    enabled: true
  });

  useEffect(() => {
    if (!window.pnife?.tools) {
      return;
    }

    window.pnife.tools.list().then(setTools).catch(() => setTools([]));
  }, []);

  useEffect(() => {
    if (!window.pnife?.providers) {
      return;
    }

    window.pnife.providers.list().then(setProviders).catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!window.pnife?.activity) {
      return;
    }
    const unsubscribe = window.pnife.activity.onEvent((event) => {
      if (currentRunId && event.runId && event.runId !== currentRunId) {
        return;
      }
      if (!currentRunId && event.runId) {
        setCurrentRunId(event.runId);
      }
      const uniqueId = `${event.id}_${Math.random().toString(36).slice(2, 8)}`;
      setActivity((prev) => [{ id: uniqueId, message: event.message }, ...prev].slice(0, 12));
      if (event.type === "stream") {
        setLastOutput(event.message);
      }
    });
    return () => unsubscribe();
  }, [currentRunId]);

  const providerOptions = useMemo(
    () => [
      { value: "openai", label: "OpenAI", kind: "cloud" as ProviderKind },
      { value: "anthropic", label: "Anthropic", kind: "cloud" as ProviderKind },
      { value: "google", label: "Google", kind: "cloud" as ProviderKind },
      { value: "ollama", label: "Ollama", kind: "local" as ProviderKind },
      { value: "lmstudio", label: "LM Studio", kind: "local" as ProviderKind }
    ],
    []
  );

  function updateProviderForm(next: Partial<typeof providerForm>) {
    setProviderForm((prev) => ({ ...prev, ...next }));
  }

  async function refreshProviders() {
    const list = await window.pnife.providers.list();
    setProviders(list);
  }

  async function handleProviderSubmit(event: React.FormEvent) {
    event.preventDefault();
    const vendor = providerForm.vendor as ProviderConfig["vendor"];
    const option = providerOptions.find((item) => item.value === vendor);
    const kind = option?.kind ?? providerForm.kind;

    const id = editingProviderId ?? `provider_${vendor}_${Date.now()}`;
    const payload: ProviderConfig = {
      id,
      name: providerForm.name.trim() || option?.label || vendor,
      vendor,
      kind,
      enabled: providerForm.enabled,
      model: providerForm.model.trim(),
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (providerForm.apiKey.trim()) {
      payload.apiKey = providerForm.apiKey.trim();
    }
    if (providerForm.baseUrl.trim()) {
      payload.baseUrl = providerForm.baseUrl.trim();
    }
    if (!payload.model) {
      return;
    }

    await window.pnife.providers.upsert(payload);
    await refreshProviders();
    setProviderForm({
      name: "",
      vendor: "openai",
      kind: "cloud",
      apiKey: "",
      baseUrl: "",
      model: "",
      enabled: true
    });
    setEditingProviderId(null);
  }

  async function handleDeleteProvider(id: string) {
    await window.pnife.providers.delete(id);
    await refreshProviders();
  }

  async function handleSetDefaultProvider(id: string) {
    const updated = await window.pnife.providers.setDefault(id);
    setProviders(updated);
  }

  async function handleToggleEnabled(provider: ProviderConfig, enabled: boolean) {
    await window.pnife.providers.upsert({
      ...provider,
      enabled,
      isDefault: provider.isDefault
    });
    await refreshProviders();
  }

  function handleEditProvider(provider: ProviderConfig) {
    setEditingProviderId(provider.id);
    setProviderForm({
      name: provider.name,
      vendor: provider.vendor,
      kind: provider.kind,
      apiKey: "",
      baseUrl: provider.baseUrl ?? "",
      model: provider.model ?? "",
      enabled: provider.enabled
    });
  }

  async function handleRunTool(tool: ToolDefinition) {
    if (!providers.some((provider) => provider.enabled)) {
      setActivity((prev) => [
        { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, message: "Configure at least one enabled provider." },
        ...prev
      ]);
      return;
    }

    setActivity([]);
    setCurrentRunId(null);
    const context = {
      text: inputText,
      data: {},
      attachments: [],
      metadata: { timestamp: Date.now() }
    };
    try {
      const result = await window.pnife.pipeline.run(tool.pipeline, context);
      setLastOutput(result.context.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pipeline failed.";
      setActivity((prev) => [
        { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, message },
        ...prev
      ]);
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.title}>Pnife</div>
        <div className={styles.meta}>Alt+Space • Pipelines</div>
      </header>

      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}>Pipeline Stack</div>
          <div className={styles.panelBody}>
            {tools.length === 0 ? (
              <div className={styles.muted}>No tools loaded.</div>
            ) : (
              tools.map((tool) => (
                <div key={tool.id} className={styles.cardRow}>
                  <div>
                    <div className={styles.cardTitle}>{tool.name}</div>
                    <div className={styles.cardMeta}>{tool.pipeline.length} steps</div>
                  </div>
                  <button className={styles.ghostButton} onClick={() => handleRunTool(tool)}>
                    Run
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>Test Bench</div>
          <div className={styles.panelBody}>
            <textarea
              className={styles.textarea}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
            />
            <div className={styles.output}>
              {lastOutput ? lastOutput : "Run a tool to see output."}
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelTitle}>Activity Feed</div>
          <div className={styles.panelBody}>
            {activity.length === 0 ? (
              <div className={styles.muted}>No activity yet.</div>
            ) : (
              activity.map((event) => (
                <div key={event.id} className={styles.activityItem}>
                  {event.message}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <section className={styles.panelWide}>
        <div className={styles.panelTitle}>LLM Providers</div>
        <div className={styles.panelBody}>
          <form className={styles.form} onSubmit={handleProviderSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                className={styles.input}
                value={providerForm.name}
                onChange={(event) => updateProviderForm({ name: event.target.value })}
                placeholder="Provider name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Vendor</label>
              <select
                className={styles.input}
                value={providerForm.vendor}
                onChange={(event) => {
                  const vendor = event.target.value;
                  const option = providerOptions.find((item) => item.value === vendor);
                  updateProviderForm({ vendor, kind: option?.kind ?? providerForm.kind });
                }}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>API Key</label>
              <input
                className={styles.input}
                value={providerForm.apiKey}
                onChange={(event) => updateProviderForm({ apiKey: event.target.value })}
                placeholder="Optional for local providers"
                type="password"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Base URL</label>
              <input
                className={styles.input}
                value={providerForm.baseUrl}
                onChange={(event) => updateProviderForm({ baseUrl: event.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Model</label>
              <input
                className={styles.input}
                value={providerForm.model}
                onChange={(event) => updateProviderForm({ model: event.target.value })}
                placeholder="gpt-4o-mini / llama3.1"
                required
              />
            </div>
            <button className={styles.button} type="submit">
              {editingProviderId ? "Update Provider" : "Save Provider"}
            </button>
            {editingProviderId && (
              <button
                className={styles.ghostButton}
                type="button"
                onClick={() => {
                  setEditingProviderId(null);
                  setProviderForm({
                    name: "",
                    vendor: "openai",
                    kind: "cloud",
                    apiKey: "",
                    baseUrl: "",
                    model: "",
                    enabled: true
                  });
                }}
              >
                Cancel
              </button>
            )}
          </form>

          <div className={styles.list}>
            {!providers.some((provider) => provider.enabled) && (
              <div className={styles.banner}>Configure at least one enabled provider to run tools.</div>
            )}
            {providers.length === 0 ? (
              <div className={styles.muted}>No providers configured.</div>
            ) : (
              providers.map((provider) => (
                <div key={provider.id} className={styles.row}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="defaultProvider"
                      checked={provider.isDefault}
                      onChange={() => handleSetDefaultProvider(provider.id)}
                    />
                    <span className={styles.radioText}>Default</span>
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={(event) => handleToggleEnabled(provider, event.target.checked)}
                    />
                    <span className={styles.radioText}>Enabled</span>
                  </label>
                  <div className={styles.rowMain}>
                    <div className={styles.rowTitle}>{provider.name}</div>
                    <div className={styles.rowMeta}>
                      {provider.vendor} • {provider.kind} • {provider.model}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.ghostButton}
                      type="button"
                      onClick={() => handleEditProvider(provider)}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.ghostButton}
                      type="button"
                      onClick={() => handleDeleteProvider(provider.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
