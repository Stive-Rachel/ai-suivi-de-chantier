import { getLogementNums } from "./db";

export function computeProjectProgress(project) {
  const { lotProgressInt, lotProgressExt } = computeDetailedProgress(project);
  const allLotsInt = project.lotsInt || [];
  const allLotsExt = project.lotsExt || [];
  const totalMontant = (project.lots || []).reduce((s, l) => s + (l.montantMarche || 0), 0);
  if (totalMontant === 0) return 0;
  let progress = 0;
  for (let i = 0; i < lotProgressExt.length; i++) {
    const montant = allLotsExt[i]?.montant || 0;
    progress += (montant / totalMontant) * lotProgressExt[i].progress;
  }
  for (let i = 0; i < lotProgressInt.length; i++) {
    const montant = allLotsInt[i]?.montant || 0;
    progress += (montant / totalMontant) * lotProgressInt[i].progress;
  }
  return progress;
}

export function computeDetailedProgress(project) {
  const batEntitiesGrouped = project.batiments.map((bat) => ({
    batId: bat.id,
    extEntities: [bat.id],
    intEntities: getLogementNums(bat).map((num) => `${bat.id}_log_${num}`),
  }));

  const calcLotProgress = (lots, trackType) => {
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
          const pond = trackingData[key]?._ponderation || 1;
          totalPondWeighted += pond * allEntities.length;
          for (const eId of allEntities) {
            if (trackingData[key]?.[eId]?.status === "X") doneWeighted += pond;
          }
        }
      }

      const progress = totalPondWeighted > 0
        ? Math.min((doneWeighted / totalPondWeighted) * 100, 100)
        : 0;

      return {
        lot: `${lot.numero} - ${lot.nom}`,
        shortLot: lot.nomDecomp ? `${lot.numero} - ${lot.nomDecomp}` : `${lot.numero} - ${lot.nom}`,
        progress,
      };
    });
  };

  const lotProgressInt = calcLotProgress(project.lotsInt, "logements");
  const lotProgressExt = calcLotProgress(project.lotsExt, "batiments");

  const batimentProgress = project.batiments.map((bat) => {
    const logEntities = getLogementNums(bat).map((num) => `${bat.id}_log_${num}`);
    const intProgress = calcEntityProgress(project.lotsInt, "logements", logEntities, project.tracking);
    const extProgress = calcEntityProgress(project.lotsExt, "batiments", [bat.id], project.tracking);

    return {
      name: bat.name,
      int: intProgress,
      ext: extProgress,
      total: (intProgress + extProgress) / 2,
    };
  });

  return { lotProgressInt, lotProgressExt, batimentProgress };
}

export function calcEntityProgress(lots, trackType, entityIds, tracking) {
  const t = tracking?.[trackType] || {};
  if (entityIds.length === 0) return 0;

  let totalPond = 0;
  let weightedProgress = 0;

  for (const lot of lots) {
    for (const decomp of lot.decompositions) {
      const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
      const pond = t[key]?._ponderation || 1;
      totalPond += pond;

      let done = 0;
      for (const eId of entityIds) {
        if (t[key]?.[eId]?.status === "X") done++;
      }
      const progress = (done / entityIds.length) * 100;
      weightedProgress += progress * pond;
    }
  }

  return totalPond > 0 ? Math.min(weightedProgress / totalPond, 100) : 0;
}
