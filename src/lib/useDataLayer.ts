// ─── React Hook: Unified Data Layer ─────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB, getLocalTimestamp } from "./db";
import { loadAllProjects, fullProjectSync } from "./dataLayer";
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
                    fullProjectSync(p, userId).catch(console.error);
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

  // Reload from Supabase
  const reload = useCallback(async () => {
    if (mode !== "supabase") return;
    try {
      const projects = await loadAllProjects();
      setDb({ projects });
      saveDB({ projects });
    } catch (err) {
      console.error("Reload failed:", err);
    }
  }, [mode]);

  return { db, setDb, loading, error, mode, reload };
}
