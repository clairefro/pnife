import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import { ToolDefinition } from "../shared/tools";
import { ProviderConfig, ProviderKind, Step } from "../shared/types";

export default function App() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [stepPromptDrafts, setStepPromptDrafts] = useState<Record<string, string>>({});
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"run" | "tools" | "settings">("tools");
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [inputText, setInputText] = useState(
    "This is a test paragraph about Pnife. It should be summarized into a shorter, clearer sentence without losing the core meaning or tone."
  );
  const [lastOutput, setLastOutput] = useState("");
  const [activity, setActivity] = useState<{ id: string; message: string; type: string }[]>([]);
  const activityEndRef = useRef<HTMLDivElement | null>(null);
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
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [showAddStepMenu, setShowAddStepMenu] = useState(false);
  const [pendingDeleteStep, setPendingDeleteStep] = useState<Step | null>(null);

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
      if (event.runId && event.runId !== currentRunId) {
        setActivity([]);
        setCurrentRunId(event.runId);
      }
      const uniqueId = `${event.id}_${Math.random().toString(36).slice(2, 8)}`;
      setActivity((prev) => [...prev, { id: uniqueId, message: event.message, type: event.type }].slice(-50));
      if (event.type === "stream") {
        setLastOutput(event.message);
      }
    });
    return () => unsubscribe();
  }, [currentRunId]);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activity]);

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

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? null,
    [tools, selectedToolId]
  );

  const defaultProvider = useMemo(
    () => providers.find((provider) => provider.isDefault),
    [providers]
  );

  function updateProviderForm(next: Partial<typeof providerForm>) {
    setProviderForm((prev) => ({ ...prev, ...next }));
  }

  async function persistTools(nextTools: ToolDefinition[]) {
    setTools(nextTools);
    if (!window.pnife?.tools) {
      return;
    }
    const saved = await window.pnife.tools.save(nextTools);
    setTools(saved);
  }

  function updateToolStep(
    toolId: string,
    stepId: string,
    updater: (step: Step) => Step
  ): ToolDefinition[] {
    return tools.map((tool) => {
      if (tool.id !== toolId) {
        return tool;
      }
      return {
        ...tool,
        pipeline: tool.pipeline.map((step) =>
          step.id === stepId ? updater(step) : step
        )
      };
    });
  }

  async function handleToggleStepEnabled(toolId: string, stepId: string, enabled: boolean) {
    const nextTools = updateToolStep(toolId, stepId, (step) => ({ ...step, enabled }));
    await persistTools(nextTools);
  }

  async function handleSaveStepPrompt(toolId: string, step: Step, prompt: string) {
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      config: { ...item.config, prompt }
    }));
    await persistTools(nextTools);
  }

  async function handleSaveStepName(toolId: string, step: Step, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const nextTools = updateToolStep(toolId, step.id, (item) => ({ ...item, name: trimmed }));
    await persistTools(nextTools);
  }

  async function handleSaveStepConfigType(toolId: string, step: Step, typeValue: string) {
    const trimmed = typeValue.trim();
    if (!trimmed) {
      return;
    }
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      config: { ...item.config, type: trimmed }
    }));
    await persistTools(nextTools);
  }

  async function handleSaveStepMode(toolId: string, step: Step, mode: string) {
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      config: { ...item.config, mode }
    }));
    await persistTools(nextTools);
  }

  function handleToggleStepEdit(step: Step) {
    setExpandedStepId((prev) => (prev === step.id ? null : step.id));
    const currentPrompt =
      typeof step.config?.prompt === "string" ? step.config.prompt : undefined;
    if (currentPrompt !== undefined) {
      setStepPromptDrafts((prev) =>
        prev[step.id] === undefined ? { ...prev, [step.id]: currentPrompt } : prev
      );
    }
  }

  function createStepDefaults(kind: "transform" | "output"): Step {
    const id = `step_${kind}_${Date.now()}`;
    if (kind === "transform") {
      return {
        id,
        name: "New Transform",
        kind,
        enabled: true,
        config: { type: "ai-text-gen", prompt: "" }
      };
    }
    return {
      id,
      name: "New Output",
      kind,
      enabled: true,
      config: { type: "custom-output" }
    };
  }

  async function handleAddTool() {
    const id = `tool_${Date.now()}`;
    const nextTool: ToolDefinition = {
      id,
      name: "Untitled Tool",
      description: "",
      pipeline: []
    };
    const nextTools = [...tools, nextTool];
    await persistTools(nextTools);
    setSelectedToolId(id);
  }

  async function handleAddStep(kind: "transform" | "output") {
    if (!selectedTool) {
      return;
    }
    const nextStep = createStepDefaults(kind);
    const nextTools = tools.map((tool) => {
      if (tool.id !== selectedTool.id) {
        return tool;
      }
      return { ...tool, pipeline: [...tool.pipeline, nextStep] };
    });
    await persistTools(nextTools);
  }

  async function handleDeleteStep(step: Step) {
    if (!selectedTool) {
      return;
    }
    const nextTools = tools.map((tool) =>
      tool.id === selectedTool.id
        ? { ...tool, pipeline: tool.pipeline.filter((item) => item.id !== step.id) }
        : tool
    );
    await persistTools(nextTools);
    setExpandedStepId((prev) => (prev === step.id ? null : prev));
  }

  async function handleReorderStep(tool: ToolDefinition, fromId: string, toId: string) {
    if (fromId === toId) {
      return;
    }
    const nextPipeline = [...tool.pipeline];
    const fromIndex = nextPipeline.findIndex((step) => step.id === fromId);
    const toIndex = nextPipeline.findIndex((step) => step.id === toId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const [moved] = nextPipeline.splice(fromIndex, 1);
    nextPipeline.splice(toIndex, 0, moved);
    const nextTools = tools.map((item) =>
      item.id === tool.id ? { ...item, pipeline: nextPipeline } : item
    );
    await persistTools(nextTools);
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
    setLastOutput("");
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
        { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, message, type: "error" },
        ...prev
      ]);
    }
  }

  function formatOutput(message: string) {
    const trimmed = message.trim();
    if (trimmed.length <= 200) {
      return trimmed;
    }
    return `${trimmed.slice(0, 200)}...`;
  }

  function splitProcessingMessage(message: string) {
    const parts = message.split(" | ");
    return {
      main: parts[0] ?? message,
      meta: parts.length > 1 ? parts.slice(1).join(" | ") : ""
    };
  }

  function splitCompletionMessage(message: string) {
    const parts = message.split(" | ");
    return {
      main: parts[0] ?? message,
      meta: parts.length > 1 ? parts.slice(1).join(" | ") : ""
    };
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.title}>Pnife</div>
        <div className={styles.meta}>Alt+Space • Pipelines</div>
        <div className={styles.tabs}>
          <button
            className={activeTab === "run" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("run")}
          >
            Run
          </button>
          <button
            className={activeTab === "tools" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("tools")}
          >
            Tools
          </button>
          <button
            className={activeTab === "settings" ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </div>
      </header>

      {activeTab === "run" && (
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
                      <div className={styles.cardMeta}>
                        {tool.pipeline.length} steps
                      </div>
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
                  <span
                    className={
                      event.type === "error"
                        ? styles.activityError
                        : event.type === "stream"
                        ? styles.activityOutput
                        : styles.activityInfo
                    }
                  >
                    {event.type === "error"
                      ? "[ERROR]"
                      : event.type === "stream"
                      ? "[OUTPUT]"
                      : "[INFO]"}
                  </span>{" "}
                  <span className={styles.activityText}>
                    {event.type === "stream"
                      ? `Output: ${formatOutput(event.message)}`
                      : event.message.startsWith("Processing:")
                      ? (() => {
                          const { main, meta } = splitProcessingMessage(event.message);
                          return (
                            <>
                              {main}
                              {meta ? <span className={styles.activityMeta}> {meta}</span> : null}
                            </>
                          );
                        })()
                      : event.message.startsWith("Pipeline complete")
                      ? (() => {
                          const { main, meta } = splitCompletionMessage(event.message);
                          return (
                            <>
                              {main}
                              {meta ? <span className={styles.activityMeta}> {meta}</span> : null}
                            </>
                          );
                        })()
                      : event.message}
                    {event.message.startsWith("Processing:") && (
                      <span className={styles.loadingDots}>...</span>
                    )}
                  </span>
                  </div>
                ))
              )}
              <div ref={activityEndRef} />
            </div>
          </section>
        </main>
      )}

      {activeTab === "tools" && (
        <section className={styles.panelWide}>
          <div className={styles.panelTitle}>Tools</div>
          <div className={styles.panelBody}>
            {tools.length === 0 ? (
              <div className={styles.muted}>No tools loaded.</div>
            ) : (
              <div className={styles.toolsLayout}>
                <div className={styles.toolsList}>
                  <div className={styles.toolsListHeader}>
                    <div className={styles.rowTitle}>Tools</div>
                    <button className={styles.ghostButton} type="button" onClick={handleAddTool}>
                      Add Tool
                    </button>
                  </div>
                  {tools.map((tool) => (
                    <button
                      key={tool.id}
                      className={
                        selectedToolId === tool.id ? styles.toolRowActive : styles.toolRow
                      }
                      onClick={() => setSelectedToolId(tool.id)}
                    >
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>{tool.name}</div>
                        <div className={styles.rowMeta}>
                          {tool.pipeline.length} steps • {tool.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className={styles.stepsPanel}>
                  <div className={styles.panelTitleAlt}>Steps</div>
                  <div className={styles.panelBody}>
                    <div className={styles.stepsActions}>
                      <div className={styles.dropdown}>
                        <button
                          className={styles.ghostButton}
                          type="button"
                          onClick={() => setShowAddStepMenu((prev) => !prev)}
                          disabled={!selectedTool}
                        >
                          Add Step ▾
                        </button>
                        {showAddStepMenu && selectedTool && (
                          <div className={styles.dropdownMenu}>
                            <button
                              className={styles.dropdownItem}
                              type="button"
                              onClick={() => {
                                handleAddStep("transform");
                                setShowAddStepMenu(false);
                              }}
                            >
                              Transform
                            </button>
                            <button
                              className={styles.dropdownItem}
                              type="button"
                              onClick={() => {
                                handleAddStep("output");
                                setShowAddStepMenu(false);
                              }}
                            >
                              Output
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedTool ? (
                      (() => {
                        const orderedSteps = selectedTool.pipeline;

                        return (
                          <>
                            <div className={styles.stepCardStatic}>
                              <div className={styles.stepHeaderStatic}>
                                <span className={styles.stepInput}>INPUT</span>
                                <span className={styles.stepName}>
                                  Input
                                </span>
                              </div>
                            </div>

                            {orderedSteps.length === 0 ? (
                              <div className={styles.muted}>No steps in this tool.</div>
                            ) : (
                              orderedSteps.map((step) => {
                                const isExpanded = expandedStepId === step.id;
                                const currentPrompt =
                                  typeof step.config?.prompt === "string"
                                    ? step.config.prompt
                                    : "";
                                const promptValue = stepPromptDrafts[step.id] ?? currentPrompt;
                                const hasPrompt =
                                  step.kind === "transform" ||
                                  typeof step.config?.prompt === "string";
                                const typeValue =
                                  typeof step.config?.type === "string" ? step.config.type : "";
                                const modeValue =
                                  typeof step.config?.mode === "string"
                                    ? step.config.mode
                                    : "prompt";
                                return (
                                  <div
                                    key={step.id}
                                    className={`${styles.stepCard} ${
                                      step.enabled ? "" : styles.stepCardDisabled
                                    }`}
                                    draggable
                                    onDragStart={() => setDragStepId(step.id)}
                                    onDragEnd={() => setDragStepId(null)}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => {
                                      if (dragStepId && selectedTool) {
                                        handleReorderStep(selectedTool, dragStepId, step.id);
                                        setDragStepId(null);
                                      }
                                    }}
                                  >
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      className={styles.stepHeader}
                                      onClick={() => handleToggleStepEdit(step)}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          handleToggleStepEdit(step);
                                        }
                                      }}
                                      aria-expanded={isExpanded}
                                    >
                                      <span
                                        className={
                                          step.kind === "output"
                                            ? styles.stepOutput
                                            : styles.stepTransform
                                        }
                                      >
                                        {step.kind.toUpperCase()}
                                      </span>
                                      <span className={styles.stepName}>{step.name}</span>
                                      <span className={styles.stepHeaderActions}>
                                        <button
                                          type="button"
                                          className={styles.stepDelete}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setPendingDeleteStep(step);
                                          }}
                                        >
                                          Delete
                                        </button>
                                        <span className={styles.stepChevron}>
                                          {isExpanded ? "–" : "+"}
                                        </span>
                                      </span>
                                    </div>
                                    {isExpanded && (
                                      <div className={styles.stepEditor}>
                                        <div className={styles.stepField}>
                                          <div className={styles.stepFieldLabel}>Name</div>
                                          <input
                                            className={styles.input}
                                            defaultValue={step.name}
                                            onBlur={(event) =>
                                              selectedTool
                                                ? handleSaveStepName(
                                                    selectedTool.id,
                                                    step,
                                                    event.target.value
                                                  )
                                                : undefined
                                            }
                                          />
                                        </div>
                                        <label className={styles.stepToggle}>
                                          <input
                                            type="checkbox"
                                            checked={step.enabled}
                                            onChange={(event) =>
                                              selectedTool
                                                ? handleToggleStepEnabled(
                                                    selectedTool.id,
                                                    step.id,
                                                    event.target.checked
                                                  )
                                                : undefined
                                            }
                                          />
                                          <span>Enabled</span>
                                        </label>
                                        {step.kind === "transform" ? (
                                          <div className={styles.stepField}>
                                            <div className={styles.stepFieldLabel}>Type</div>
                                            <select
                                              className={styles.input}
                                              value={modeValue}
                                              onChange={(event) =>
                                                selectedTool
                                                  ? handleSaveStepMode(
                                                      selectedTool.id,
                                                      step,
                                                      event.target.value
                                                    )
                                                  : undefined
                                              }
                                            >
                                              <option value="prompt">Prompt</option>
                                              <option value="structured-data">Structured Data</option>
                                            </select>
                                          </div>
                                        ) : (
                                          <div className={styles.stepField}>
                                            <div className={styles.stepFieldLabel}>Type</div>
                                            <input
                                              className={styles.input}
                                              defaultValue={typeValue}
                                              onBlur={(event) =>
                                                selectedTool
                                                  ? handleSaveStepConfigType(
                                                      selectedTool.id,
                                                      step,
                                                      event.target.value
                                                    )
                                                  : undefined
                                              }
                                            />
                                          </div>
                                        )}
                                        {hasPrompt && (
                                          <div className={styles.stepField}>
                                            <div className={styles.stepFieldLabel}>Prompt</div>
                                            <textarea
                                              className={styles.textarea}
                                              value={promptValue}
                                              onChange={(event) =>
                                                setStepPromptDrafts((prev) => ({
                                                  ...prev,
                                                  [step.id]: event.target.value
                                                }))
                                              }
                                              rows={3}
                                            />
                                            <div className={styles.stepFieldActions}>
                                              <button
                                                type="button"
                                                className={styles.ghostButton}
                                                onClick={() =>
                                                  selectedTool
                                                    ? handleSaveStepPrompt(
                                                        selectedTool.id,
                                                        step,
                                                        promptValue
                                                      )
                                                    : undefined
                                                }
                                                disabled={promptValue === currentPrompt}
                                              >
                                                Save Prompt
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}

                            <div className={styles.stepCardStatic}>
                              <div className={styles.stepHeaderStatic}>
                                <span className={styles.stepOutput}>OUT</span>
                                <span className={styles.stepName}>
                                  Output
                                </span>
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div className={styles.muted}>Select a tool to view steps.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className={styles.toolsTestbench}>
              <section className={styles.panel}>
                <div className={styles.panelTitle}>Test Bench</div>
                <div className={styles.panelBody}>
                  <textarea
                    className={styles.textarea}
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                  />
                  <div className={styles.testbenchActions}>
                    <button
                      className={styles.ghostButton}
                      type="button"
                      disabled={!selectedTool}
                      onClick={() => {
                        if (selectedTool) {
                          handleRunTool(selectedTool);
                        }
                      }}
                    >
                      {selectedTool ? `Run ${selectedTool.name}` : "Select a tool to run"}
                    </button>
                  </div>
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
                        <span
                          className={
                            event.type === "error"
                              ? styles.activityError
                              : event.type === "stream"
                              ? styles.activityOutput
                              : styles.activityInfo
                          }
                        >
                          {event.type === "error"
                            ? "[ERROR]"
                            : event.type === "stream"
                            ? "[OUTPUT]"
                            : "[INFO]"}
                        </span>{" "}
                        <span className={styles.activityText}>
                          {event.type === "stream"
                            ? `Output: ${formatOutput(event.message)}`
                            : event.message.startsWith("Processing:")
                            ? (() => {
                                const { main, meta } = splitProcessingMessage(event.message);
                                return (
                                  <>
                                    {main}
                                    {meta ? (
                                      <span className={styles.activityMeta}> {meta}</span>
                                    ) : null}
                                  </>
                                );
                              })()
                            : event.message.startsWith("Pipeline complete")
                            ? (() => {
                                const { main, meta } = splitCompletionMessage(event.message);
                                return (
                                  <>
                                    {main}
                                    {meta ? (
                                      <span className={styles.activityMeta}> {meta}</span>
                                    ) : null}
                                  </>
                                );
                              })()
                            : event.message}
                          {event.message.startsWith("Processing:") && (
                            <span className={styles.loadingDots}>...</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={activityEndRef} />
                </div>
              </section>
            </div>
          </div>
          {pendingDeleteStep && (
            <div className={styles.modalBackdrop} role="presentation">
              <div className={styles.modal} role="dialog" aria-modal="true">
                <div className={styles.modalTitle}>Delete Step</div>
                <div className={styles.modalBody}>
                  Delete “{pendingDeleteStep.name}”? This will remove it from all tools.
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setPendingDeleteStep(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => {
                      handleDeleteStep(pendingDeleteStep);
                      setPendingDeleteStep(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "settings" && (
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
      )}

      <footer className={styles.statusBar}>
        <span className={styles.statusText}>
          Default Model: {defaultProvider ? `${defaultProvider.name} • ${defaultProvider.model}` : "None"}
        </span>
      </footer>
    </div>
  );
}
