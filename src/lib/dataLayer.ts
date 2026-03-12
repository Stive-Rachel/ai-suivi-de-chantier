// ─── Unified Data Layer ─────────────────────────────────────────────────────
// Delegates to Supabase when configured, otherwise falls back to localStorage.
// All functions are async for consistency.
// When offline, operations are enqueued via syncQueue for later replay.

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { loadDB, saveDB } from "./db";
import {
  projectToRow,
  rowToProject,
  batimentToRow,
  lotToRow,
  lotDecompToRow,
  trackingToRows,
  rowsToTracking,
} from "./supabaseOps";
import { enqueue } from "./syncQueue";

// ── Helpers ─────────────────────────────────────────────────────────────────

export async function withRetry(fn: () => Promise<void>): Promise<{ ok: boolean; error?: unknown }> {
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

function throwIfError(result) {
  if (result.error) throw result.error;
  return result.data;
}

/**
 * Check if we should enqueue rather than send now.
 * Returns true if offline AND Supabase is configured (otherwise nothing to queue).
 */
function shouldEnqueue() {
  return isSupabaseConfigured() && typeof navigator !== "undefined" && !navigator.onLine;
}

// ── Paginated fetch (Supabase default limit is 1000) ────────────────────────

async function fetchAll(query) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Load All Projects ───────────────────────────────────────────────────────

export async function loadAllProjects() {
  if (!isSupabaseConfigured()) {
    return loadDB().projects;
  }

  const projects = throwIfError(
    await supabase.from("projects").select("*").order("created_at", { ascending: false })
  );

  if (!projects.length) return [];

  const projectIds = projects.map((p) => p.id);

  const [bats, lots, decomps, cells, metas] = await Promise.all([
    fetchAll(supabase.from("batiments").select("*").in("project_id", projectIds).order("sort_order")),
    fetchAll(supabase.from("lots").select("*").in("project_id", projectIds).order("sort_order")),
    fetchAll(supabase.from("lots_decomp").select("*").in("project_id", projectIds).order("sort_order")),
    fetchAll(supabase.from("tracking_cells").select("*").in("project_id", projectIds)),
    fetchAll(supabase.from("tracking_meta").select("*").in("project_id", projectIds)),
  ]);

  return projects.map((pRow) => {
    const pid = pRow.id;
    const tracking = rowsToTracking(
      cells.filter((c) => c.project_id === pid),
      metas.filter((m) => m.project_id === pid)
    );
    return rowToProject(
      pRow,
      bats.filter((b) => b.project_id === pid),
      lots.filter((l) => l.project_id === pid),
      decomps.filter((d) => d.project_id === pid),
      tracking
    );
  });
}

// ── Create Project ──────────────────────────────────────────────────────────

export async function createProjectInDB(project, userId) {
  if (!isSupabaseConfigured()) {
    const db = loadDB();
    db.projects.push(project);
    saveDB(db);
    return;
  }

  const errors: string[] = [];

  // Insert project (required — fail fast if this fails)
  throwIfError(await supabase.from("projects").upsert(projectToRow(project, userId)));

  // Insert batiments
  if (project.batiments?.length) {
    const rows = project.batiments.map((b, i) => batimentToRow(b, project.id, i));
    const res = await supabase.from("batiments").upsert(rows);
    if (res.error) {
      console.error("[DataLayer] batiments upsert failed:", res.error);
      errors.push("batiments");
    }
  }

  // Insert lots
  if (project.lots?.length) {
    const rows = project.lots.map((l, i) => lotToRow(l, project.id, i));
    const res = await supabase.from("lots").upsert(rows, { onConflict: "project_id,numero" });
    if (res.error) {
      console.error("[DataLayer] lots upsert failed:", res.error);
      errors.push("lots");
    }
  }

  // Insert decomp — deduplicate by (type, track_prefix) to avoid UNIQUE violations
  const decompRows = [];
  for (const [type, arr] of [["int", project.lotsInt], ["ext", project.lotsExt]]) {
    (arr || []).forEach((d, i) => decompRows.push(lotDecompToRow(d, type, project.id, i)));
  }
  const seen = new Set<string>();
  const uniqueDecompRows = decompRows.filter((r) => {
    const key = `${r.type}:${r.track_prefix}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (uniqueDecompRows.length) {
    console.log(`[DataLayer] Upserting ${uniqueDecompRows.length} lots_decomp rows for ${project.id}`);
    const res = await supabase.from("lots_decomp").upsert(uniqueDecompRows, { onConflict: "project_id,type,track_prefix" });
    if (res.error) {
      console.error("[DataLayer] lots_decomp upsert failed:", res.error);
      console.error("[DataLayer] First row sample:", JSON.stringify(uniqueDecompRows[0]));
      errors.push("lots_decomp");
    } else {
      console.log(`[DataLayer] lots_decomp upsert OK: ${uniqueDecompRows.length} rows`);
    }
  } else {
    console.warn("[DataLayer] No decomp rows to insert for", project.id,
      "lotsInt:", (project.lotsInt || []).length, "lotsExt:", (project.lotsExt || []).length);
  }

  // Insert tracking
  if (project.tracking) {
    const { cells, meta } = trackingToRows(project.id, project.tracking);
    console.log(`[DataLayer] Tracking for ${project.id}: ${cells.length} cells, ${meta.length} meta rows`);
    if (cells.length) {
      const BATCH = 500;
      for (let i = 0; i < cells.length; i += BATCH) {
        const batch = cells.slice(i, i + BATCH);
        const res = await supabase.from("tracking_cells").upsert(batch);
        if (res.error) {
          console.error("[DataLayer] tracking_cells upsert failed:", res.error);
          console.error("[DataLayer] Sample cell:", JSON.stringify(batch[0]));
          errors.push("tracking_cells");
        } else {
          console.log(`[DataLayer] tracking_cells batch OK: ${batch.length} rows (${i + batch.length}/${cells.length})`);
        }
      }
    }
    if (meta.length) {
      const res = await supabase.from("tracking_meta").upsert(meta);
      if (res.error) {
        console.error("[DataLayer] tracking_meta upsert failed:", res.error);
        errors.push("tracking_meta");
      } else {
        console.log(`[DataLayer] tracking_meta OK: ${meta.length} rows`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`[DataLayer] createProjectInDB partial failure: ${errors.join(", ")}`);
    throw new Error(`Sync partielle: ${errors.join(", ")} en erreur`);
  }
}

// ── Delete Project ──────────────────────────────────────────────────────────

export async function deleteProjectFromDB(projectId) {
  if (!isSupabaseConfigured()) {
    const db = loadDB();
    db.projects = db.projects.filter((p) => p.id !== projectId);
    saveDB(db);
    return;
  }

  if (shouldEnqueue()) {
    enqueue({ type: "deleteProjectFromDB", args: [projectId] });
    return;
  }

  // CASCADE handles child rows
  throwIfError(await supabase.from("projects").delete().eq("id", projectId));
}

// ── Update Project Fields ───────────────────────────────────────────────────

export async function updateProjectFields(projectId, fields) {
  if (!isSupabaseConfigured()) return; // localStorage handled by caller

  if (shouldEnqueue()) {
    enqueue({ type: "updateProjectFields", args: [projectId, fields] });
    return;
  }

  const dbFields = {};
  const fieldMap = {
    name: "name",
    location: "location",
    client: "client",
    montantTotal: "montant_total",
    montantExt: "montant_ext",
    montantInt: "montant_int",
    dateDebutChantier: "date_debut_chantier",
    dureeTotale: "duree_totale",
    dureeExt: "duree_ext",
    dureeInt: "duree_int",
    dateDebutInt: "date_debut_int",
    dateDebutExt: "date_debut_ext",
    semainesExclues: "semaines_exclues",
    semainesTravaillees: "semaines_travaillees",
    exceptions: "exceptions",
  };

  for (const [appKey, dbKey] of Object.entries(fieldMap)) {
    if (appKey in fields) dbFields[dbKey] = fields[appKey];
  }

  if (Object.keys(dbFields).length > 0) {
    throwIfError(await supabase.from("projects").update(dbFields).eq("id", projectId));
  }
}

// ── Batiments CRUD ──────────────────────────────────────────────────────────

export async function syncBatiments(projectId, batiments) {
  if (!isSupabaseConfigured()) return;

  if (shouldEnqueue()) {
    enqueue({ type: "syncBatiments", args: [projectId, batiments] });
    return;
  }

  // Upsert first (safe), then delete extras (if upsert fails, old data stays)
  const rows = batiments.map((b, i) => batimentToRow(b, projectId, i));
  if (rows.length) {
    throwIfError(await supabase.from("batiments").upsert(rows));
  }
  const keepIds = batiments.map((b) => b.id);
  if (keepIds.length) {
    throwIfError(await supabase.from("batiments").delete().eq("project_id", projectId).not("id", "in", `(${keepIds.join(",")})`));
  } else {
    throwIfError(await supabase.from("batiments").delete().eq("project_id", projectId));
  }
}

// ── Lots CRUD ───────────────────────────────────────────────────────────────

export async function syncLots(projectId, lots) {
  if (!isSupabaseConfigured()) return;

  if (shouldEnqueue()) {
    enqueue({ type: "syncLots", args: [projectId, lots] });
    return;
  }

  const rows = lots.map((l, i) => lotToRow(l, projectId, i));
  if (rows.length) {
    throwIfError(await supabase.from("lots").upsert(rows, { onConflict: "project_id,numero" }));
  }
  const keepNumeros = lots.map((l) => l.numero);
  if (keepNumeros.length) {
    throwIfError(await supabase.from("lots").delete().eq("project_id", projectId).not("numero", "in", `(${keepNumeros.join(",")})`));
  } else {
    throwIfError(await supabase.from("lots").delete().eq("project_id", projectId));
  }
}

// ── Lots Decomp CRUD ────────────────────────────────────────────────────────

export async function syncLotsDecomp(projectId, lotsInt, lotsExt) {
  if (!isSupabaseConfigured()) return;

  if (shouldEnqueue()) {
    enqueue({ type: "syncLotsDecomp", args: [projectId, lotsInt, lotsExt] });
    return;
  }

  const rows = [];
  (lotsInt || []).forEach((d, i) => rows.push(lotDecompToRow(d, "int", projectId, i)));
  (lotsExt || []).forEach((d, i) => rows.push(lotDecompToRow(d, "ext", projectId, i)));
  // Deduplicate by (type, track_prefix) to avoid UNIQUE violations
  const seenKeys = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const key = `${r.type}:${r.track_prefix}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  if (uniqueRows.length) {
    throwIfError(await supabase.from("lots_decomp").upsert(uniqueRows, { onConflict: "project_id,type,track_prefix" }));
  }
  const keepPrefixes = uniqueRows.map((r) => `${r.type}:${r.track_prefix}`);
  // Delete rows that are no longer in the current list
  const existing = throwIfError(
    await supabase.from("lots_decomp").select("id,type,track_prefix").eq("project_id", projectId)
  );
  const toDelete = (existing || []).filter((e) => !keepPrefixes.includes(`${e.type}:${e.track_prefix}`)).map((e) => e.id);
  if (toDelete.length) {
    throwIfError(await supabase.from("lots_decomp").delete().in("id", toDelete));
  }
}

// ── Tracking Cell (hot path) ────────────────────────────────────────────────

export async function setTrackingCell(projectId, trackType, rowKey, entityId, status) {
  if (!isSupabaseConfigured()) return;

  if (shouldEnqueue()) {
    enqueue({ type: "setTrackingCell", args: [projectId, trackType, rowKey, entityId, status] });
    return;
  }

  throwIfError(
    await supabase.from("tracking_cells").upsert({
      project_id: projectId,
      track_type: trackType,
      row_key: rowKey,
      entity_id: entityId,
      status,
    })
  );
}

// ── Tracking Meta ───────────────────────────────────────────────────────────

export async function setTrackingMeta(projectId, trackType, rowKey, meta) {
  if (!isSupabaseConfigured()) return;

  if (shouldEnqueue()) {
    enqueue({ type: "setTrackingMeta", args: [projectId, trackType, rowKey, meta] });
    return;
  }

  const row = {
    project_id: projectId,
    track_type: trackType,
    row_key: rowKey,
  };
  if ("ponderation" in meta) row.ponderation = meta.ponderation;
  if ("tache" in meta) row.tache = meta.tache;

  throwIfError(await supabase.from("tracking_meta").upsert(row));
}

// ── Full Project Sync (for import) ──────────────────────────────────────────

export async function fullProjectSync(project, userId) {
  if (!isSupabaseConfigured()) return;

  console.log(`[DataLayer] fullProjectSync for ${project.id} — lotsInt: ${(project.lotsInt || []).length}, lotsExt: ${(project.lotsExt || []).length}`);

  // Upsert project row first (required for FK constraints)
  throwIfError(await supabase.from("projects").upsert(projectToRow(project, userId)));
  console.log(`[DataLayer] Project upserted: ${project.id}`);

  // Upsert child tables in parallel (no delete — just overwrite)
  const tasks = [];

  // Batiments
  if (project.batiments?.length) {
    const rows = project.batiments.map((b, i) => batimentToRow(b, project.id, i));
    tasks.push(
      supabase.from("batiments").upsert(rows).then((res) => {
        if (res.error) console.error("[DataLayer] batiments upsert failed:", res.error);
        else console.log(`[DataLayer] batiments OK: ${rows.length}`);
      })
    );
  }

  // Lots
  if (project.lots?.length) {
    const rows = project.lots.map((l, i) => lotToRow(l, project.id, i));
    tasks.push(
      supabase.from("lots").upsert(rows, { onConflict: "project_id,numero" }).then((res) => {
        if (res.error) console.error("[DataLayer] lots upsert failed:", res.error);
        else console.log(`[DataLayer] lots OK: ${rows.length}`);
      })
    );
  }

  // Lots decomp
  const decompRows = [];
  for (const [type, arr] of [["int", project.lotsInt], ["ext", project.lotsExt]]) {
    (arr || []).forEach((d, i) => decompRows.push(lotDecompToRow(d, type, project.id, i)));
  }
  const seenDecomp = new Set();
  const uniqueDecomp = decompRows.filter((r) => {
    const key = `${r.type}:${r.track_prefix}`;
    if (seenDecomp.has(key)) return false;
    seenDecomp.add(key);
    return true;
  });
  if (uniqueDecomp.length) {
    tasks.push(
      supabase.from("lots_decomp").upsert(uniqueDecomp, { onConflict: "project_id,type,track_prefix" }).then((res) => {
        if (res.error) console.error("[DataLayer] lots_decomp upsert failed:", res.error);
        else console.log(`[DataLayer] lots_decomp OK: ${uniqueDecomp.length}`);
      })
    );
  }

  // Wait for structure tables before tracking (tracking references row_key from decomp)
  await Promise.all(tasks);

  // Tracking cells — upsert in parallel batches (no delete)
  if (project.tracking) {
    const { cells, meta } = trackingToRows(project.id, project.tracking);
    console.log(`[DataLayer] Tracking: ${cells.length} cells, ${meta.length} meta`);

    const BATCH = 500;
    const cellTasks = [];
    for (let i = 0; i < cells.length; i += BATCH) {
      const batch = cells.slice(i, i + BATCH);
      cellTasks.push(
        supabase.from("tracking_cells").upsert(batch).then((res) => {
          if (res.error) console.error(`[DataLayer] cells batch failed (${i}):`, res.error);
          else console.log(`[DataLayer] cells OK: ${i + batch.length}/${cells.length}`);
        })
      );
    }
    // Run cell batches in parallel (max 4 concurrent)
    for (let i = 0; i < cellTasks.length; i += 4) {
      await Promise.all(cellTasks.slice(i, i + 4));
    }

    if (meta.length) {
      const res = await supabase.from("tracking_meta").upsert(meta);
      if (res.error) console.error("[DataLayer] meta upsert failed:", res.error);
      else console.log(`[DataLayer] meta OK: ${meta.length}`);
    }
  }

  console.log(`[DataLayer] fullProjectSync DONE: ${project.id}`);
}

// ── Replay function for offline sync queue ──────────────────────────────────

export async function replayOperation(type, args) {
  switch (type) {
    case "setTrackingCell":
      return setTrackingCell(...args);
    case "setTrackingMeta":
      return setTrackingMeta(...args);
    case "updateProjectFields":
      return updateProjectFields(...args);
    case "syncBatiments":
      return syncBatiments(...args);
    case "syncLots":
      return syncLots(...args);
    case "syncLotsDecomp":
      return syncLotsDecomp(...args);
    case "deleteProjectFromDB":
      return deleteProjectFromDB(...args);
    default:
      console.warn("[DataLayer] Unknown replay operation:", type);
  }
}
