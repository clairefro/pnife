import type { ToolDefinition } from "../../shared/tools";
import styles from "../App.module.css";

type PipelinePanelProps = {
  selectedTool: ToolDefinition | null;
  pipelineOutputs: Record<string, string>;
  pipelineErrors: Record<string, boolean>;
  pipelineCurrentStepId: string | null;
  formatValue: (value: unknown) => string;
  inputKey: string;
  outputKey: string;
};

export default function PipelinePanel({
  selectedTool,
  pipelineOutputs,
  pipelineErrors,
  pipelineCurrentStepId,
  formatValue,
  inputKey,
  outputKey,
}: PipelinePanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>Pipeline</div>
      <div className={styles.panelBody}>
        {!selectedTool ? (
          <div className={styles.muted}>Select a tool to view pipeline.</div>
        ) : (
          <div className={styles.pipelineList}>
            <div className={styles.pipelineRow}>
              <span
                className={`${styles.pipelineIndicator} ${styles.pipelineIndicatorIdle}`}
              />
              <div className={styles.pipelineMain}>
                <div className={styles.pipelineLabel}>INPUT</div>
                <div className={styles.pipelineOutput}>
                  {formatValue(pipelineOutputs[inputKey])}
                </div>
              </div>
            </div>
            {selectedTool.pipeline.map((step) => {
              const isActive = pipelineCurrentStepId === step.id;
              const isErrored = pipelineErrors[step.id];
              return (
                <div key={step.id} className={styles.pipelineRow}>
                  <span
                    className={`${styles.pipelineIndicator} ${
                      isErrored
                        ? styles.pipelineIndicatorError
                        : isActive
                          ? styles.pipelineIndicatorActive
                          : styles.pipelineIndicatorIdle
                    }`}
                  />
                  <div className={styles.pipelineMain}>
                    <div className={styles.pipelineLabel}>
                      {step.name}{" "}
                      <span className={styles.pipelineKind}>
                        {step.kind.toUpperCase()}
                      </span>
                    </div>
                    <div className={styles.pipelineOutput}>
                      {formatValue(pipelineOutputs[step.id])}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className={styles.pipelineRow}>
              <span
                className={`${styles.pipelineIndicator} ${styles.pipelineIndicatorIdle}`}
              />
              <div className={styles.pipelineMain}>
                <div className={styles.pipelineLabel}>OUTPUT</div>
                <div className={styles.pipelineOutput}>
                  {formatValue(pipelineOutputs[outputKey])}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
