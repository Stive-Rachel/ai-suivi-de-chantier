// ─── Dirty Tracker ──────────────────────────────────────────────────────────
// Tracks Supabase sync operations that haven't been confirmed as successful.
// Persists across page reloads via localStorage.

import { useSyncExternalStore } from "react";

const DIRTY_KEY = "_dirtyOps";

// ── Types ───────────────────────────────────────────────────────────────────

interface DirtyOp {
  readonly id: string;
  readonly type: string;
  readonly projectId: string;
  readonly timestamp: number;
}

// ── localStorage helpers ────────────────────────────────────────────────────

function readOps(): readonly DirtyOp[] {
  try {
    return JSON.parse(localStorage.getItem(DIRTY_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeOps(ops: readonly DirtyOp[]): void {
  localStorage.setItem(DIRTY_KEY, JSON.stringify(ops));
  notifyListeners();
}

// ── Public API ──────────────────────────────────────────────────────────────

let idCounter = 0;

/**
 * Mark an operation as dirty (pending sync confirmation).
 * Returns a unique opId to pass to markClean on success.
 */
export function markDirty(type: string, projectId: string): string {
  const opId = `dirty_${Date.now()}_${++idCounter}`;
  const op: DirtyOp = { id: opId, type, projectId, timestamp: Date.now() };
  const current = readOps();
  writeOps([...current, op]);
  return opId;
}

/**
 * Remove a specific operation from the dirty list (sync confirmed).
 */
export function markClean(opId: string): void {
  const current = readOps();
  const updated = current.filter((op) => op.id !== opId);
  writeOps(updated);
}

/**
 * Get the number of unconfirmed sync operations.
 */
export function getDirtyCount(): number {
  return readOps().length;
}

/**
 * Get all dirty operations (returns a new array each time).
 */
export function getDirtyOps(): readonly DirtyOp[] {
  return readOps();
}

/**
 * Clear all dirty operations (e.g. after a successful full sync).
 */
export function clearAllDirty(): void {
  writeOps([]);
}

// ── External Store for React (useSyncExternalStore) ─────────────────────────

let listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getDirtyCountSnapshot(): number {
  return readOps().length;
}

/**
 * React hook: reactive dirty operation count.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useDirtyCount(): number {
  return useSyncExternalStore(subscribe, getDirtyCountSnapshot);
}
