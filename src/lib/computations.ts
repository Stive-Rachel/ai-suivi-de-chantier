import { getLogementNums } from "./db";
import type { Project, LotDecomp, LotProgress, DetailedProgress, TrackingData, ExceptionsMap } from "../types";

export function computeProjectProgress(project: Project): number {
  const { lotProgressInt, lotProgressExt } = computeDetailedProgress(project);
  const totalMontant = (project.lots || []).reduce((s, l) => s + (l.montantMarche || 0), 0);
  if (totalMontant === 0) return 0;
  let progress = 0;
  for (const lp of lotProgressExt) {
    progress += (lp.montant / totalMontant) * lp.progress;
  }
  for (const lp of lotProgressInt) {
    progress += (lp.montant / totalMontant) * lp.progress;
  }
  return progress;
}

export function computeDetailedProgress(project: Project): DetailedProgress {
  const exceptions = project.exceptions || {};

  const batEntitiesGrouped = project.batiments.map((bat) => ({
    batId: bat.id,
    extEntities: [bat.id],
    intEntities: getLogementNums(bat)
      .map((num) => `${bat.id}_log_${num}`)
      .filter((eId) => !exceptions[eId]),
  }));

  const calcLotProgress = (lots: LotDecomp[], trackType: "logements" | "batiments"): LotProgress[] => {
    const trackingData = project.tracking?.[trackType] || {};
    const isInt = trackType === "logements";

    if (project.batiments.length === 0) return [];

    return lots.map((lot) => {
      const allEntities = batEntitiesGrouped.flatMap((bg) => isInt ? bg.intEntities : bg.extEntities);
      let totalPondWeighted = 0;
      let doneWeighted = 0;

      if (allEntities.length > 0) {
        for (const decomp of lot.decompositions) {
          const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
          const pond = trackingData[key]?._ponderation ?? 1;
          let naCount = 0;
          for (const eId of allEntities) {
            const status = trackingData[key]?.[eId]?.status;
            if (status === "N/A") naCount++;
            else if (status === "X") doneWeighted += pond;
          }
          totalPondWeighted += pond * (allEntities.length - naCount);
        }
      }

      const progress = totalPondWeighted > 0
        ? Math.min((doneWeighted / totalPondWeighted) * 100, 100)
        : 0;

      return {
        lot: `${lot.numero} - ${lot.nom}`,
        shortLot: lot.nomDecomp ? `${lot.numero} - ${lot.nomDecomp}` : `${lot.numero} - ${lot.nom}`,
        montant: lot.montant || 0,
        progress,
      };
    });
  };

  const sortByNumero = (a, b) => {
    const na = a.lot.split(" - ")[0], nb = b.lot.split(" - ")[0];
    const pa = na.includes("&") ? parseFloat(na) : parseFloat(na);
    const pb = nb.includes("&") ? parseFloat(nb) : parseFloat(nb);
    if (pa !== pb) return pa - pb;
    return a.lot.localeCompare(b.lot);
  };
  const lotProgressInt = calcLotProgress(project.lotsInt, "logements").sort(sortByNumero);
  const lotProgressExt = calcLotProgress(project.lotsExt, "batiments").sort(sortByNumero);

  const totalMontantInt = (project.lotsInt || []).reduce((s, l) => s + (l.montant || 0), 0);
  const totalMontantExt = (project.lotsExt || []).reduce((s, l) => s + (l.montant || 0), 0);
  const totalMontantAll = totalMontantInt + totalMontantExt;

  const batimentProgress = project.batiments.map((bat) => {
    const logEntities = getLogementNums(bat)
      .map((num) => `${bat.id}_log_${num}`)
      .filter((eId) => !exceptions[eId]);
    const intProgress = calcEntityProgress(project.lotsInt, "logements", logEntities, project.tracking);
    const extProgress = calcEntityProgress(project.lotsExt, "batiments", [bat.id], project.tracking);

    const total = totalMontantAll > 0
      ? (intProgress * totalMontantInt + extProgress * totalMontantExt) / totalMontantAll
      : (intProgress + extProgress) / 2;

    return {
      name: bat.name,
      int: intProgress,
      ext: extProgress,
      total,
    };
  });

  return { lotProgressInt, lotProgressExt, batimentProgress };
}

export function calcEntityProgress(lots: LotDecomp[], trackType: string, entityIds: string[], tracking: TrackingData | undefined): number {
  const t = tracking?.[trackType] || {};
  if (entityIds.length === 0) return 0;

  let totalPond = 0;
  let weightedProgress = 0;

  for (const lot of lots) {
    for (const decomp of lot.decompositions) {
      const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
      const pond = t[key]?._ponderation ?? 1;

      let done = 0;
      let naCount = 0;
      for (const eId of entityIds) {
        const status = t[key]?.[eId]?.status;
        if (status === "X") done++;
        else if (status === "N/A") naCount++;
      }
      const activeCount = entityIds.length - naCount;
      if (activeCount > 0) {
        totalPond += pond;
        const progress = (done / activeCount) * 100;
        weightedProgress += progress * pond;
      }
    }
  }

  return totalPond > 0 ? Math.min(weightedProgress / totalPond, 100) : 0;
}

/**
 * Count the number of exceptions (excluded logements) for a project,
 * optionally filtered by batiment ID.
 */
export function countExceptions(project: Project, batId?: string): number {
  const exceptions = project.exceptions || {};
  if (!batId) {
    return Object.values(exceptions).filter(Boolean).length;
  }
  return Object.entries(exceptions)
    .filter(([eId, v]) => v && eId.startsWith(`${batId}_log_`))
    .length;
}

/**
 * Get the total number of logements for a project, and the number of active (non-exception) ones.
 */
export function getLogementCounts(project: Project): { total: number; active: number; exceptions: number } {
  const total = project.batiments.reduce((s, b) => s + getLogementNums(b).length, 0);
  const exc = countExceptions(project);
  return { total, active: total - exc, exceptions: exc };
}
