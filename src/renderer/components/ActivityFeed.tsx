import type { RefObject } from "react";
import styles from "../App.module.css";

type ActivityEvent = {
  id: string;
  message: unknown;
  type: string;
};

type ActivityFeedProps = {
  activity: ActivityEvent[];
  activityEndRef: RefObject<HTMLDivElement | null>;
  formatOutput: (message: string) => string;
  splitProcessingMessage: (message: string) => { main: string; meta: string };
  splitCompletionMessage: (message: string) => { main: string; meta: string };
};

export default function ActivityFeed({
  activity,
  activityEndRef,
  formatOutput,
  splitProcessingMessage,
  splitCompletionMessage,
}: ActivityFeedProps) {
  return (
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
                {(() => {
                  const messageText = String(event.message ?? "");
                  if (event.type === "stream") {
                    return `Output: ${formatOutput(messageText)}`;
                  }
                  if (messageText.startsWith("Processing:")) {
                    const { main, meta } = splitProcessingMessage(messageText);
                    return (
                      <>
                        {main}
                        {meta ? (
                          <span className={styles.activityMeta}> {meta}</span>
                        ) : null}
                      </>
                    );
                  }
                  if (messageText.startsWith("Pipeline complete")) {
                    const { main, meta } = splitCompletionMessage(messageText);
                    return (
                      <>
                        {main}
                        {meta ? (
                          <span className={styles.activityMeta}> {meta}</span>
                        ) : null}
                      </>
                    );
                  }
                  return messageText;
                })()}
                {String(event.message ?? "").startsWith("Processing:") && (
                  <span className={styles.loadingDots}>...</span>
                )}
              </span>
            </div>
          ))
        )}
        <div ref={activityEndRef} />
      </div>
    </section>
  );
}
