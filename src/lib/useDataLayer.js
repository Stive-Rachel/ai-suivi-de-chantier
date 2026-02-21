// ─── React Hook: Unified Data Layer ─────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import { loadAllProjects } from "./dataLayer";
import { migrateLocalStorageToSupabase } from "./migration";

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
          // Try migrating localStorage data first
          await migrateLocalStorageToSupabase(userId);

          const projects = await loadAllProjects();
          if (!cancelled) {
            setDb({ projects });
            // Keep localStorage in sync as backup
            saveDB({ projects });
          }
        } else if (mode === "local") {
          if (!cancelled) setDb(loadDB());
        }
      } catch (err) {
        console.error("Supabase load failed, falling back to localStorage:", err);
        if (!cancelled) {
          setError(err);
          setMode("local");
          setDb(loadDB());
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
