import type { ToolDefinition } from "../../shared/tools";
import type { Step } from "../../shared/types";
import styles from "../App.module.css";

type StepsEditorProps = {
  selectedTool: ToolDefinition | null;
  showAddStepMenu: boolean;
  onToggleAddStepMenu: () => void;
  onAddStep: (kind: "transform" | "output") => void;
  expandedStepId: string | null;
  onToggleStepEdit: (step: Step) => void;
  onToggleStepEnabled: (toolId: string, stepId: string, enabled: boolean) => void;
  onSaveStepName: (toolId: string, step: Step, name: string) => void;
  onSaveStepConfigType: (toolId: string, step: Step, typeValue: string) => void;
  onSaveStepPrompt: (toolId: string, step: Step, prompt: string) => void;
  onSaveStepMode: (toolId: string, step: Step, mode: string) => void;
  onDeleteStep: (step: Step) => void;
  setPendingDeleteStep: (step: Step) => void;
  stepPromptDrafts: Record<string, string>;
  setStepPromptDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  dragStepId: string | null;
  setDragStepId: (id: string | null) => void;
  onReorderStep: (tool: ToolDefinition, fromId: string, toId: string) => void;
  formatPipelineValue: (value: unknown) => string;
  onSaveToolName: (toolId: string, name: string) => void;
};

export default function StepsEditor({
  selectedTool,
  showAddStepMenu,
  onToggleAddStepMenu,
  onAddStep,
  expandedStepId,
  onToggleStepEdit,
  onToggleStepEnabled,
  onSaveStepName,
  onSaveStepConfigType,
  onSaveStepPrompt,
  onSaveStepMode,
  onDeleteStep,
  setPendingDeleteStep,
  stepPromptDrafts,
  setStepPromptDrafts,
  dragStepId,
  setDragStepId,
  onReorderStep,
  formatPipelineValue,
  onSaveToolName,
}: StepsEditorProps) {
  return (
    <div className={styles.stepsPanel}>
      <div className={styles.panelTitleAlt}>Steps</div>
      <div className={styles.panelBody}>
        {selectedTool && (
          <div className={styles.stepField}>
            <div className={styles.stepFieldLabel}>Tool Title</div>
            <input
              className={styles.input}
              defaultValue={selectedTool.name}
              onBlur={(event) => onSaveToolName(selectedTool.id, event.target.value)}
            />
          </div>
        )}
        <div className={styles.stepsActions}>
          <div className={styles.dropdown}>
            <button
              className={styles.ghostButton}
              type="button"
              onClick={onToggleAddStepMenu}
              disabled={!selectedTool}
            >
              Add Step ▾
            </button>
            {showAddStepMenu && selectedTool && (
              <div className={styles.dropdownMenu}>
                <button
                  className={styles.dropdownItem}
                  type="button"
                  onClick={() => onAddStep("transform")}
                >
                  Transform
                </button>
                <button
                  className={styles.dropdownItem}
                  type="button"
                  onClick={() => onAddStep("output")}
                >
                  Output
                </button>
              </div>
            )}
          </div>
        </div>
        {selectedTool ? (
          <>
            <div className={styles.stepCardStatic}>
              <div className={styles.stepHeaderStatic}>
                <span className={styles.stepInput}>INPUT</span>
                <span className={styles.stepName}>Input</span>
              </div>
            </div>

            {selectedTool.pipeline.length === 0 ? (
              <div className={styles.muted}>No steps in this tool.</div>
            ) : (
              selectedTool.pipeline.map((step) => {
                const isExpanded = expandedStepId === step.id;
                const currentPrompt =
                  typeof step.config?.prompt === "string" ? step.config.prompt : "";
                const promptValue = stepPromptDrafts[step.id] ?? currentPrompt;
                const hasPrompt =
                  step.kind === "transform" || typeof step.config?.prompt === "string";
                const typeValue =
                  typeof step.config?.type === "string" ? step.config.type : "";
                const modeValue =
                  typeof step.config?.mode === "string" ? step.config.mode : "prompt";
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
                        onReorderStep(selectedTool, dragStepId, step.id);
                        setDragStepId(null);
                      }
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className={styles.stepHeader}
                      onClick={() => onToggleStepEdit(step)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onToggleStepEdit(step);
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
                                ? onSaveStepName(selectedTool.id, step, event.target.value)
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
                                ? onToggleStepEnabled(
                                    selectedTool.id,
                                    step.id,
                                    event.target.checked,
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
                                  ? onSaveStepMode(
                                      selectedTool.id,
                                      step,
                                      event.target.value,
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
                                  ? onSaveStepConfigType(
                                      selectedTool.id,
                                      step,
                                      event.target.value,
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
                                  [step.id]: event.target.value,
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
                                    ? onSaveStepPrompt(
                                        selectedTool.id,
                                        step,
                                        promptValue,
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
                <span className={styles.stepName}>Output</span>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.muted}>Select a tool to view steps.</div>
        )}
      </div>
    </div>
  );
}
