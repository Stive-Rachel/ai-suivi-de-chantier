import { useMemo, Fragment } from "react";
import { getLogementNums } from "../../lib/db";
import { formatMontant } from "../../lib/format";
import ProgressBar from "../ui/ProgressBar";

export default function RecapTab({ project }) {
  const recap = useMemo(() => {
    const rows = [];
    const lots = project.lots || [];
    const totalMontantGlobal = lots.reduce((s, l) => s + (l.montantMarche || 0), 0);
    const totalExtGlobal = (project.lotsExt || []).reduce((s, l) => s + (l.montant || 0), 0);
    const totalIntGlobal = (project.lotsInt || []).reduce((s, l) => s + (l.montant || 0), 0);

    const logEntities = [];
    for (const bat of project.batiments) {
      for (const num of getLogementNums(bat)) {
        logEntities.push(`${bat.id}_log_${num}`);
      }
    }
    const batEntities = project.batiments.map((b) => b.id);
    const trackInt = project.tracking?.logements || {};
    const trackExt = project.tracking?.batiments || {};

    const batEntitiesGrouped = project.batiments.map((bat) => ({
      batId: bat.id,
      batName: bat.name,
      extEntities: [bat.id],
      intEntities: getLogementNums(bat).map((num) => `${bat.id}_log_${num}`),
    }));

    for (const lot of lots) {
      const extDecomps = (project.lotsExt || []).filter((l) => l.numero === lot.numero);
      const intDecomps = (project.lotsInt || []).filter((l) => l.numero === lot.numero);
      const allDecomps = [
        ...extDecomps.map((d) => ({ ...d, type: "EXT" })),
        ...intDecomps.map((d) => ({ ...d, type: "INT" })),
      ];

      const decompRows = [];
      let lotSumAvParLot = 0;

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
        const lotLabel = `${lot.numero} - ${lot.nom}`;
        const decompLabel = decomp.nomDecomp || decomp.nom || "";

        const pctMontantTotal = lot.montantMarche > 0 ? (montant / lot.montantMarche) * 100 : 0;
        const montantInt = decomp.type === "INT" ? montant : 0;
        const pctInt = totalIntGlobal > 0 && decomp.type === "INT" ? (montant / totalIntGlobal) * 100 : 0;
        const montantExt = decomp.type === "EXT" ? montant : 0;
        const pctExt = totalExtGlobal > 0 && decomp.type === "EXT" ? (montant / totalExtGlobal) * 100 : 0;

        const avParLotDecomp = (pctMontantTotal / 100) * avancement;
        lotSumAvParLot += avParLotDecomp;

        decompRows.push({
          lotLabel,
          decompLabel: decompLabel.toUpperCase(),
          type: decomp.type,
          nomDecomp: (decompLabel || "").toLowerCase(),
          montant,
          pctMontantTotal,
          montantInt,
          pctInt,
          montantExt,
          pctExt,
          avancement,
          avParLotDecomp,
          fullLabel: decompLabel ? `${lotLabel} - ${decompLabel.toUpperCase()}` : lotLabel,
        });
      }

      const lotExtMontant = lot.montantExt || 0;
      const lotIntMontant = lot.montantInt || 0;
      const lotMontant = lot.montantMarche || 0;
      const lotPctTotal = 100;
      const lotAvancement = lotSumAvParLot;
      const lotAvParMontant = lotSumAvParLot;

      rows.push({
        lotNumero: lot.numero,
        lotNom: lot.nom,
        decomps: decompRows,
        montant: lotMontant,
        montantExt: lotExtMontant,
        montantInt: lotIntMontant,
        pctTotal: lotPctTotal,
        pctExt: totalExtGlobal > 0 ? (lotExtMontant / totalExtGlobal) * 100 : 0,
        pctInt: totalIntGlobal > 0 ? (lotIntMontant / totalIntGlobal) * 100 : 0,
        avancement: lotAvancement,
        avParMontant: lotAvParMontant,
      });
    }

    return { rows, totalMontantGlobal, totalExtGlobal, totalIntGlobal };
  }, [project]);

  const { rows, totalMontantGlobal, totalExtGlobal, totalIntGlobal } = recap;

  let globalAvParMontant = 0;
  for (const lot of rows) {
    const weight = totalMontantGlobal > 0 ? lot.montant / totalMontantGlobal : 0;
    globalAvParMontant += weight * lot.avParMontant;
  }

  const f = (v) => formatMontant(v);
  const pct = (v) => v.toFixed(2) + "%";
  const s12 = { fontSize: 12 };

  return (
    <div className="setup-content-wide" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Récap Avancement par Lots</h3>
            <p>Montant total : {f(totalMontantGlobal)}</p>
          </div>
        </div>

        <div className="config-table-wrap">
          <table className="config-table recap-table">
            <thead>
              <tr>
                <th rowSpan={2}>Lot</th>
                <th rowSpan={2} style={{ width: 50, textAlign: "center" }}>Type</th>
                <th rowSpan={2} style={{ textAlign: "center", fontSize: 10 }}>Nom Décomp.</th>
                <th rowSpan={2} style={{ width: 120, textAlign: "right" }}>Montant du lot</th>
                <th rowSpan={2} style={{ width: 70, textAlign: "right", fontSize: 10 }}>% du lot (Mt. total)</th>
                <th colSpan={2} className="col-int" style={{ textAlign: "center", borderBottom: "2px solid #305496" }}>Intérieur</th>
                <th colSpan={2} className="col-ext" style={{ textAlign: "center", borderBottom: "2px solid var(--terracotta)" }}>Extérieur</th>
                <th colSpan={2} style={{ textAlign: "center", borderBottom: "2px solid var(--text-primary)" }}>Avancement</th>
              </tr>
              <tr>
                <th className="col-int" style={{ width: 110, textAlign: "right", fontSize: 10 }}>Montant Int</th>
                <th className="col-int" style={{ width: 55, textAlign: "right", fontSize: 10 }}>% Int</th>
                <th className="col-ext" style={{ width: 110, textAlign: "right", fontSize: 10 }}>Montant Ext</th>
                <th className="col-ext" style={{ width: 55, textAlign: "right", fontSize: 10 }}>% Ext</th>
                <th style={{ width: 75, textAlign: "right", fontSize: 10 }}>par décomp.</th>
                <th style={{ width: 75, textAlign: "right", fontSize: 10 }}>par lot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((lot) => (
                <Fragment key={lot.lotNumero}>
                  {lot.decomps.map((d, di) => (
                    <tr key={`${lot.lotNumero}-${di}`}>
                      <td style={s12}>{d.fullLabel}</td>
                      <td className="cell-center">
                        <span className={`recap-type-badge recap-type-${d.type.toLowerCase()}`}>{d.type}</span>
                      </td>
                      <td className="cell-center cell-muted" style={s12}>{d.nomDecomp || "—"}</td>
                      <td className="cell-right cell-mono" style={s12}>{f(d.montant)}</td>
                      <td className="cell-right cell-mono cell-muted" style={s12}>{pct(d.pctMontantTotal)}</td>
                      <td className="cell-right cell-mono col-int" style={s12}>{d.montantInt > 0 ? f(d.montantInt) : "—"}</td>
                      <td className="cell-right cell-mono cell-muted col-int" style={s12}>{d.pctInt > 0 ? pct(d.pctInt) : "—"}</td>
                      <td className="cell-right cell-mono col-ext" style={s12}>{d.montantExt > 0 ? f(d.montantExt) : "—"}</td>
                      <td className="cell-right cell-mono cell-muted col-ext" style={s12}>{d.pctExt > 0 ? pct(d.pctExt) : "—"}</td>
                      <td className="cell-right cell-mono" style={s12}>{pct(d.avancement)}</td>
                      <td className="cell-right cell-mono" style={s12}>{pct(d.avParLotDecomp)}</td>
                    </tr>
                  ))}
                  <tr className="recap-subtotal-row">
                    <td colSpan={2} className="cell-bold" style={s12}>
                      &#8594; Sous-total {lot.lotNumero} — {lot.lotNom}
                    </td>
                    <td className="cell-center cell-bold" style={s12}>SOUS-TOTAL</td>
                    <td className="cell-right cell-bold cell-mono" style={s12}>{f(lot.montant)}</td>
                    <td className="cell-right cell-bold cell-mono" style={s12}>{pct(lot.pctTotal)}</td>
                    <td className="cell-right cell-bold cell-mono col-int" style={s12}>{lot.montantInt > 0 ? f(lot.montantInt) : "—"}</td>
                    <td className="cell-right cell-bold cell-mono col-int" style={s12}>{lot.pctInt > 0 ? pct(lot.pctInt) : "—"}</td>
                    <td className="cell-right cell-bold cell-mono col-ext" style={s12}>{lot.montantExt > 0 ? f(lot.montantExt) : "—"}</td>
                    <td className="cell-right cell-bold cell-mono col-ext" style={s12}>{lot.pctExt > 0 ? pct(lot.pctExt) : "—"}</td>
                    <td className="cell-right" style={{ padding: "4px 6px" }}>
                      <ProgressBar value={lot.avancement} height={5} />
                    </td>
                    <td className="cell-right cell-bold cell-mono" style={s12}>{pct(lot.avParMontant)}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="cell-bold">TOTAL GÉNÉRAL</td>
                <td className="cell-right cell-bold cell-mono">{f(totalMontantGlobal)}</td>
                <td className="cell-right cell-bold cell-mono">100%</td>
                <td className="cell-right cell-bold cell-mono col-int">{f(totalIntGlobal)}</td>
                <td className="cell-right cell-bold cell-mono col-int">100%</td>
                <td className="cell-right cell-bold cell-mono col-ext">{f(totalExtGlobal)}</td>
                <td className="cell-right cell-bold cell-mono col-ext">100%</td>
                <td></td>
                <td className="cell-right cell-bold cell-mono">{pct(globalAvParMontant)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
