// ─── React Hook: Unified Data Layer ─────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import { loadAllProjects } from "./dataLayer";
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
          // SAFETY: always backup before any Supabase operation
          backupLocalData();
          const localBackup = loadDB();

          // Try migrating localStorage data first
          await migrateLocalStorageToSupabase(userId);

          const projects = await loadAllProjects();
          if (!cancelled) {
            if (projects.length > 0) {
              setDb({ projects });
              // Keep localStorage in sync as backup
              saveDB({ projects });
            } else if (localBackup?.projects?.length) {
              // SAFETY: Supabase is empty but we had local data — never wipe it
              console.warn("Supabase returned empty but local data exists, keeping local data");
              setDb(localBackup);
              // Don't call saveDB — it's already there
            } else {
              // Try restoring from backup in case localStorage was wiped
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
          // Fallback: localStorage (mode local, or supabase without userId yet)
          if (!cancelled) setDb(loadDB());
        }
      } catch (err) {
        console.error("Supabase load failed, falling back to localStorage:", err);
        if (!cancelled) {
          setError(err);
          setMode("local");
          // Try main localStorage first, then backup
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
