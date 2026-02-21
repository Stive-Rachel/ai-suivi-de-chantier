// ─── localStorage → Supabase Migration ──────────────────────────────────────

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { loadDB } from "./db";
import { createProjectInDB } from "./dataLayer";

const MIGRATION_KEY = "construction_tracker_migrated_v1";

export async function migrateLocalStorageToSupabase(userId) {
  if (!isSupabaseConfigured() || !supabase) return false;
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  const localData = loadDB();
  if (!localData?.projects?.length) {
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    return false;
  }

  // Check if user already has projects in Supabase
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .limit(1);

  if (existing && existing.length > 0) {
    // User already has data in Supabase, skip migration
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    return false;
  }

  try {
    for (const project of localData.projects) {
      await createProjectInDB(project, userId);
    }
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    console.log(`Migrated ${localData.projects.length} project(s) to Supabase`);
    return true;
  } catch (err) {
    console.error("Migration failed:", err);
    return false;
  }
}
