import type { ToolDefinition } from "../../shared/tools";
import styles from "../App.module.css";

type RunPanelProps = {
  tools: ToolDefinition[];
  onRun: (tool: ToolDefinition) => void;
};

export default function RunPanel({ tools, onRun }: RunPanelProps) {
  return (
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
              <button className={styles.ghostButton} onClick={() => onRun(tool)}>
                Run
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
