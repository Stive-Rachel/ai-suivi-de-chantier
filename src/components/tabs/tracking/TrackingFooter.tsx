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
  let totalAv = 0;
  let totalAvLot = 0;
  let totalDone = 0;

  for (const r of rows) {
    const rs = rowStats[r.key];
    if (rs) {
      totalAvLot += rs.avParLot;
      totalDone += rs.done;
    }
  }

  totalAv =
    rows.length > 0
      ? rows.reduce((s, r) => s + (rowStats[r.key]?.av || 0), 0) / rows.length
      : 0;

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
