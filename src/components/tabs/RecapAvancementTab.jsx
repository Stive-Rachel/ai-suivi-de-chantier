import { useMemo } from "react";
import { getLogementNums } from "../../lib/db";
import { formatMontant } from "../../lib/format";
import { useTableSort } from "../../lib/useTableSort";
import SortableHeader from "../ui/SortableHeader";

export default function RecapAvancementTab({ project }) {
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
        const nbEntities = allEntities.length;
        let nbDecomps = 0;

        if (nbEntities > 0) {
          for (const step of decomp.decompositions) {
            const key = `${decomp.trackPrefix || decomp.numero}-${step}`;
            const pond = tracking[key]?._ponderation || 1;
            totalPondWeighted += pond * nbEntities;
            for (const eId of allEntities) {
              if (tracking[key]?.[eId]?.status === "X") doneWeighted += pond;
            }
            nbDecomps++;
          }
        }
        const avancement = totalPondWeighted > 0
          ? Math.min((doneWeighted / totalPondWeighted) * 100, 100)
          : 0;

        const montant = decomp.montant || 0;
        const pctDuLot = lot.montantMarche > 0 ? (montant / lot.montantMarche) * 100 : 0;
        const avParMontant = (pctDuLot / 100) * avancement;

        const tooltipAv = `${doneWeighted.toFixed(0)} / ${totalPondWeighted.toFixed(0)} (pondéré)\n${nbDecomps} tâches × ${nbEntities} ${isExt ? "bâtiments" : "logements"}\n= ${avancement.toFixed(2)}%`;
        const tooltipAvMontant = `${formatMontant(montant)} / ${formatMontant(lot.montantMarche)}\n= ${pctDuLot.toFixed(2)}% du lot\n× ${avancement.toFixed(2)}% avancement\n= ${avParMontant.toFixed(2)}%`;

        const decompLabel = decomp.nomDecomp || decomp.nom || "";
        rows.push({
          label: decompLabel
            ? `${lot.numero} - ${lot.nom} - ${decompLabel.toUpperCase()}`
            : `${lot.numero} - ${lot.nom}`,
          avancement,
          avParMontant,
          avInt: decomp.type === "INT" ? avParMontant : 0,
          avExt: decomp.type === "EXT" ? avParMontant : 0,
          tooltipAv,
          tooltipAvMontant,
        });
      }
    }

    return rows;
  }, [project]);

  const { sortConfig, toggleSort, sortedData } = useTableSort(data);

  const pct = (v) => v.toFixed(2) + "%";
  const totalAv = data.reduce((s, r) => s + r.avParMontant, 0);
  const totalInt = data.reduce((s, r) => s + r.avInt, 0);
  const totalExt = data.reduce((s, r) => s + r.avExt, 0);
  const avgAv = data.length > 0 ? data.reduce((s, r) => s + r.avancement, 0) / data.length : 0;

  return (
    <div className="setup-content-wide" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Récap Avancement</h3>
            <p>{data.length} lot(s) décomposé(s) — avancement global : <strong data-tooltip={`Σ av. par montant de chaque décomposition`}>{pct(totalAv)}</strong></p>
          </div>
        </div>

        <div className="config-table-wrap">
          <table className="config-table">
            <thead>
              <tr>
                <SortableHeader sortKey="label" sortConfig={sortConfig} onSort={toggleSort}>
                  Lot décomposé
                </SortableHeader>
                <SortableHeader sortKey="avancement" sortConfig={sortConfig} onSort={toggleSort} style={{ width: 100, textAlign: "right" }}>
                  Avancement
                </SortableHeader>
                <SortableHeader sortKey="avParMontant" sortConfig={sortConfig} onSort={toggleSort} style={{ width: 140, textAlign: "right" }}>
                  Av. (par montant)
                </SortableHeader>
                <SortableHeader sortKey="avInt" sortConfig={sortConfig} onSort={toggleSort} style={{ width: 140, textAlign: "right" }}>
                  Av. INT
                </SortableHeader>
                <SortableHeader sortKey="avExt" sortConfig={sortConfig} onSort={toggleSort} style={{ width: 140, textAlign: "right" }}>
                  Av. EXT
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((r, i) => {
                const isLow = r.avancement < avgAv * 0.5 && avgAv > 0 && r.avancement < 100;
                return (
                  <tr key={i} className={isLow ? "row-retard" : ""}>
                    <td style={{ fontSize: 12 }}>{r.label}</td>
                    <td
                      className={`cell-right cell-mono ${isLow ? "val-retard" : ""}`}
                      style={{ fontSize: 12 }}
                      data-tooltip={r.tooltipAv}
                    >
                      {pct(r.avancement)}
                    </td>
                    <td
                      className="cell-right cell-mono"
                      style={{ fontSize: 12 }}
                      data-tooltip={r.tooltipAvMontant}
                    >
                      {pct(r.avParMontant)}
                    </td>
                    <td className="cell-right cell-mono" style={{ fontSize: 12 }}>{r.avInt > 0 ? pct(r.avInt) : "—"}</td>
                    <td className="cell-right cell-mono" style={{ fontSize: 12 }}>{r.avExt > 0 ? pct(r.avExt) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="cell-bold">TOTAL</td>
                <td></td>
                <td className="cell-right cell-bold cell-mono" data-tooltip="Somme de tous les Av. par montant">{pct(totalAv)}</td>
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
