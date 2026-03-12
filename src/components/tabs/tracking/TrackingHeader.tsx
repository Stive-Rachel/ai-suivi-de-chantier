import Icon from "../../ui/Icon";
import FilterBar from "../../ui/FilterBar";
import type { StatusBadgeStyle } from "../../../types";
import { STATUS_BADGE_STYLES } from "../../../lib/constants";
import type { TrackingFilters } from "./useTrackingData";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

interface TrackingHeaderProps {
  isLogements: boolean;
  activeCount: number;
  totalCount: number;
  excCount: number;
  showSettings: boolean;
  onToggleSettings: () => void;
  allColumns: readonly ColumnDef[];
  visibleCols: Record<string, boolean>;
  onToggleCol: (key: string) => void;
  filters: TrackingFilters;
  onFilterChange: (filters: TrackingFilters) => void;
  visibleRowCount: number;
  totalRowCount: number;
}

export default function TrackingHeader({
  isLogements,
  activeCount,
  totalCount,
  excCount,
  showSettings,
  onToggleSettings,
  allColumns,
  visibleCols,
  onToggleCol,
  filters,
  onFilterChange,
  visibleRowCount,
  totalRowCount,
}: TrackingHeaderProps) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>
          {isLogements
            ? "Suivi Intérieur — Logements"
            : "Suivi Extérieur — Bâtiments"}
        </h3>
        {isLogements && excCount > 0 && (
          <span className="exception-summary-badge">
            {activeCount}/{totalCount} actifs ({excCount} exc.)
          </span>
        )}
        <div className="status-legend">
          {Object.entries(STATUS_BADGE_STYLES).map(([k, s]) => (
            <span key={k} className="status-badge" style={s as React.CSSProperties}>
              {k}
            </span>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onToggleSettings}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="settings" size={14} />
          Colonnes
        </button>
      </div>

      {showSettings && (
        <div className="grid-settings-panel">
          <span className="grid-settings-label">Colonnes visibles :</span>
          {allColumns.map((col) => (
            <label key={col.key} className="grid-settings-check">
              <input
                type="checkbox"
                checked={visibleCols[col.key]}
                onChange={() => onToggleCol(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}

      <FilterBar filters={filters} onFilterChange={onFilterChange} showEntityFilter={isLogements} />

      {visibleRowCount !== totalRowCount && (
        <div className="filter-count" style={{ marginBottom: 8 }}>
          {visibleRowCount} / {totalRowCount} tâches affichées
        </div>
      )}
    </>
  );
}
