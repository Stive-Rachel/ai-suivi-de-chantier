// ─── React Hook: Unified Data Layer ─────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB, getLocalTimestamp } from "./db";
import { loadAllProjects, fullProjectSync, withRetry } from "./dataLayer";
import { migrateLocalStorageToSupabase, backupLocalData, restoreFromBackup } from "./migration";

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
          const localTimestamp = getLocalTimestamp();

          await migrateLocalStorageToSupabase(userId);

          const projects = await loadAllProjects();
          if (!cancelled) {
            if (projects.length > 0) {
              // If local data is more recent, push it to Supabase instead of overwriting
              if (localData?.projects?.length && localTimestamp > 0) {
                const supabaseTimestamp = projects.reduce((max, p) => {
                  const t = new Date(p.updatedAt || p.createdAt || 0).getTime();
                  return t > max ? t : max;
                }, 0);

                if (localTimestamp > supabaseTimestamp) {
                  console.warn("[DataLayer] Local data is newer than Supabase, pushing local data");
                  setDb(localData);
                  for (const p of localData.projects) {
                    withRetry(() => fullProjectSync(p, userId)).then(({ ok }) => {
                      if (!ok) console.error("[DataLayer] Failed to push local project to Supabase:", p.id);
                    });
                  }
                  return;
                }
              }

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
      const localTimestamp = getLocalTimestamp();
      const projects = await loadAllProjects();
      // Never overwrite local data with an empty result
      if (!projects.length) {
        console.warn("[DataLayer] Reload skipped: Supabase returned empty");
        return;
      }
      // Only overwrite if Supabase data is newer than local
      const supabaseTimestamp = projects.reduce((max, p) => {
        const t = new Date(p.updatedAt || p.createdAt || 0).getTime();
        return t > max ? t : max;
      }, 0);
      if (localTimestamp > supabaseTimestamp) {
        console.warn("[DataLayer] Reload skipped: local data is newer");
        return;
      }
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

  return { db, setDb, loading, error, mode, reload, forceSync };
}
