import { useMemo } from "react";
import { getLogementNums } from "../../lib/db";
import { computeDetailedProgress } from "../../lib/computations";
import ProgressBar from "../ui/ProgressBar";
import ProgressCard from "../ui/ProgressCard";

export default function AvancementTab({ project }) {
  const { lotProgressInt, lotProgressExt, batimentProgress } = useMemo(
    () => computeDetailedProgress(project),
    [project]
  );

  const lotProgress = useMemo(() => {
    const lots = project.lots || [];
    const trackInt = project.tracking?.logements || {};
    const trackExt = project.tracking?.batiments || {};
    const batGroups = project.batiments.map((bat) => ({
      extEntities: [bat.id],
      intEntities: getLogementNums(bat).map((num) => `${bat.id}_log_${num}`),
    }));

    return lots.map((lot) => {
      const extDecomps = (project.lotsExt || []).filter((l) => l.numero === lot.numero);
      const intDecomps = (project.lotsInt || []).filter((l) => l.numero === lot.numero);
      const allDecomps = [
        ...extDecomps.map((d) => ({ ...d, type: "EXT" })),
        ...intDecomps.map((d) => ({ ...d, type: "INT" })),
      ];

      if (allDecomps.length === 0) return { lot: `${lot.numero} - ${lot.nom}`, progress: 0 };

      let progress = 0;
      const lotMontantMarche = lot.montantMarche || 0;
      for (const decomp of allDecomps) {
        const isExt = decomp.type === "EXT";
        const tracking = isExt ? trackExt : trackInt;
        const allEntities = batGroups.flatMap((bg) => isExt ? bg.extEntities : bg.intEntities);
        let tpw = 0, dw = 0;
        if (allEntities.length > 0) {
          for (const step of decomp.decompositions) {
            const key = `${decomp.trackPrefix || decomp.numero}-${step}`;
            const pond = tracking[key]?._ponderation || 1;
            tpw += pond * allEntities.length;
            for (const eId of allEntities) {
              if (tracking[key]?.[eId]?.status === "X") dw += pond;
            }
          }
        }
        const decompAv = tpw > 0 ? Math.min((dw / tpw) * 100, 100) : 0;
        const decompMontant = decomp.montant || 0;
        const pctDuLot = lotMontantMarche > 0 ? decompMontant / lotMontantMarche : 0;
        progress += pctDuLot * decompAv;
      }
      return { lot: `${lot.numero} - ${lot.nom}`, progress };
    });
  }, [project]);

  return (
    <div className="avancement-content" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="progress-card" style={{ marginBottom: 24 }}>
        <div className="progress-card-header">
          <h4>Avancement par Lot</h4>
        </div>
        <div className="config-table-wrap">
          <table className="config-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th style={{ width: 140, textAlign: "right" }}>Avancement</th>
              </tr>
            </thead>
            <tbody>
              {lotProgress.map((lp) => (
                <tr key={lp.lot}>
                  <td style={{ fontSize: 13 }}>{lp.lot}</td>
                  <td className="cell-right" style={{ padding: "4px 8px" }}>
                    <ProgressBar value={lp.progress} height={5} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="avancement-grid">
        <ProgressCard title="Avancement Intérieur" items={lotProgressInt} />
        <ProgressCard title="Avancement Extérieur" items={lotProgressExt} />
      </div>

      <div className="progress-card">
        <div className="progress-card-header">
          <h4>Avancement par Bâtiment</h4>
        </div>
        {batimentProgress.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Aucun bâtiment configuré</p>
        ) : (
          <div className="batiment-progress-grid">
            {batimentProgress.map((bp) => (
              <div key={bp.name} className="batiment-progress-card">
                <h5>{bp.name}</h5>
                <ProgressBar value={bp.total} />
                <div className="batiment-progress-detail">
                  <span>INT {bp.int.toFixed(1)}%</span>
                  <span>EXT {bp.ext.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
