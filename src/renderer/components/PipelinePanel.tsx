import type { ToolDefinition } from "../../shared/tools";
import styles from "../App.module.css";

type PipelinePanelProps = {
  selectedTool: ToolDefinition | null;
  pipelineOutputs: Record<string, string>;
  pipelineErrors: Record<string, boolean>;
  pipelineCurrentStepId: string | null;
  pipelineComplete: boolean;
  formatValue: (value: unknown) => string;
  formatPreview: (value: unknown) => string;
  inputKey: string;
  outputKey: string;
};

export default function PipelinePanel({
  selectedTool,
  pipelineOutputs,
  pipelineErrors,
  pipelineCurrentStepId,
  pipelineComplete,
  formatValue,
  formatPreview,
  inputKey,
  outputKey,
}: PipelinePanelProps) {
  const inputValue = pipelineOutputs[inputKey];
  const outputValue = pipelineOutputs[outputKey];
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>Pipeline</div>
      <div className={styles.panelBody}>
        {!selectedTool ? (
          <div className={styles.muted}>Select a tool to view pipeline.</div>
        ) : (
          <div className={styles.pipelineList}>
            <div className={styles.pipelineRow}>
              <span className={styles.pipelineIndicatorSpacer} />
              <div className={styles.pipelineMain}>
                <div className={styles.pipelineLabel}>INPUT</div>
                {inputValue ? (
                  <details className={styles.pipelineDetails}>
                    <summary className={styles.pipelineSummary}>
                      {formatPreview(inputValue)}
                    </summary>
                    <div className={styles.pipelineOutput}>
                      {formatValue(inputValue)}
                    </div>
                  </details>
                ) : (
                  <div className={styles.pipelineOutput}>—</div>
                )}
              </div>
            </div>
            {selectedTool.pipeline.map((step) => {
              const isActive = pipelineCurrentStepId === step.id;
              const isErrored = pipelineErrors[step.id];
              const hasOutput = Boolean(pipelineOutputs[step.id]);
              return (
                <div
                  key={step.id}
                  className={`${styles.pipelineRow} ${
                    !isActive && !hasOutput && !isErrored
                      ? styles.pipelineRowUpcoming
                      : ""
                  }`}
                >
                  {hasOutput ? (
                    <span className={styles.pipelineCheckmark}>✓</span>
                  ) : (
                    <span
                      className={`${styles.pipelineIndicator} ${
                        isErrored
                          ? styles.pipelineIndicatorError
                          : isActive
                            ? styles.pipelineIndicatorActive
                            : styles.pipelineIndicatorIdle
                      }`}
                    />
                  )}
                  <div className={styles.pipelineMain}>
                    <div className={styles.pipelineLabel}>
                      <span
                        className={`${styles.pipelineKindLabel} ${
                          step.kind === "transform"
                            ? styles.pipelineKindTransform
                            : styles.pipelineKindOutput
                        }`}
                      >
                        {step.kind.toUpperCase()}
                      </span>
                      <span className={styles.pipelineName}>{step.name}</span>
                    </div>
                    {hasOutput ? (
                      <details className={styles.pipelineDetails}>
                        <summary className={styles.pipelineSummary}>
                          {formatPreview(pipelineOutputs[step.id])}
                        </summary>
                        <div className={styles.pipelineOutput}>
                          {formatValue(pipelineOutputs[step.id])}
                        </div>
                      </details>
                    ) : (
                      <div className={styles.pipelineOutput}>—</div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className={styles.pipelineRow}>
              <span className={styles.pipelineIndicatorSpacer} />
              <div className={styles.pipelineMain}>
                <div className={styles.pipelineLabel}>OUTPUT</div>
                {pipelineComplete && outputValue ? (
                  <details className={styles.pipelineDetails}>
                    <summary className={styles.pipelineSummary}>
                      {formatPreview(outputValue)}
                    </summary>
                    <div className={styles.pipelineOutput}>
                      {formatValue(outputValue)}
                    </div>
                  </details>
                ) : (
                  <div className={styles.pipelineOutput}>—</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
