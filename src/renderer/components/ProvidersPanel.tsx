import type { ProviderConfig } from "../../shared/types";
import styles from "../App.module.css";

type ProviderOption = { value: ProviderConfig["vendor"]; label: string };

type ProvidersPanelProps = {
  providerForm: {
    name: string;
    vendor: ProviderConfig["vendor"];
    kind: ProviderConfig["kind"];
    apiKey: string;
    baseUrl: string;
    model: string;
    enabled: boolean;
  };
  providerOptions: ProviderOption[];
  editingProviderId: string | null;
  providers: ProviderConfig[];
  onSubmit: (event: React.FormEvent) => void;
  onUpdateForm: (next: Partial<ProvidersPanelProps["providerForm"]>) => void;
  onEdit: (provider: ProviderConfig) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onToggleEnabled: (provider: ProviderConfig, enabled: boolean) => void;
  onCancelEdit: () => void;
  onVendorChange: (vendor: ProviderConfig["vendor"]) => void;
  onTest: (provider: ProviderConfig) => void;
  providerTests: Record<
    string,
    { status: "idle" | "testing" | "ok" | "error"; message?: string }
  >;
};

export default function ProvidersPanel({
  providerForm,
  providerOptions,
  editingProviderId,
  providers,
  onSubmit,
  onUpdateForm,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleEnabled,
  onCancelEdit,
  onVendorChange,
  onTest,
  providerTests,
}: ProvidersPanelProps) {
  return (
    <section className={styles.panelWide}>
      <div className={styles.panelTitle}>LLM Providers</div>
      <div className={styles.panelBody}>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={providerForm.name}
              onChange={(event) => onUpdateForm({ name: event.target.value })}
              placeholder="Provider name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Vendor</label>
            <select
              className={styles.input}
              value={providerForm.vendor}
              onChange={(event) =>
                onVendorChange(event.target.value as ProviderConfig["vendor"])
              }
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
              onChange={(event) => onUpdateForm({ apiKey: event.target.value })}
              placeholder="Optional for local providers"
              type="password"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Base URL</label>
            <input
              className={styles.input}
              value={providerForm.baseUrl}
              onChange={(event) => onUpdateForm({ baseUrl: event.target.value })}
              placeholder="http://localhost:11434"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Model</label>
            <input
              className={styles.input}
              value={providerForm.model}
              onChange={(event) => onUpdateForm({ model: event.target.value })}
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
              onClick={onCancelEdit}
            >
              Cancel
            </button>
          )}
        </form>

        <div className={styles.list}>
          {!providers.some((provider) => provider.enabled) && (
            <div className={styles.banner}>
              Configure at least one enabled provider to run tools.
            </div>
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
                    onChange={() => onSetDefault(provider.id)}
                  />
                  <span className={styles.radioText}>Default</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={provider.enabled}
                    onChange={(event) =>
                      onToggleEnabled(provider, event.target.checked)
                    }
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
                    onClick={() => onTest(provider)}
                    disabled={providerTests[provider.id]?.status === "testing"}
                  >
                    {providerTests[provider.id]?.status === "testing"
                      ? "Testing..."
                      : "Test"}
                  </button>
                  <button
                    className={styles.ghostButton}
                    type="button"
                    onClick={() => onEdit(provider)}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.ghostButton}
                    type="button"
                    onClick={() => onDelete(provider.id)}
                  >
                    Remove
                  </button>
                  {providerTests[provider.id]?.status === "ok" && (
                    <span className={styles.providerTestOk}>OK</span>
                  )}
                  {providerTests[provider.id]?.status === "error" && (
                    <span className={styles.providerTestError}>Failed</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
