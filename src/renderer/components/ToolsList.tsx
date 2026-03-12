import type { ToolDefinition } from "../../shared/tools";
import styles from "../App.module.css";

type ToolsListProps = {
  tools: ToolDefinition[];
  selectedToolId: string | null;
  onSelect: (id: string) => void;
  onAddTool: () => void;
};

export default function ToolsList({
  tools,
  selectedToolId,
  onSelect,
  onAddTool,
}: ToolsListProps) {
  return (
    <div className={styles.toolsList}>
      <div className={styles.toolsListHeader}>
        <div className={styles.rowTitle}>Tools</div>
        <button className={styles.ghostButton} type="button" onClick={onAddTool}>
          Add Tool
        </button>
      </div>
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={selectedToolId === tool.id ? styles.toolRowActive : styles.toolRow}
          onClick={() => onSelect(tool.id)}
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
  );
}
