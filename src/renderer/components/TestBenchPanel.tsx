import styles from "../App.module.css";

type TestBenchPanelProps = {
  inputText: string;
  onInputChange: (value: string) => void;
  output: string;
  runLabel?: string;
  onRun?: () => void;
  runDisabled?: boolean;
  formatOutput: (value: unknown) => string;
};

export default function TestBenchPanel({
  inputText,
  onInputChange,
  output,
  runLabel,
  onRun,
  runDisabled,
  formatOutput,
}: TestBenchPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>Test Bench</div>
      <div className={styles.panelBody}>
        <textarea
          className={styles.textarea}
          value={inputText}
          onChange={(event) => onInputChange(event.target.value)}
        />
        {onRun && (
          <div className={styles.testbenchActions}>
            <button
              className={styles.ghostButton}
              type="button"
              disabled={runDisabled}
              onClick={onRun}
            >
              {runLabel ?? "Run"}
            </button>
          </div>
        )}
        <div className={styles.output}>
          {output ? formatOutput(output) : "Run a tool to see output."}
        </div>
      </div>
    </section>
  );
}
