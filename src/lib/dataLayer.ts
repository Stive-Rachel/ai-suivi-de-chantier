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

export async function withRetry(fn: () => Promise<void>): Promise<{ ok: boolean; error?: any }> {
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

  const [batRes, lotRes, decompRes, cellRes, metaRes] = await Promise.all([
    supabase.from("batiments").select("*").in("project_id", projectIds).order("sort_order"),
    supabase.from("lots").select("*").in("project_id", projectIds).order("sort_order"),
    supabase.from("lots_decomp").select("*").in("project_id", projectIds).order("sort_order"),
    supabase.from("tracking_cells").select("*").in("project_id", projectIds),
    supabase.from("tracking_meta").select("*").in("project_id", projectIds),
  ]);

  const bats = throwIfError(batRes);
  const lots = throwIfError(lotRes);
  const decomps = throwIfError(decompRes);
  const cells = throwIfError(cellRes);
  const metas = throwIfError(metaRes);

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

  throwIfError(await supabase.from("projects").insert(projectToRow(project, userId)));

  // Insert batiments
  if (project.batiments?.length) {
    const rows = project.batiments.map((b, i) => batimentToRow(b, project.id, i));
    throwIfError(await supabase.from("batiments").insert(rows));
  }

  // Insert lots
  if (project.lots?.length) {
    const rows = project.lots.map((l, i) => lotToRow(l, project.id, i));
    throwIfError(await supabase.from("lots").insert(rows));
  }

  // Insert decomp
  const decompRows = [];
  for (const [type, arr] of [["int", project.lotsInt], ["ext", project.lotsExt]]) {
    (arr || []).forEach((d, i) => decompRows.push(lotDecompToRow(d, type, project.id, i)));
  }
  if (decompRows.length) {
    throwIfError(await supabase.from("lots_decomp").insert(decompRows));
  }

  // Insert tracking
  if (project.tracking) {
    const { cells, meta } = trackingToRows(project.id, project.tracking);
    if (cells.length) {
      for (let i = 0; i < cells.length; i += 500) {
        throwIfError(await supabase.from("tracking_cells").upsert(cells.slice(i, i + 500)));
      }
    }
    if (meta.length) {
      throwIfError(await supabase.from("tracking_meta").upsert(meta));
    }
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
  if (rows.length) {
    throwIfError(await supabase.from("lots_decomp").upsert(rows, { onConflict: "project_id,type,track_prefix" }));
  }
  const keepPrefixes = rows.map((r) => `${r.type}:${r.track_prefix}`);
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

  // Delete existing then re-create
  throwIfError(await supabase.from("projects").delete().eq("id", project.id));
  await createProjectInDB(project, userId);
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
