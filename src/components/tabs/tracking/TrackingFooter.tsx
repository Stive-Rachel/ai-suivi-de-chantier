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

  // Weighted average of av by ponderation
  let pondSum = 0;
  let pondAvSum = 0;
  for (const r of rows) {
    const rs = rowStats[r.key];
    if (rs) {
      totalDone += rs.done;
      const pond = getPonderation(r.key);
      pondAvSum += pond * rs.av;
      pondSum += pond;
    }
  }
  const totalAv = pondSum > 0 ? pondAvSum / pondSum : 0;

  // Weighted average per lot, then weight across lots by pctDuLot
  const lotGroups: Record<string, { pctDuLot: number; keys: string[] }> = {};
  for (const r of rows) {
    const rs = rowStats[r.key];
    if (!rs) continue;
    if (!lotGroups[r.lotNumero]) {
      lotGroups[r.lotNumero] = { pctDuLot: rs.pctDuLot, keys: [] };
    }
    lotGroups[r.lotNumero].keys.push(r.key);
  }

  let totalAvLot = 0;
  for (const group of Object.values(lotGroups)) {
    let gPondSum = 0;
    let gPondAvSum = 0;
    for (const key of group.keys) {
      const rs = rowStats[key];
      const pond = getPonderation(key);
      gPondAvSum += pond * (rs?.av || 0);
      gPondSum += pond;
    }
    const lotProgress = gPondSum > 0 ? gPondAvSum / gPondSum : 0;
    totalAvLot += group.pctDuLot * lotProgress;
  }

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
