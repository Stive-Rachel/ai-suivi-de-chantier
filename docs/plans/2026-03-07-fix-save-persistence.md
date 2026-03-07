# Fix Save Persistence Bug — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where modifications are lost after page refresh because Supabase writes fail silently and then stale Supabase data overwrites localStorage on reload.

**Architecture:** Three-pronged fix: (1) remove migrateProject seed resets that overwrite user data, (2) add _lastModified timestamp to localStorage and compare before overwriting, (3) replace silent .catch(console.error) with retry + user notification on Supabase write failures. Adds throwIfError to unguarded delete calls in dataLayer.

**Tech Stack:** React, Supabase JS, localStorage, TypeScript/JSX

---

### Task 1: Remove destructive seed resets in migrateProject

**Files:**
- Modify: `src/lib/db.ts:7-55`

**Step 1: Read the current migrateProject function**

Understand the current logic in `src/lib/db.ts`. The function `migrateProject` resets `lots`, `lotsExt`, and `lotsInt` to seed data when array lengths differ from `initialData.json`. This destroys user modifications.

**Step 2: Edit migrateProject to only fill missing fields, never overwrite existing data**

Replace the function body. The key changes:
- Remove the block at line 24-26 that resets `lots` when all montants are 0
- Remove the `needsSync` logic (lines 28-44) that resets `lotsExt`/`lotsInt` when lengths differ from seed
- Keep only the "fill undefined fields" logic (the `def()` calls at lines 46-53) — these are safe

```ts
function migrateProject(p: any): Project {
  const seed = initialData.projects.find((s) => s.id === p.id);

  // Only create lots array if it doesn't exist at all
  if (!p.lots) {
    if (seed && seed.lots) {
      p.lots = JSON.parse(JSON.stringify(seed.lots));
    } else {
      const numeros = new Set<string>();
      [...(p.lotsInt || []), ...(p.lotsExt || [])].forEach((l: any) => numeros.add(l.numero));
      p.lots = [...numeros].map((num) => {
        const intLots = (p.lotsInt || []).filter((l: any) => l.numero === num);
        const extLots = (p.lotsExt || []).filter((l: any) => l.numero === num);
        const nom = (intLots[0] || extLots[0] || {}).nom || "";
        return { numero: num, nom, montantMarche: 0, montantExt: 0, montantInt: 0 };
      });
    }
  }

  // Only seed lotsExt/lotsInt if completely missing
  if (seed) {
    if (!p.lotsExt && seed.lotsExt) {
      p.lotsExt = JSON.parse(JSON.stringify(seed.lotsExt));
    }
    if (!p.lotsInt && seed.lotsInt) {
      p.lotsInt = JSON.parse(JSON.stringify(seed.lotsInt));
    }
  }

  const def = (field: string, fallback: any) => {
    if (p[field] === undefined) p[field] = (seed as any)?.[field] ?? fallback;
  };
  def("montantTotal", 0); def("dateDebutChantier", ""); def("dureeTotale", 0);
  def("montantExt", 0); def("montantInt", 0);
  def("dureeExt", 0); def("dureeInt", 0);
  def("dateDebutInt", ""); def("dateDebutExt", "");
  def("semainesExclues", 0); def("semainesTravaillees", 0);
  return p as Project;
}
```

Key difference in `def`: changed `p[field] === undefined || (p[field] === 0 && seed?.[...])` to just `p[field] === undefined`. Never overwrite a user-set value of 0 with seed data.

**Step 3: Verify the app still loads**

Run: `cd "/Users/stive/Library/Mobile Documents/com~apple~CloudDocs/Superpower/construction-tracker" && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "fix: stop migrateProject from resetting user data to seed values"
```

---

### Task 2: Add _lastModified timestamp to saveDB

**Files:**
- Modify: `src/lib/db.ts:76-78`

**Step 1: Update saveDB to include a timestamp**

```ts
export function saveDB(db: DB): void {
  const withTimestamp = { ...db, _lastModified: Date.now() };
  localStorage.setItem(DB_KEY, JSON.stringify(withTimestamp));
}
```

**Step 2: Add a helper to read the timestamp**

Add after `saveDB`:

```ts
export function getLocalTimestamp(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    return raw._lastModified || 0;
  } catch {
    return 0;
  }
}
```

**Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add _lastModified timestamp to localStorage saves"
```

---

### Task 3: Protect localStorage from Supabase overwrite on reload

**Files:**
- Modify: `src/lib/useDataLayer.ts:16-51`

**Step 1: Read the current file**

Read `src/lib/useDataLayer.ts` to understand the init logic.

**Step 2: Update the init function to compare timestamps**

Import `getLocalTimestamp` from `./db`. Before overwriting localStorage with Supabase data, check if local data is newer. If it is, push local data to Supabase instead.

```ts
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
                  // Re-sync each project to Supabase in background
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
```

Note: `fullProjectSync` needs to be exported (already is in dataLayer.ts). We also need `updatedAt` from the project rows — check that `rowToProject` passes it through. If not, we fall back to `createdAt`.

**Step 3: Ensure rowToProject includes updatedAt**

Check `src/lib/supabaseOps.ts` — add `updatedAt: row.updated_at` to the `rowToProject` return object if missing.

**Step 4: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/lib/useDataLayer.ts src/lib/supabaseOps.ts
git commit -m "fix: protect localStorage from being overwritten by stale Supabase data"
```

---

### Task 4: Add throwIfError to unguarded deletes in dataLayer

**Files:**
- Modify: `src/lib/dataLayer.ts:179,191,203`

**Step 1: Read the current file**

Read `src/lib/dataLayer.ts` and find the 3 delete calls without `throwIfError`.

**Step 2: Wrap deletes with throwIfError**

In `syncBatiments` (line 179):
```ts
throwIfError(await supabase.from("batiments").delete().eq("project_id", projectId));
```

In `syncLots` (line 191):
```ts
throwIfError(await supabase.from("lots").delete().eq("project_id", projectId));
```

In `syncLotsDecomp` (line 203):
```ts
throwIfError(await supabase.from("lots_decomp").delete().eq("project_id", projectId));
```

**Step 3: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/dataLayer.ts
git commit -m "fix: add error checking to delete operations in dataLayer"
```

---

### Task 5: Replace silent .catch(console.error) with retry + notification

**Files:**
- Modify: `src/components/ProjectView.tsx:59-75`
- Modify: `src/components/Dashboard.tsx` (similar pattern)

**Step 1: Create a retry helper in dataLayer.ts**

Add at the top of `src/lib/dataLayer.ts`:

```ts
// Retry wrapper: try once, wait 2s, retry once. Returns { ok, error }.
async function withRetry(fn: () => Promise<void>): Promise<{ ok: boolean; error?: any }> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    console.warn("[DataLayer] First attempt failed, retrying in 2s...", err);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      await fn();
      return { ok: true };
    } catch (retryErr) {
      console.error("[DataLayer] Retry also failed:", retryErr);
      return { ok: false, error: retryErr };
    }
  }
}
```

Export it: `export { withRetry };`

**Step 2: Update supaSync in ProjectView.tsx**

Replace the supaSync useMemo block. Instead of `.catch(console.error)`, use `withRetry` and track failures in a state variable.

Add state at the top of ProjectView:
```ts
const [saveError, setSaveError] = useState<string | null>(null);
```

Import `withRetry` from dataLayer.

Replace supaSync:
```ts
const supaSync = useMemo(() => {
  const safe = (label: string, fn: () => Promise<void>) => {
    withRetry(fn).then(({ ok, error }) => {
      if (!ok) {
        setSaveError(`Erreur de sauvegarde (${label}). Les modifications sont conservees localement.`);
        setTimeout(() => setSaveError(null), 8000);
      }
    });
  };
  return {
    updateFields: (fields: any) =>
      safe("champs", () => dataLayer.updateProjectFields(project.id, fields)),
    setTrackingCell: (trackType: string, rowKey: string, entityId: string, status: string) =>
      safe("cellule", () => dataLayer.setTrackingCell(project.id, trackType, rowKey, entityId, status)),
    setTrackingMeta: (trackType: string, rowKey: string, meta: any) =>
      safe("meta", () => dataLayer.setTrackingMeta(project.id, trackType, rowKey, meta)),
    syncBatiments: (batiments: any) =>
      safe("batiments", () => dataLayer.syncBatiments(project.id, batiments)),
    syncLots: (lots: any) =>
      safe("lots", () => dataLayer.syncLots(project.id, lots)),
    syncLotsDecomp: (lotsInt: any, lotsExt: any) =>
      safe("decomp", () => dataLayer.syncLotsDecomp(project.id, lotsInt, lotsExt)),
    fullSync: (p: any) =>
      safe("sync", () => dataLayer.fullProjectSync(p, userId)),
  };
}, [project.id, userId]);
```

**Step 3: Add error banner in the JSX**

Add right after the `<header>` in the return JSX:

```tsx
{saveError && (
  <div style={{
    background: "var(--warning, #f59e0b)",
    color: "#000",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    textAlign: "center",
    cursor: "pointer",
  }} onClick={() => setSaveError(null)}>
    {saveError}
  </div>
)}
```

**Step 4: Apply the same pattern to Dashboard.tsx**

Read `src/components/Dashboard.tsx` and replace the 4 `.catch(console.error)` calls with the same `withRetry` + error notification pattern. Use a `saveError` state + banner like in ProjectView.

**Step 5: Verify build**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/lib/dataLayer.ts src/components/ProjectView.tsx src/components/Dashboard.tsx
git commit -m "fix: replace silent catch with retry + user notification on save failure"
```

---

### Task 6: Final verification

**Step 1: Full build check**

Run: `npx vite build 2>&1 | tail -10`
Expected: Build succeeds with no errors

**Step 2: Run existing tests**

Run: `npx vitest run 2>&1`
Expected: All tests pass

**Step 3: Manual verification checklist**

- [ ] Open app, modify a project name, refresh → name persists
- [ ] Change tracking cells (X, NOK), refresh → cells persist
- [ ] Add a batiment, refresh → batiment persists
- [ ] Add a decomposition, refresh → decomposition persists
- [ ] Disconnect network, make a change, reconnect → change syncs
- [ ] Check console for any Supabase errors being surfaced

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve save persistence bug — prevent data loss on refresh"
```
