// ─── React Hook: Unified Data Layer ─────────────────────────────────────────
//
// STRATEGY: localStorage is the PRIMARY data store. It is always read first
// and always saved on every mutation. Supabase is a SECONDARY sync layer:
//   - On load: start with localStorage, then merge newer Supabase data
//   - On mutation: save to localStorage immediately, push to Supabase async
//   - On "Forcer synchro": push everything from localStorage to Supabase
//
// This guarantees data is NEVER lost on refresh, regardless of Supabase state.

import { useState, useEffect, useCallback, useRef } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import { loadAllProjects, fullProjectSync, withRetry } from "./dataLayer";
import { migrateLocalStorageToSupabase, backupLocalData, restoreFromBackup } from "./migration";
import { getDirtyCount, clearAllDirty } from "./dirtyTracker";

/**
 * Deep-merge tracking: for each project, take the union of local and remote
 * tracking cells. If a cell exists in both, prefer the non-empty status.
 */
function mergeTracking(local, remote) {
  if (!local && !remote) return { logements: {}, batiments: {} };
  if (!local) return remote;
  if (!remote) return local;

  const result = JSON.parse(JSON.stringify(local)); // deep copy local as base

  for (const trackType of ["logements", "batiments"]) {
    const remoteTrack = remote[trackType] || {};
    if (!result[trackType]) result[trackType] = {};

    for (const [rowKey, rowData] of Object.entries(remoteTrack)) {
      if (!result[trackType][rowKey]) {
        result[trackType][rowKey] = rowData;
      } else {
        // Merge cells: prefer non-empty status
        for (const [entityId, cell] of Object.entries(rowData)) {
          const existing = result[trackType][rowKey][entityId];
          if (!existing) {
            result[trackType][rowKey][entityId] = cell;
          } else if (entityId.startsWith("_")) {
            // Metadata: prefer remote if non-default
            if (entityId === "_ponderation" && cell && cell !== 1) {
              result[trackType][rowKey][entityId] = cell;
            } else if (entityId === "_tache" && cell) {
              result[trackType][rowKey][entityId] = cell;
            }
          } else {
            // Cell status: prefer non-empty
            const remoteStatus = cell?.status || "";
            const localStatus = existing?.status || "";
            if (remoteStatus && !localStatus) {
              result[trackType][rowKey][entityId] = cell;
            }
          }
        }
      }
    }
  }

  return result;
}

export function useDataLayer(userId) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(isSupabaseConfigured() ? "supabase" : "local");

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // STEP 1: Always load localStorage first — this is the instant, reliable source
      const localData = loadDB();

      try {
        if (mode === "supabase" && userId) {
          backupLocalData();
          await migrateLocalStorageToSupabase(userId);

          // STEP 2: Show local data immediately (no loading delay)
          if (!cancelled && localData?.projects?.length) {
            setDb(localData);
          }

          // STEP 3: Fetch Supabase data and merge
          const supaProjects = await loadAllProjects();
          if (cancelled) return;

          if (supaProjects.length > 0) {
            const localProjects = localData?.projects || [];

            // Merge: for each Supabase project, merge tracking with local
            const merged = supaProjects.map((sp) => {
              const lp = localProjects.find((l) => l.id === sp.id);
              if (!lp) return sp;
              return { ...sp, tracking: mergeTracking(lp.tracking, sp.tracking) };
            });

            // Add local-only projects (not yet in Supabase)
            for (const lp of localProjects) {
              if (!supaProjects.find((sp) => sp.id === lp.id)) {
                merged.push(lp);
                // Push to Supabase in background
                withRetry(() => fullProjectSync(lp, userId));
              }
            }

            console.log(`[DataLayer] Merged ${merged.length} projects (local + Supabase)`);
            setDb({ projects: merged });
            saveDB({ projects: merged });

            // Push dirty ops to Supabase in background
            if (getDirtyCount() > 0) {
              console.log(`[DataLayer] ${getDirtyCount()} dirty ops, pushing to Supabase...`);
              for (const p of merged) {
                withRetry(() => fullProjectSync(p, userId)).then(({ ok }) => {
                  if (ok) clearAllDirty();
                });
              }
            }
          } else if (localData?.projects?.length) {
            // Supabase empty, keep local and push
            console.warn("[DataLayer] Supabase empty, using local data");
            setDb(localData);
            for (const p of localData.projects) {
              withRetry(() => fullProjectSync(p, userId));
            }
          } else {
            const restored = restoreFromBackup();
            setDb(restored?.projects?.length ? restored : { projects: [] });
          }
        } else {
          if (!cancelled) setDb(localData);
        }
      } catch (err) {
        console.error("[DataLayer] Supabase failed, using localStorage:", err);
        if (!cancelled) {
          setError(err);
          setMode("local");
          setDb(localData?.projects?.length ? localData : restoreFromBackup() || loadDB());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [userId, mode]);

  // Reload: merge Supabase into current local data (never replace)
  const reload = useCallback(async () => {
    if (mode !== "supabase") return;
    try {
      const supaProjects = await loadAllProjects();
      if (!supaProjects.length) return;

      const localData = loadDB();
      const merged = supaProjects.map((sp) => {
        const lp = localData?.projects?.find((l) => l.id === sp.id);
        if (!lp) return sp;
        return { ...sp, tracking: mergeTracking(lp.tracking, sp.tracking) };
      });

      console.log(`[DataLayer] Reload merged ${merged.length} projects`);
      setDb({ projects: merged });
      saveDB({ projects: merged });
    } catch (err) {
      console.error("[DataLayer] Reload failed:", err);
    }
  }, [mode]);

  // Force push all local projects to Supabase
  const forceSync = useCallback(async () => {
    if (mode !== "supabase" || !db?.projects?.length || !userId) {
      return { ok: false, error: "Not configured" };
    }
    const errors = [];
    for (const p of db.projects) {
      try {
        await fullProjectSync(p, userId);
        console.log(`[DataLayer] Force sync OK: ${p.id}`);
      } catch (err) {
        console.error(`[DataLayer] Force sync FAILED for ${p.id}:`, err);
        errors.push(`${p.name}: ${err.message || err}`);
      }
    }
    if (errors.length > 0) return { ok: false, error: errors.join("; ") };
    return { ok: true };
  }, [mode, db, userId]);

  // Auto-sync every 5 minutes if there are dirty ops
  const forceSyncRef = useRef(forceSync);
  forceSyncRef.current = forceSync;

  useEffect(() => {
    if (mode !== "supabase") return;

    const FIVE_MINUTES = 5 * 60 * 1000;

    const intervalId = setInterval(() => {
      if (!navigator.onLine || getDirtyCount() === 0) return;

      forceSyncRef.current().then((result) => {
        if (result.ok) {
          clearAllDirty();
          console.log("[AutoSync] Periodic sync completed");
        } else {
          console.warn("[AutoSync] Periodic sync failed:", result.error);
        }
      });
    }, FIVE_MINUTES);

    return () => clearInterval(intervalId);
  }, [mode]);

  return { db, setDb, loading, error, mode, reload, forceSync };
}
