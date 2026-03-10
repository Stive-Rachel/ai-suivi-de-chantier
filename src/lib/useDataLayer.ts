// ─── React Hook: Unified Data Layer ─────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import { loadAllProjects, fullProjectSync, withRetry } from "./dataLayer";
import { migrateLocalStorageToSupabase, backupLocalData, restoreFromBackup } from "./migration";
import { getDirtyCount, clearAllDirty } from "./dirtyTracker";

export function useDataLayer(userId) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(isSupabaseConfigured() ? "supabase" : "local");

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (mode === "supabase" && userId) {
          backupLocalData();
          const localData = loadDB();

          await migrateLocalStorageToSupabase(userId);

          const projects = await loadAllProjects();
          if (!cancelled) {
            if (projects.length > 0) {
              // Supabase is the source of truth — always use it when available.
              // Only push local data if there are dirty (unsynced) operations.
              const dirtyCount = getDirtyCount();
              if (dirtyCount > 0 && localData?.projects?.length) {
                console.warn(`[DataLayer] ${dirtyCount} dirty ops found, pushing local data to Supabase`);
                setDb(localData);
                for (const p of localData.projects) {
                  withRetry(() => fullProjectSync(p, userId)).then(({ ok }) => {
                    if (ok) {
                      clearAllDirty();
                      console.log("[DataLayer] Local data pushed to Supabase OK");
                    } else {
                      console.error("[DataLayer] Failed to push local project to Supabase:", p.id);
                    }
                  });
                }
                return;
              }

              console.log(`[DataLayer] Loaded ${projects.length} projects from Supabase`);
              setDb({ projects });
              saveDB({ projects });
            } else if (localData?.projects?.length) {
              console.warn("Supabase returned empty but local data exists, keeping local data");
              setDb(localData);
            } else {
              const restored = restoreFromBackup();
              if (restored?.projects?.length) {
                console.warn("Restored data from backup");
                setDb(restored);
              } else {
                setDb({ projects });
              }
            }
          }
        } else {
          if (!cancelled) setDb(loadDB());
        }
      } catch (err) {
        console.error("Supabase load failed, falling back to localStorage:", err);
        if (!cancelled) {
          setError(err);
          setMode("local");
          const localData = loadDB();
          if (localData?.projects?.length) {
            setDb(localData);
          } else {
            const restored = restoreFromBackup();
            setDb(restored || loadDB());
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [userId, mode]);

  // Reload from Supabase (respects local timestamp, never overwrites with empty)
  const reload = useCallback(async () => {
    if (mode !== "supabase") return;
    try {
      const projects = await loadAllProjects();
      if (!projects.length) {
        console.warn("[DataLayer] Reload skipped: Supabase returned empty");
        return;
      }
      // Supabase is source of truth — always use it on reload
      console.log(`[DataLayer] Reload: ${projects.length} projects from Supabase`);
      setDb({ projects });
      saveDB({ projects });
    } catch (err) {
      console.error("Reload failed:", err);
    }
  }, [mode]);

  // Force push all local projects to Supabase
  const forceSync = useCallback(async () => {
    if (mode !== "supabase" || !db?.projects?.length || !userId) return { ok: false, error: "Not configured" };
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
