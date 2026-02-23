import { useSyncStatus } from "../../lib/syncQueue";

/**
 * SyncStatusBadge — shows online/offline status and pending operation count.
 */
export default function SyncStatusBadge() {
  const { isOnline, pendingCount } = useSyncStatus();

  return (
    <div className={`sync-indicator ${isOnline ? "online" : "offline"}`}>
      <span className="sync-dot" />
      {isOnline ? "En ligne" : "Hors ligne"}
      {pendingCount > 0 && (
        <span style={{ fontFamily: "var(--font-mono)", marginLeft: 2 }}>
          ({pendingCount})
        </span>
      )}
    </div>
  );
}
