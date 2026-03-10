import { useSyncStatus } from "../../lib/syncQueue";
import { useDirtyCount } from "../../lib/dirtyTracker";

/**
 * SyncStatusBadge — shows online/offline status, pending operation count,
 * and unsynced (dirty) operation count.
 */
export default function SyncStatusBadge() {
  const { isOnline, pendingCount } = useSyncStatus();
  const dirtyCount = useDirtyCount();

  const hasWarning = dirtyCount > 0;
  const isSynced = isOnline && dirtyCount === 0 && pendingCount === 0;

  const className = [
    "sync-indicator",
    isOnline ? "online" : "offline",
    hasWarning ? "sync-warning" : "",
    isSynced ? "sync-ok" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <span className="sync-dot" />
      {isOnline ? "En ligne" : "Hors ligne"}
      {pendingCount > 0 && (
        <span className="sync-dirty-count">
          ({pendingCount})
        </span>
      )}
      {hasWarning && (
        <span className="sync-dirty-count">
          {dirtyCount} non syncr.
        </span>
      )}
      {isSynced && (
        <span style={{ marginLeft: 4 }}>
          ✓
        </span>
      )}
    </div>
  );
}
