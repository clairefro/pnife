import type { ToolDefinition } from "../../shared/tools";
import styles from "../App.module.css";

type ToolsListProps = {
  tools: ToolDefinition[];
  selectedToolId: string | null;
  onSelect: (id: string) => void;
  onAddTool: () => void;
  onDeleteTool: (id: string) => void;
};

export default function ToolsList({
  tools,
  selectedToolId,
  onSelect,
  onAddTool,
  onDeleteTool,
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
        <div
          key={tool.id}
          className={selectedToolId === tool.id ? styles.toolRowActive : styles.toolRow}
          onClick={() => onSelect(tool.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(tool.id);
            }
          }}
        >
          <div className={styles.rowMain}>
            <div className={styles.rowTitle}>{tool.name}</div>
            <div className={styles.rowMeta}>
              {tool.pipeline.length} steps • {tool.description}
            </div>
          </div>
          <button
            className={styles.toolDelete}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteTool(tool.id);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
