// ─── Offline Sync Queue ─────────────────────────────────────────────────────
// Persists pending operations in localStorage and replays them when back online.

import { useEffect, useSyncExternalStore } from "react";

const QUEUE_KEY = "_syncQueue";

// ── Queue helpers ───────────────────────────────────────────────────────────

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyListeners();
}

/**
 * Enqueue an operation to be replayed when online.
 * @param {{ type: string, args: any[] }} operation
 */
export function enqueue(operation) {
  const queue = readQueue();
  queue.push({ ...operation, timestamp: Date.now() });
  writeQueue(queue);
}

/**
 * Flush all queued operations by replaying them.
 * @param {Function} replayFn - receives (type, args) and returns a Promise
 * @returns {Promise<number>} number of successfully replayed operations
 */
export async function flush(replayFn) {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  let replayed = 0;
  const failed = [];

  for (const op of queue) {
    try {
      await replayFn(op.type, op.args);
      replayed++;
    } catch (err) {
      console.error("[SyncQueue] Failed to replay:", op, err);
      failed.push(op);
    }
  }

  writeQueue(failed);
  return replayed;
}

/**
 * Get the current pending count.
 */
export function getPendingCount() {
  return readQueue().length;
}

// ── External Store for React ────────────────────────────────────────────────

let listeners = new Set();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function subscribeStore(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

let onlineSnapshot = typeof navigator !== "undefined" ? navigator.onLine : true;

function getOnlineSnapshot() {
  return onlineSnapshot;
}

function getPendingSnapshot() {
  return readQueue().length;
}

// Listen to online/offline events
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    onlineSnapshot = true;
    notifyListeners();
  });
  window.addEventListener("offline", () => {
    onlineSnapshot = false;
    notifyListeners();
  });
}

/**
 * React hook for sync status.
 * @returns {{ isOnline: boolean, pendingCount: number }}
 */
export function useSyncStatus() {
  const isOnline = useSyncExternalStore(subscribeStore, getOnlineSnapshot);
  const pendingCount = useSyncExternalStore(subscribeStore, getPendingSnapshot);

  return { isOnline, pendingCount };
}

/**
 * Hook to auto-flush queue when coming back online.
 * @param {Function} replayFn
 */
export function useAutoFlush(replayFn) {
  useEffect(() => {
    const handleOnline = () => {
      if (replayFn) {
        flush(replayFn).then((count) => {
          if (count > 0) {
            console.log(`[SyncQueue] Replayed ${count} operations`);
          }
        });
      }
    };

    window.addEventListener("online", handleOnline);

    // Also flush immediately if already online and there are pending ops
    if (navigator.onLine && getPendingCount() > 0 && replayFn) {
      handleOnline();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [replayFn]);
}
