// ─── React Hook: Unified Data Layer ─────────────────────────────────────────
//
// STRATEGY: Supabase is the SOURCE OF TRUTH when online.
//   - On load: fetch Supabase first, merge with any local-only changes
//   - On mutation: save to localStorage immediately, push to Supabase async
//   - localStorage serves as offline cache and instant display while fetching
//
// This ensures all users always see the latest data from the server.

import { useState, useEffect, useCallback, useRef } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import { loadAllProjects, fullProjectSync, withRetry } from "./dataLayer";
import { migrateLocalStorageToSupabase, backupLocalData, restoreFromBackup } from "./migration";
import { getDirtyCount, clearAllDirty } from "./dirtyTracker";

/**
 * Deep-merge tracking: Supabase (remote) is the base, local fills gaps
 * for cells that only exist locally (dirty/offline changes).
 */
function mergeTracking(remote, local) {
  if (!local && !remote) return { logements: {}, batiments: {} };
  if (!remote) return local;
  if (!local) return remote;

  // Start from remote (source of truth)
  const result = JSON.parse(JSON.stringify(remote));

  for (const trackType of ["logements", "batiments"]) {
    const localTrack = local[trackType] || {};
    if (!result[trackType]) result[trackType] = {};

    for (const [rowKey, rowData] of Object.entries(localTrack)) {
      if (!result[trackType][rowKey]) {
        // Row only exists locally (new local row) — keep it
        result[trackType][rowKey] = rowData;
      } else {
        for (const [entityId, cell] of Object.entries(rowData)) {
          const existing = result[trackType][rowKey][entityId];
          if (!existing) {
            // Cell only exists locally — keep it (likely a dirty offline change)
            result[trackType][rowKey][entityId] = cell;
          }
          // If both exist, remote wins (already in result)
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
      const localData = loadDB();

      try {
        if (mode === "supabase" && userId) {
          backupLocalData();
          await migrateLocalStorageToSupabase(userId);

          // Show local data immediately while fetching Supabase
          if (!cancelled && localData?.projects?.length) {
            setDb(localData);
          }

          // Fetch Supabase — this is the source of truth
          const supaProjects = await loadAllProjects();
          if (cancelled) return;

          if (supaProjects.length > 0) {
            const localProjects = localData?.projects || [];
            const hasDirtyOps = getDirtyCount() > 0;

            // Build merged list: Supabase is primary
            const merged = [];
            const seenIds = new Set<string>();

            // All Supabase projects, enriched with local-only tracking cells
            for (const sp of supaProjects) {
              seenIds.add(sp.id);
              const lp = localProjects.find((l) => l.id === sp.id);
              if (lp && hasDirtyOps) {
                // Merge: remote base + local-only cells (dirty offline changes)
                merged.push({ ...sp, tracking: mergeTracking(sp.tracking, lp.tracking) });
              } else {
                // No dirty ops — use Supabase data as-is
                merged.push(sp);
              }
            }

            // Local-only projects (not in Supabase yet) — push them
            for (const lp of localProjects) {
              if (!seenIds.has(lp.id)) {
                merged.push(lp);
                withRetry(() => fullProjectSync(lp, userId));
              }
            }

            console.log(`[DataLayer] Loaded ${merged.length} projects (Supabase primary${hasDirtyOps ? " + local dirty merge" : ""})`);
            setDb({ projects: merged });
            saveDB({ projects: merged });

            // Push dirty ops to Supabase in background
            if (hasDirtyOps) {
              console.log(`[DataLayer] ${getDirtyCount()} dirty ops, pushing to Supabase...`);
              Promise.all(merged.map((p) => withRetry(() => fullProjectSync(p, userId)))).then((results) => {
                if (results.every((r) => r.ok)) {
                  clearAllDirty();
                  console.log("[DataLayer] All dirty ops synced successfully");
                }
              });
            }
          } else if (localData?.projects?.length) {
            // Supabase empty but we have local data — push it
            console.warn("[DataLayer] Supabase empty, using local data and pushing");
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

  // Reload: fetch from Supabase and update
  const reload = useCallback(async () => {
    if (mode !== "supabase") return;
    try {
      const supaProjects = await loadAllProjects();
      if (!supaProjects.length) return;

      const hasDirtyOps = getDirtyCount() > 0;
      let finalProjects;

      if (hasDirtyOps) {
        const localData = loadDB();
        const localProjects = localData?.projects || [];
        finalProjects = supaProjects.map((sp) => {
          const lp = localProjects.find((l) => l.id === sp.id);
          return lp ? { ...sp, tracking: mergeTracking(sp.tracking, lp.tracking) } : sp;
        });
        // Add local-only projects
        for (const lp of localProjects) {
          if (!supaProjects.find((sp) => sp.id === lp.id)) {
            finalProjects.push(lp);
          }
        }
      } else {
        finalProjects = supaProjects;
      }

      console.log(`[DataLayer] Reload: ${finalProjects.length} projects from Supabase`);
      setDb({ projects: finalProjects });
      saveDB({ projects: finalProjects });
    } catch (err) {
      console.error("[DataLayer] Reload failed:", err);
    }
  }, [mode]);

  // Force push all local projects to Supabase
  const dbRef = useRef(db);
  dbRef.current = db;

  const forceSync = useCallback(async () => {
    const currentDb = dbRef.current;
    if (mode !== "supabase" || !currentDb?.projects?.length || !userId) {
      return { ok: false, error: "Not configured" };
    }
    const freshDb = loadDB();
    const projectsToSync = freshDb?.projects?.length ? freshDb.projects : currentDb.projects;
    const errors = [];
    for (const p of projectsToSync) {
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
  }, [mode, userId]);

  // Force pull: replace local data with Supabase data
  const forcePull = useCallback(async () => {
    if (mode !== "supabase") return { ok: false, error: "Not configured" };
    try {
      const supaProjects = await loadAllProjects();
      if (!supaProjects.length) return { ok: false, error: "Aucun projet trouvé sur Supabase" };
      const newDb = { projects: supaProjects };
      setDb(newDb);
      saveDB(newDb);
      clearAllDirty();
      console.log(`[DataLayer] Force pull OK: ${supaProjects.length} projects from Supabase`);
      return { ok: true };
    } catch (err) {
      console.error("[DataLayer] Force pull failed:", err);
      return { ok: false, error: err.message || String(err) };
    }
  }, [mode]);

  // Auto-sync: every 30 seconds if there are dirty ops, and every 2 minutes full sync
  const forceSyncRef = useRef(forceSync);
  forceSyncRef.current = forceSync;

  useEffect(() => {
    if (mode !== "supabase") return;

    // Quick sync every 30s for dirty ops
    const quickInterval = setInterval(() => {
      if (!navigator.onLine || getDirtyCount() === 0) return;

      forceSyncRef.current().then((result) => {
        if (result.ok) {
          clearAllDirty();
          console.log("[AutoSync] Quick sync completed");
        }
      });
    }, 30_000);

    // Full pull every 2 minutes to catch other users' changes
    const fullInterval = setInterval(() => {
      if (!navigator.onLine) return;

      loadAllProjects().then((supaProjects) => {
        if (supaProjects?.length) {
          const newDb = { projects: supaProjects };
          setDb(newDb);
          saveDB(newDb);
          console.log("[AutoSync] Full pull completed");
        }
      }).catch(() => {});
    }, 120_000);

    return () => {
      clearInterval(quickInterval);
      clearInterval(fullInterval);
    };
  }, [mode]);

  return { db, setDb, loading, error, mode, reload, forceSync, forcePull };
}
