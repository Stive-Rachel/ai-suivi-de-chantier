// ─── React Hook: Unified Data Layer ─────────────────────────────────────────
//
// STRATEGY: Supabase is the SOURCE OF TRUTH when online.
//   - On load: fetch Supabase first, merge with any local-only changes
//   - On mutation: save to localStorage immediately, push to Supabase async
//   - Supabase Realtime: listen for changes from other users in real-time
//   - localStorage serves as offline cache and instant display while fetching
//
// This ensures all users always see the latest data from the server.

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
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
        result[trackType][rowKey] = rowData;
      } else {
        for (const [entityId, cell] of Object.entries(rowData)) {
          const existing = result[trackType][rowKey][entityId];
          if (!existing) {
            result[trackType][rowKey][entityId] = cell;
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
      const localData = loadDB();

      try {
        if (mode === "supabase" && userId) {
          backupLocalData();
          await migrateLocalStorageToSupabase(userId);

          if (!cancelled && localData?.projects?.length) {
            setDb(localData);
          }

          const supaProjects = await loadAllProjects();
          if (cancelled) return;

          if (supaProjects.length > 0) {
            const localProjects = localData?.projects || [];
            const hasDirtyOps = getDirtyCount() > 0;

            const merged = [];
            const seenIds = new Set<string>();

            for (const sp of supaProjects) {
              seenIds.add(sp.id);
              const lp = localProjects.find((l) => l.id === sp.id);
              if (lp && hasDirtyOps) {
                merged.push({ ...sp, tracking: mergeTracking(sp.tracking, lp.tracking) });
              } else {
                merged.push(sp);
              }
            }

            for (const lp of localProjects) {
              if (!seenIds.has(lp.id)) {
                merged.push(lp);
                withRetry(() => fullProjectSync(lp, userId));
              }
            }

            console.log(`[DataLayer] Loaded ${merged.length} projects (Supabase primary${hasDirtyOps ? " + local dirty merge" : ""})`);
            setDb({ projects: merged });
            saveDB({ projects: merged });

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

  // ── Supabase Realtime: listen for changes from other users ──────────────
  useEffect(() => {
    if (mode !== "supabase" || !supabase) return;

    // Debounce: when we receive a realtime event, wait 1s then reload
    // (groups rapid changes into a single reload)
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(async () => {
        try {
          const supaProjects = await loadAllProjects();
          if (supaProjects?.length) {
            const newDb = { projects: supaProjects };
            setDb(newDb);
            saveDB(newDb);
            console.log("[Realtime] Updated from Supabase");
          }
        } catch (err) {
          console.warn("[Realtime] Reload failed:", err);
        }
      }, 1000);
    };

    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_cells" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_meta" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "lots_decomp" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "batiments" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "lots" }, scheduleReload)
      .subscribe((status) => {
        console.log(`[Realtime] Subscription: ${status}`);
      });

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [mode]);

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

  // Safety net: retry dirty ops every 5 minutes (only if individual pushes failed)
  const forceSyncRef = useRef(forceSync);
  forceSyncRef.current = forceSync;

  useEffect(() => {
    if (mode !== "supabase") return;

    const intervalId = setInterval(() => {
      if (!navigator.onLine || getDirtyCount() === 0) return;

      forceSyncRef.current().then((result) => {
        if (result.ok) {
          clearAllDirty();
          console.log("[AutoSync] Dirty ops synced");
        }
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [mode]);

  return { db, setDb, loading, error, mode, reload, forceSync, forcePull };
}
