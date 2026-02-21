// ─── Conversion functions between app format and Supabase schema ────────────

// ── Project ─────────────────────────────────────────────────────────────────

export function projectToRow(project, userId) {
  return {
    id: project.id,
    name: project.name,
    location: project.location || "",
    client: project.client || "",
    created_at: project.createdAt || new Date().toISOString(),
    montant_total: project.montantTotal || 0,
    montant_ext: project.montantExt || 0,
    montant_int: project.montantInt || 0,
    date_debut_chantier: project.dateDebutChantier || "",
    duree_totale: project.dureeTotale || 0,
    duree_ext: project.dureeExt || 0,
    duree_int: project.dureeInt || 0,
    date_debut_int: project.dateDebutInt || "",
    date_debut_ext: project.dateDebutExt || "",
    semaines_exclues: project.semainesExclues || 0,
    semaines_travaillees: project.semainesTravaillees || 0,
    user_id: userId,
  };
}

export function rowToProject(row, batiments, lots, lotsDecomp, tracking) {
  return {
    id: row.id,
    name: row.name,
    location: row.location || "",
    client: row.client || "",
    createdAt: row.created_at,
    montantTotal: row.montant_total || 0,
    montantExt: row.montant_ext || 0,
    montantInt: row.montant_int || 0,
    dateDebutChantier: row.date_debut_chantier || "",
    dureeTotale: row.duree_totale || 0,
    dureeExt: row.duree_ext || 0,
    dureeInt: row.duree_int || 0,
    dateDebutInt: row.date_debut_int || "",
    dateDebutExt: row.date_debut_ext || "",
    semainesExclues: row.semaines_exclues || 0,
    semainesTravaillees: row.semaines_travaillees || 0,
    batiments: batiments.map(rowToBatiment),
    lots: lots.map(rowToLot),
    lotsInt: lotsDecomp.filter((d) => d.type === "int").map(rowToLotDecomp),
    lotsExt: lotsDecomp.filter((d) => d.type === "ext").map(rowToLotDecomp),
    tracking,
  };
}

// ── Batiments ───────────────────────────────────────────────────────────────

export function batimentToRow(bat, projectId, index) {
  return {
    id: bat.id,
    project_id: projectId,
    name: bat.name,
    nb_logements: bat.nbLogements || 0,
    logements: bat.logements || [],
    sort_order: index,
  };
}

function rowToBatiment(row) {
  return {
    id: row.id,
    name: row.name,
    nbLogements: row.nb_logements || 0,
    logements: row.logements || [],
  };
}

// ── Lots ────────────────────────────────────────────────────────────────────

export function lotToRow(lot, projectId, index) {
  return {
    project_id: projectId,
    numero: lot.numero,
    nom: lot.nom || "",
    montant_marche: lot.montantMarche || 0,
    montant_ext: lot.montantExt || 0,
    montant_int: lot.montantInt || 0,
    sort_order: index,
  };
}

function rowToLot(row) {
  return {
    numero: row.numero,
    nom: row.nom || "",
    montantMarche: row.montant_marche || 0,
    montantExt: row.montant_ext || 0,
    montantInt: row.montant_int || 0,
  };
}

// ── Lots Decomp ─────────────────────────────────────────────────────────────

export function lotDecompToRow(lot, type, projectId, index) {
  return {
    project_id: projectId,
    type,
    numero: lot.numero,
    nom: lot.nom || "",
    nom_decomp: lot.nomDecomp || "",
    track_prefix: lot.trackPrefix || lot.numero,
    decompositions: lot.decompositions || [],
    montant: lot.montant || 0,
    sort_order: index,
  };
}

function rowToLotDecomp(row) {
  return {
    numero: row.numero,
    nom: row.nom || "",
    nomDecomp: row.nom_decomp || "",
    trackPrefix: row.track_prefix,
    decompositions: row.decompositions || [],
    montant: row.montant || 0,
  };
}

// ── Tracking ────────────────────────────────────────────────────────────────

export function trackingToRows(projectId, tracking) {
  const cells = [];
  const meta = [];

  for (const [trackType, trackData] of Object.entries(tracking || {})) {
    for (const [rowKey, rowData] of Object.entries(trackData || {})) {
      let ponderation = 1;
      let tache = "";

      for (const [entityId, cell] of Object.entries(rowData || {})) {
        if (entityId === "_ponderation") {
          ponderation = cell;
        } else if (entityId === "_tache") {
          tache = cell;
        } else if (!entityId.startsWith("_")) {
          cells.push({
            project_id: projectId,
            track_type: trackType,
            row_key: rowKey,
            entity_id: entityId,
            status: cell?.status || "",
          });
        }
      }

      meta.push({
        project_id: projectId,
        track_type: trackType,
        row_key: rowKey,
        ponderation,
        tache,
      });
    }
  }

  return { cells, meta };
}

export function rowsToTracking(cells, meta) {
  const tracking = { logements: {}, batiments: {} };

  for (const row of cells) {
    if (!tracking[row.track_type]) tracking[row.track_type] = {};
    if (!tracking[row.track_type][row.row_key]) tracking[row.track_type][row.row_key] = {};
    tracking[row.track_type][row.row_key][row.entity_id] = { status: row.status };
  }

  for (const m of meta) {
    if (!tracking[m.track_type]) tracking[m.track_type] = {};
    if (!tracking[m.track_type][m.row_key]) tracking[m.track_type][m.row_key] = {};
    if (m.ponderation != null) tracking[m.track_type][m.row_key]._ponderation = m.ponderation;
    if (m.tache) tracking[m.track_type][m.row_key]._tache = m.tache;
  }

  return tracking;
}
