import { useMemo } from "react";
import { getLogementNums } from "../../lib/db";
import { computeExpectedProgress } from "../../lib/computations";

export default function RecapAvancementTab({ project }) {
  const { expectedInt, expectedExt } = useMemo(
    () => computeExpectedProgress(project),
    [project]
  );

  const data = useMemo(() => {
    const lots = project.lots || [];
    const trackInt = project.tracking?.logements || {};
    const trackExt = project.tracking?.batiments || {};

    const batEntitiesGrouped = project.batiments.map((bat) => ({
      extEntities: [bat.id],
      intEntities: getLogementNums(bat).map((num) => `${bat.id}_log_${num}`),
    }));

    const rows = [];

    for (const lot of lots) {
      const extDecomps = (project.lotsExt || []).filter((l) => l.numero === lot.numero);
      const intDecomps = (project.lotsInt || []).filter((l) => l.numero === lot.numero);
      const allDecomps = [
        ...extDecomps.map((d) => ({ ...d, type: "EXT" })),
        ...intDecomps.map((d) => ({ ...d, type: "INT" })),
      ];

      for (const decomp of allDecomps) {
        const isExt = decomp.type === "EXT";
        const tracking = isExt ? trackExt : trackInt;

        const allEntities = batEntitiesGrouped.flatMap((bg) => isExt ? bg.extEntities : bg.intEntities);
        let totalPondWeighted = 0;
        let doneWeighted = 0;
        if (allEntities.length > 0) {
          for (const step of decomp.decompositions) {
            const key = `${decomp.trackPrefix || decomp.numero}-${step}`;
            const pond = tracking[key]?._ponderation || 1;
            totalPondWeighted += pond * allEntities.length;
            for (const eId of allEntities) {
              if (tracking[key]?.[eId]?.status === "X") doneWeighted += pond;
            }
          }
        }
        const avancement = totalPondWeighted > 0
          ? Math.min((doneWeighted / totalPondWeighted) * 100, 100)
          : 0;

        const montant = decomp.montant || 0;
        const pctDuLot = lot.montantMarche > 0 ? (montant / lot.montantMarche) * 100 : 0;
        const avParMontant = (pctDuLot / 100) * avancement;

        const expected = isExt ? expectedExt : expectedInt;
        const ecart = expected !== null ? avancement - expected : null;

        const decompLabel = decomp.nomDecomp || decomp.nom || "";
        rows.push({
          label: decompLabel
            ? `${lot.numero} - ${lot.nom} - ${decompLabel.toUpperCase()}`
            : `${lot.numero} - ${lot.nom}`,
          avancement,
          avParMontant,
          avInt: decomp.type === "INT" ? avParMontant : 0,
          avExt: decomp.type === "EXT" ? avParMontant : 0,
          ecart,
        });
      }
    }

    return rows;
  }, [project, expectedInt, expectedExt]);

  const pct = (v) => v.toFixed(2) + "%";
  const totalAv = data.reduce((s, r) => s + r.avParMontant, 0);
  const totalInt = data.reduce((s, r) => s + r.avInt, 0);
  const totalExt = data.reduce((s, r) => s + r.avExt, 0);

  return (
    <div className="setup-content-wide" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Récap Avancement</h3>
            <p>{data.length} lot(s) décomposé(s)</p>
          </div>
        </div>

        <div className="config-table-wrap">
          <table className="config-table">
            <thead>
              <tr>
                <th>Lot décomposé</th>
                <th style={{ width: 100, textAlign: "right" }}>Avancement</th>
                <th style={{ width: 80, textAlign: "right" }}>Écart</th>
                <th style={{ width: 140, textAlign: "right" }}>Av. (par montant)</th>
                <th style={{ width: 140, textAlign: "right" }}>Av. INT (par montant)</th>
                <th style={{ width: 140, textAlign: "right" }}>Av. EXT (par montant)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const isRetard = r.ecart !== null && r.ecart < 0;
                return (
                  <tr key={i}>
                    <td style={{ fontSize: 12 }}>{r.label}</td>
                    <td className="cell-right cell-mono" style={{ fontSize: 12 }}>{pct(r.avancement)}</td>
                    <td className={`cell-right cell-mono ${isRetard ? "ecart-cell-neg" : "ecart-cell-pos"}`} style={{ fontSize: 12 }}>
                      {r.ecart !== null ? (
                        <>{r.ecart < 0 ? "" : "+"}{r.ecart.toFixed(1)}%</>
                      ) : "—"}
                    </td>
                    <td className="cell-right cell-mono" style={{ fontSize: 12 }}>{pct(r.avParMontant)}</td>
                    <td className="cell-right cell-mono" style={{ fontSize: 12 }}>{pct(r.avInt)}</td>
                    <td className="cell-right cell-mono" style={{ fontSize: 12 }}>{pct(r.avExt)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="cell-bold">TOTAL</td>
                <td></td>
                <td></td>
                <td className="cell-right cell-bold cell-mono">{pct(totalAv)}</td>
                <td className="cell-right cell-bold cell-mono">{pct(totalInt)}</td>
                <td className="cell-right cell-bold cell-mono">{pct(totalExt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
