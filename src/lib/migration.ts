// ─── localStorage → Supabase Migration ──────────────────────────────────────
// SAFETY: This module NEVER deletes or overwrites localStorage data.
// localStorage is only cleared after a VERIFIED successful migration.

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import { createProjectInDB } from "./dataLayer";

const MIGRATION_KEY = "construction_tracker_migrated_v1";
const BACKUP_KEY = "construction_tracker_backup";

/** Create a safety backup of localStorage data before any risky operation */
export function backupLocalData() {
  const data = loadDB();
  if (data?.projects?.length) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
  }
}

/** Restore data from backup if main storage was wiped */
export function restoreFromBackup() {
  const backup = localStorage.getItem(BACKUP_KEY);
  if (backup) {
    try {
      const data = JSON.parse(backup);
      if (data?.projects?.length) {
        saveDB(data);
        return data;
      }
    } catch (e) {
      console.error("Backup restore failed:", e);
    }
  }
  return null;
}

export async function migrateLocalStorageToSupabase(userId) {
  if (!isSupabaseConfigured() || !supabase) return false;
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  const localData = loadDB();
  if (!localData?.projects?.length) {
    // No local data to migrate — but do NOT set migration key if there's no data,
    // in case data appears later (e.g. from a backup restore)
    return false;
  }

  // SAFETY: backup before attempting migration
  backupLocalData();

  // Check if there are already projects in Supabase
  const { data: existing, error: checkError } = await supabase
    .from("projects")
    .select("id")
    .limit(1);

  if (checkError) {
    console.error("Migration check failed:", checkError);
    return false;
  }

  if (existing && existing.length > 0) {
    // Data already exists in Supabase, skip migration
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    return false;
  }

  try {
    for (const project of localData.projects) {
      await createProjectInDB(project, userId);
    }

    // VERIFY migration succeeded by reading back from Supabase
    const { data: verify } = await supabase
      .from("projects")
      .select("id")
      .limit(1);

    if (!verify?.length) {
      console.error("Migration verification failed: no data in Supabase after insert");
      return false;
    }

    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    console.log(`Migrated ${localData.projects.length} project(s) to Supabase`);
    return true;
  } catch (err) {
    console.error("Migration failed:", err);
    // SAFETY: never set migration key on failure — allow retry
    return false;
  }
}
