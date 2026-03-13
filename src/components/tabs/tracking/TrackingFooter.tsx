import type { TrackingEntity, TrackingRowData, RowStat } from "./useTrackingData";
import type { ExceptionsMap, CellStatus } from "../../../types";

interface TrackingFooterProps {
  rows: TrackingRowData[];
  rowStats: Record<string, RowStat>;
  entities: TrackingEntity[];
  isLogements: boolean;
  exceptions: ExceptionsMap;
  visibleCols: Record<string, boolean>;
  colWidths: Record<string, number | undefined>;
  getPonderation: (rowKey: string) => number;
  getValue: (rowKey: string, entityId: string) => CellStatus | string;
}

export default function TrackingFooter({
  rows,
  rowStats,
  entities,
  isLogements,
  exceptions,
  visibleCols,
  colWidths,
  getPonderation,
  getValue,
}: TrackingFooterProps) {
  let totalDone = 0;

  // Total AV: cell-count formula (matches computeDetailedProgress)
  // = sum(pond × done) / sum(pond × active) × 100
  let totalDoneWeighted = 0;
  let totalPondActive = 0;
  for (const r of rows) {
    const rs = rowStats[r.key];
    if (rs) {
      totalDone += rs.done;
      const pond = getPonderation(r.key);
      totalDoneWeighted += pond * rs.done;
      totalPondActive += pond * rs.total;
    }
  }
  const totalAv = totalPondActive > 0 ? (totalDoneWeighted / totalPondActive) * 100 : 0;

  // Total AV/LOT: per-lot progress weighted by lot montant
  // (matches Dashboard computation from computeDetailedProgress)
  const lotGroups: Record<string, { montant: number; keys: string[] }> = {};
  for (const r of rows) {
    const rs = rowStats[r.key];
    if (!rs) continue;
    if (!lotGroups[r.lotNumero]) {
      lotGroups[r.lotNumero] = { montant: rs.lotMontant, keys: [] };
    }
    lotGroups[r.lotNumero].keys.push(r.key);
  }

  let totalAvLot = 0;
  let totalMontant = 0;
  for (const group of Object.values(lotGroups)) {
    let lotDoneW = 0;
    let lotPondActive = 0;
    for (const key of group.keys) {
      const rs = rowStats[key];
      const pond = getPonderation(key);
      lotDoneW += pond * (rs?.done || 0);
      lotPondActive += pond * (rs?.total || 0);
    }
    const lotProgress = lotPondActive > 0 ? (lotDoneW / lotPondActive) * 100 : 0;
    totalAvLot += group.montant * lotProgress;
    totalMontant += group.montant;
  }
  totalAvLot = totalMontant > 0 ? totalAvLot / totalMontant : 0;

  return (
    <tfoot>
      <tr style={{ fontWeight: 600, fontSize: 12, background: "var(--bg-raised)" }}>
        <td className="sticky-col">Total</td>
        {visibleCols.tache && <td></td>}
        {visibleCols.ponderation && (
          <td style={{ textAlign: "center" }}>
            {rows.reduce((s, r) => s + getPonderation(r.key), 0)}
          </td>
        )}
        {visibleCols.av && (
          <td style={{ textAlign: "center", fontSize: 10 }}>
            {totalAv.toFixed(2)}%
          </td>
        )}
        {visibleCols.avlot && (
          <td style={{ textAlign: "center", fontSize: 10 }}>
            {totalAvLot.toFixed(2)}%
          </td>
        )}
        {visibleCols.count && (
          <td style={{ textAlign: "center", fontSize: 10 }}>{totalDone}</td>
        )}
        {entities.map((e) => {
          const isExc = isLogements && exceptions[e.id];
          return (
            <td
              key={e.id}
              className={isExc ? "cell-exception" : ""}
              style={{
                textAlign: "center",
                fontSize: 10,
                width: colWidths[e.id] || undefined,
              }}
            >
              {(() => {
                if (isExc)
                  return <span className="exc-label-footer">exc.</span>;
                let done = 0;
                let total = 0;
                for (const r of rows) {
                  const p = getPonderation(r.key);
                  const v = getValue(r.key, e.id);
                  if (v === "N/A") continue;
                  total += p;
                  if (v === "X") done += p;
                }
                return total > 0
                  ? ((done / total) * 100).toFixed(2) + "%"
                  : "\u2014";
              })()}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}
