import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";
import { ToolDefinition } from "../shared/tools";
import { ProviderConfig, ProviderKind, Step } from "../shared/types";
import ActivityFeed from "./components/ActivityFeed";
import TestBenchPanel from "./components/TestBenchPanel";
import PipelinePanel from "./components/PipelinePanel";
import ToolsList from "./components/ToolsList";
import StepsEditor from "./components/StepsEditor";
import RunPanel from "./components/RunPanel";
import ProvidersPanel from "./components/ProvidersPanel";

export default function App() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [stepPromptDrafts, setStepPromptDrafts] = useState<
    Record<string, string>
  >({});
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"run" | "tools" | "settings">(
    "tools",
  );
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [inputText, setInputText] = useState(
    "This is a test paragraph about Pnife. It should be summarized into a shorter, clearer sentence without losing the core meaning or tone.",
  );
  const [lastOutput, setLastOutput] = useState("");
  const [activity, setActivity] = useState<
    { id: string; message: string; type: string }[]
  >([]);
  const activityEndRef = useRef<HTMLDivElement | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const lastRunInputRef = useRef<string>("");
  const [providerForm, setProviderForm] = useState<{
    name: string;
    vendor: "openai" | "mock" | "anthropic" | "google" | "ollama" | "lmstudio";
    kind: ProviderKind;
    apiKey: string;
    baseUrl: string;
    model: string;
    enabled: boolean;
  }>({
    name: "",
    vendor: "openai",
    kind: "cloud" as ProviderKind,
    apiKey: "",
    baseUrl: "",
    model: "",
    enabled: true,
  });
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [showAddStepMenu, setShowAddStepMenu] = useState(false);
  const [pendingDeleteStep, setPendingDeleteStep] = useState<Step | null>(null);
  const [pipelineCurrentStepId, setPipelineCurrentStepId] = useState<
    string | null
  >(null);
  const [pipelineOutputs, setPipelineOutputs] = useState<
    Record<string, string>
  >({});
  const [pipelineErrors, setPipelineErrors] = useState<Record<string, boolean>>(
    {},
  );
  const pipelineCurrentStepRef = useRef<string | null>(null);
  const [providerTests, setProviderTests] = useState<
    Record<
      string,
      { status: "idle" | "testing" | "ok" | "error"; message?: string }
    >
  >({});

  const PIPELINE_INPUT_KEY = "__INPUT__";
  const PIPELINE_OUTPUT_KEY = "__OUTPUT__";

  useEffect(() => {
    if (!window.pnife?.tools) {
      return;
    }

    window.pnife.tools
      .list()
      .then(setTools)
      .catch(() => setTools([]));
  }, []);

  useEffect(() => {
    if (!window.pnife?.providers) {
      return;
    }

    window.pnife.providers
      .list()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!window.pnife?.activity) {
      return;
    }
    const unsubscribe = window.pnife.activity.onEvent((event) => {
      if (event.runId && event.runId !== currentRunId) {
        setActivity([]);
        setCurrentRunId(event.runId);
        setPipelineCurrentStepId(null);
        pipelineCurrentStepRef.current = null;
        setPipelineOutputs({
          [PIPELINE_INPUT_KEY]: lastRunInputRef.current,
        });
        setPipelineErrors({});
      }
      const uniqueId = `${event.id}_${Math.random().toString(36).slice(2, 8)}`;
      setActivity((prev) =>
        [
          ...prev,
          { id: uniqueId, message: event.message, type: event.type },
        ].slice(-50),
      );
      if (event.type === "stream") {
        setLastOutput(coerceText(event.message));
      }
      if (event.stepStatus === "started" && event.stepId) {
        setPipelineCurrentStepId(event.stepId);
        pipelineCurrentStepRef.current = event.stepId;
      }
      if (event.stepStatus === "errored" && event.stepId) {
        setPipelineErrors((prev) => ({
          ...prev,
          [String(event.stepId)]: true,
        }));
      }
      if (event.stepStatus === "completed" && event.stepId) {
        if (pipelineCurrentStepRef.current === event.stepId) {
          setPipelineCurrentStepId(null);
          pipelineCurrentStepRef.current = null;
        }
        if (event.output) {
          const outputText =
            typeof event.output === "string"
              ? event.output
              : formatPipelineValue(event.output);
          setPipelineOutputs((prev) => ({
            ...prev,
            [String(event.stepId)]: outputText ?? prev[String(event.stepId)],
            [PIPELINE_OUTPUT_KEY]: outputText ?? prev[PIPELINE_OUTPUT_KEY],
          }));
        }
      }
    });
    return () => unsubscribe();
  }, [currentRunId]);

  useEffect(() => {
    activityEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [activity]);

  useEffect(() => {
    if (!selectedTool) {
      setPipelineOutputs({});
      setPipelineCurrentStepId(null);
      pipelineCurrentStepRef.current = null;
      setPipelineErrors({});
      return;
    }
    setPipelineOutputs({
      [PIPELINE_INPUT_KEY]: inputText,
    });
    setPipelineCurrentStepId(null);
    pipelineCurrentStepRef.current = null;
    setPipelineErrors({});
  }, [selectedToolId]);

  const providerOptions = useMemo(
    () => [
      { value: "openai", label: "OpenAI", kind: "cloud" as ProviderKind },
      { value: "anthropic", label: "Anthropic", kind: "cloud" as ProviderKind },
      { value: "google", label: "Google", kind: "cloud" as ProviderKind },
      { value: "ollama", label: "Ollama", kind: "local" as ProviderKind },
      { value: "lmstudio", label: "LM Studio", kind: "local" as ProviderKind },
    ],
    [],
  );

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId) ?? null,
    [tools, selectedToolId],
  );

  const defaultProvider = useMemo(
    () => providers.find((provider) => provider.isDefault),
    [providers],
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
    updater: (step: Step) => Step,
  ): ToolDefinition[] {
    return tools.map((tool) => {
      if (tool.id !== toolId) {
        return tool;
      }
      return {
        ...tool,
        pipeline: tool.pipeline.map((step) =>
          step.id === stepId ? updater(step) : step,
        ),
      };
    });
  }

  async function handleToggleStepEnabled(
    toolId: string,
    stepId: string,
    enabled: boolean,
  ) {
    const nextTools = updateToolStep(toolId, stepId, (step) => ({
      ...step,
      enabled,
    }));
    await persistTools(nextTools);
  }

  async function handleSaveStepPrompt(
    toolId: string,
    step: Step,
    prompt: string,
  ) {
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      config: { ...item.config, prompt },
    }));
    await persistTools(nextTools);
  }

  async function handleSaveStepName(toolId: string, step: Step, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      name: trimmed,
    }));
    await persistTools(nextTools);
  }

  async function handleSaveStepConfigType(
    toolId: string,
    step: Step,
    typeValue: string,
  ) {
    const trimmed = typeValue.trim();
    if (!trimmed) {
      return;
    }
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      config: { ...item.config, type: trimmed },
    }));
    await persistTools(nextTools);
  }

  async function handleSaveStepMode(toolId: string, step: Step, mode: string) {
    const nextTools = updateToolStep(toolId, step.id, (item) => ({
      ...item,
      config: { ...item.config, mode },
    }));
    await persistTools(nextTools);
  }

  function handleToggleStepEdit(step: Step) {
    setExpandedStepId((prev) => (prev === step.id ? null : step.id));
    const currentPrompt =
      typeof step.config?.prompt === "string" ? step.config.prompt : undefined;
    if (currentPrompt !== undefined) {
      setStepPromptDrafts((prev) =>
        prev[step.id] === undefined
          ? { ...prev, [step.id]: currentPrompt }
          : prev,
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
        config: { type: "ai-text-gen", prompt: "" },
      };
    }
    return {
      id,
      name: "New Output",
      kind,
      enabled: true,
      config: { type: "custom-output" },
    };
  }

  async function handleAddTool() {
    const id = `tool_${Date.now()}`;
    const nextTool: ToolDefinition = {
      id,
      name: "Untitled Tool",
      description: "",
      pipeline: [],
    };
    const nextTools = [...tools, nextTool];
    await persistTools(nextTools);
    setSelectedToolId(id);
  }

  async function handleSaveToolName(toolId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const nextTools = tools.map((tool) =>
      tool.id === toolId ? { ...tool, name: trimmed } : tool,
    );
    await persistTools(nextTools);
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
        ? {
            ...tool,
            pipeline: tool.pipeline.filter((item) => item.id !== step.id),
          }
        : tool,
    );
    await persistTools(nextTools);
    setExpandedStepId((prev) => (prev === step.id ? null : prev));
  }

  async function handleReorderStep(
    tool: ToolDefinition,
    fromId: string,
    toId: string,
  ) {
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
      item.id === tool.id ? { ...item, pipeline: nextPipeline } : item,
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
      updatedAt: Date.now(),
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
      enabled: true,
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

  async function handleToggleEnabled(
    provider: ProviderConfig,
    enabled: boolean,
  ) {
    await window.pnife.providers.upsert({
      ...provider,
      enabled,
      isDefault: provider.isDefault,
    });
    await refreshProviders();
  }

  async function handleTestProvider(provider: ProviderConfig) {
    setProviderTests((prev) => ({
      ...prev,
      [provider.id]: { status: "testing" },
    }));
    try {
      const result = await window.pnife.providers.test(provider.id);
      if (result.ok) {
        setProviderTests((prev) => ({
          ...prev,
          [provider.id]: { status: "ok", message: result.output },
        }));
      } else {
        setProviderTests((prev) => ({
          ...prev,
          [provider.id]: { status: "error", message: result.error },
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProviderTests((prev) => ({
        ...prev,
        [provider.id]: { status: "error", message },
      }));
    }
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
      enabled: provider.enabled,
    });
  }

  async function handleRunTool(tool: ToolDefinition) {
    if (!providers.some((provider) => provider.enabled)) {
      setActivity((prev) => [
        {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          message: "Configure at least one enabled provider.",
          type: "error",
        },
        ...prev,
      ]);
      return;
    }

    setActivity([]);
    setCurrentRunId(null);
    setLastOutput("");
    lastRunInputRef.current = inputText;
    setPipelineOutputs({
      [PIPELINE_INPUT_KEY]: inputText,
    });
    setPipelineCurrentStepId(null);
    pipelineCurrentStepRef.current = null;
    setPipelineErrors({});
    const context = {
      text: inputText,
      data: {},
      attachments: [],
      metadata: { timestamp: Date.now() },
    };
    try {
      const result = await window.pnife.pipeline.run(tool.pipeline, context);
      setLastOutput(result.context.text);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pipeline failed.";
      setActivity((prev) => [
        {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          message,
          type: "error",
        },
        ...prev,
      ]);
    }
  }

  function formatOutput(message: string) {
    const safeMessage =
      typeof message === "string" ? message : String(message ?? "");
    const trimmed = safeMessage.trim();
    if (trimmed.length <= 200) {
      return trimmed;
    }
    return `${trimmed.slice(0, 200)}...`;
  }

  function formatPipelineValue(value: unknown) {
    if (value === null || value === undefined) {
      return "—";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function coerceText(value: unknown) {
    if (typeof value === "string") {
      return value;
    }
    if (value === null || value === undefined) {
      return "";
    }
    return formatPipelineValue(value);
  }

  function splitProcessingMessage(message: string) {
    const parts = message.split(" | ");
    return {
      main: parts[0] ?? message,
      meta: parts.length > 1 ? parts.slice(1).join(" | ") : "",
    };
  }

  function splitCompletionMessage(message: string) {
    const parts = message.split(" | ");
    return {
      main: parts[0] ?? message,
      meta: parts.length > 1 ? parts.slice(1).join(" | ") : "",
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
          <RunPanel tools={tools} onRun={handleRunTool} />

          <TestBenchPanel
            inputText={inputText}
            onInputChange={setInputText}
            output={lastOutput}
            formatOutput={formatPipelineValue}
          />

          <ActivityFeed
            activity={activity}
            activityEndRef={activityEndRef}
            formatOutput={formatOutput}
            splitProcessingMessage={splitProcessingMessage}
            splitCompletionMessage={splitCompletionMessage}
          />
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
                <ToolsList
                  tools={tools}
                  selectedToolId={selectedToolId}
                  onSelect={setSelectedToolId}
                  onAddTool={handleAddTool}
                />
                <StepsEditor
                  selectedTool={selectedTool}
                  showAddStepMenu={showAddStepMenu}
                  onToggleAddStepMenu={() =>
                    setShowAddStepMenu((prev) => !prev)
                  }
                  onAddStep={(kind) => {
                    handleAddStep(kind);
                    setShowAddStepMenu(false);
                  }}
                  expandedStepId={expandedStepId}
                  onToggleStepEdit={handleToggleStepEdit}
                  onToggleStepEnabled={handleToggleStepEnabled}
                  onSaveStepName={handleSaveStepName}
                  onSaveStepConfigType={handleSaveStepConfigType}
                  onSaveStepPrompt={handleSaveStepPrompt}
                  onSaveStepMode={handleSaveStepMode}
                  onDeleteStep={handleDeleteStep}
                  setPendingDeleteStep={setPendingDeleteStep}
                  stepPromptDrafts={stepPromptDrafts}
                  setStepPromptDrafts={setStepPromptDrafts}
                  dragStepId={dragStepId}
                  setDragStepId={setDragStepId}
                  onReorderStep={handleReorderStep}
                  formatPipelineValue={formatPipelineValue}
                  onSaveToolName={handleSaveToolName}
                />
              </div>
            )}
            <div className={styles.toolsTestbench}>
              <TestBenchPanel
                inputText={inputText}
                onInputChange={setInputText}
                output={lastOutput}
                runLabel={
                  selectedTool
                    ? `Run ${selectedTool.name}`
                    : "Select a tool to run"
                }
                runDisabled={!selectedTool}
                onRun={() => {
                  if (selectedTool) {
                    handleRunTool(selectedTool);
                  }
                }}
                formatOutput={formatPipelineValue}
              />

              <ActivityFeed
                activity={activity}
                activityEndRef={activityEndRef}
                formatOutput={formatOutput}
                splitProcessingMessage={splitProcessingMessage}
                splitCompletionMessage={splitCompletionMessage}
              />
            </div>
            <PipelinePanel
              selectedTool={selectedTool}
              pipelineOutputs={pipelineOutputs}
              pipelineErrors={pipelineErrors}
              pipelineCurrentStepId={pipelineCurrentStepId}
              formatValue={formatPipelineValue}
              inputKey={PIPELINE_INPUT_KEY}
              outputKey={PIPELINE_OUTPUT_KEY}
            />
          </div>
          {pendingDeleteStep && (
            <div className={styles.modalBackdrop} role="presentation">
              <div className={styles.modal} role="dialog" aria-modal="true">
                <div className={styles.modalTitle}>Delete Step</div>
                <div className={styles.modalBody}>
                  Delete “{pendingDeleteStep.name}”? This will remove it from
                  all tools.
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
        <ProvidersPanel
          providerForm={providerForm}
          providerOptions={providerOptions.map((option) => ({
            value: option.value as ProviderConfig["vendor"],
            label: option.label,
          }))}
          editingProviderId={editingProviderId}
          providers={providers}
          onSubmit={handleProviderSubmit}
          onUpdateForm={updateProviderForm}
          onEdit={handleEditProvider}
          onDelete={handleDeleteProvider}
          onSetDefault={handleSetDefaultProvider}
          onToggleEnabled={handleToggleEnabled}
          onCancelEdit={() => {
            setEditingProviderId(null);
            setProviderForm({
              name: "",
              vendor: "openai",
              kind: "cloud",
              apiKey: "",
              baseUrl: "",
              model: "",
              enabled: true,
            });
          }}
          onVendorChange={(vendor) => {
            const option = providerOptions.find(
              (item) => item.value === vendor,
            );
            updateProviderForm({
              vendor,
              kind: option?.kind ?? providerForm.kind,
            });
          }}
          onTest={handleTestProvider}
          providerTests={providerTests}
        />
      )}

      <footer className={styles.statusBar}>
        <span className={styles.statusText}>
          Default Model:{" "}
          {defaultProvider
            ? `${defaultProvider.name} • ${defaultProvider.model}`
            : "None"}
        </span>
      </footer>
    </div>
  );
}
