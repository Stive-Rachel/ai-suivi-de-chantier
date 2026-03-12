import { useState, useCallback } from "react";
import { useColumnResize } from "../../lib/useColumnResize";
import Icon from "../ui/Icon";
import StatusCell from "../ui/StatusCell";
import SortableHeader from "../ui/SortableHeader";
import { useScrollSync } from "./tracking/useScrollSync";
import { useTrackingData } from "./tracking/useTrackingData";
import type { TrackingFilters, SortConfig } from "./tracking/useTrackingData";
import TrackingHeader, { type ColumnDef } from "./tracking/TrackingHeader";
import TrackingFooter from "./tracking/TrackingFooter";
import type { Project, ExceptionsMap } from "../../types";

const ALL_COLUMNS: readonly ColumnDef[] = [
  { key: "tache", label: "Lot", defaultVisible: true },
  { key: "ponderation", label: "Pondération", defaultVisible: true },
  { key: "av", label: "Avancement", defaultVisible: true },
  { key: "avlot", label: "Av/Lot", defaultVisible: true },
  { key: "count", label: "Nb. fait", defaultVisible: true },
] as const;

interface SupaSync {
  updateFields?: (fields: Record<string, unknown>) => void;
  setTrackingCell: (type: string, rowKey: string, entityId: string, status: string) => void;
  setTrackingMeta: (type: string, rowKey: string, meta: Record<string, unknown>) => void;
}

interface TrackingGridProps {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
  supaSync?: SupaSync;
  type: "logements" | "batiments";
  readOnly?: boolean;
}

export default function TrackingGrid({
  project,
  updateProject,
  supaSync,
  type,
  readOnly = false,
}: TrackingGridProps) {
  const [filters, setFilters] = useState<TrackingFilters>({
    statusFilter: "all",
    searchText: "",
    entitySearch: "",
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`tracking_cols_${type}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore invalid JSON
      }
    }
    return Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible]));
  });

  const { colWidths, getResizeProps } = useColumnResize({});
  const { topScrollRef, topScrollInner, mainScrollRef, handleTopScroll, handleMainScroll } =
    useScrollSync();

  const {
    isLogements,
    entities,
    activeEntities,
    excCount,
    rows,
    rowStats,
    sortedRows,
    tracking,
    exceptions,
    getValue,
    getPonderation,
  } = useTrackingData({ project, type, filters, sortConfig });

  // --- Column/cell operations ---

  const toggleCol = useCallback(
    (key: string) => {
      setVisibleCols((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        localStorage.setItem(`tracking_cols_${type}`, JSON.stringify(next));
        return next;
      });
    },
    [type],
  );

  const toggleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return { key: null, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const toggleException = useCallback(
    (entityId: string) => {
      updateProject((p) => {
        const exc: ExceptionsMap = { ...(p.exceptions || {}) };
        if (exc[entityId]) {
          delete exc[entityId];
        } else {
          exc[entityId] = true;
        }
        supaSync?.updateFields?.({ exceptions: exc });
        return { ...p, exceptions: exc };
      });
    },
    [updateProject, supaSync],
  );

  const setValue = useCallback(
    (rowKey: string, entityId: string, status: string) => {
      updateProject((p) => {
        const t = { ...p.tracking };
        if (!t[type]) t[type] = {} as typeof t[typeof type];
        if (!t[type][rowKey]) t[type][rowKey] = {};
        t[type][rowKey] = { ...t[type][rowKey], [entityId]: { status } };
        return { ...p, tracking: t };
      });
      supaSync?.setTrackingCell(type, rowKey, entityId, status);
    },
    [updateProject, supaSync, type],
  );

  const toggleColumn = useCallback(
    (entityId: string) => {
      const allDone = rows.every((r) => getValue(r.key, entityId) === "X");
      const newStatus = allDone ? "" : "X";
      updateProject((p) => {
        const t = { ...p.tracking };
        if (!t[type]) t[type] = {} as typeof t[typeof type];
        for (const r of rows) {
          if (!t[type][r.key]) t[type][r.key] = {};
          t[type][r.key] = { ...t[type][r.key], [entityId]: { status: newStatus } };
        }
        return { ...p, tracking: t };
      });
      for (const r of rows) {
        supaSync?.setTrackingCell(type, r.key, entityId, newStatus);
      }
    },
    [rows, getValue, updateProject, supaSync, type],
  );

  const getColumnDoneCount = useCallback(
    (entityId: string): number => {
      let done = 0;
      for (const r of rows) {
        if (getValue(r.key, entityId) === "X") done++;
      }
      return done;
    },
    [rows, getValue],
  );

  const setPonderation = useCallback(
    (rowKey: string, value: string) => {
      const v = parseInt(value) || 1;
      updateProject((p) => {
        const t = { ...p.tracking };
        if (!t[type]) t[type] = {} as typeof t[typeof type];
        if (!t[type][rowKey]) t[type][rowKey] = {};
        t[type][rowKey] = { ...t[type][rowKey], _ponderation: v };
        return { ...p, tracking: t };
      });
      supaSync?.setTrackingMeta(type, rowKey, { ponderation: v });
    },
    [updateProject, supaSync, type],
  );

  // --- Filter entities by logement number search ---

  const displayEntities = filters.entitySearch
    ? entities.filter((e) => e.label.toLowerCase().includes(filters.entitySearch!.toLowerCase()))
    : entities;

  // --- Derived values ---

  const visibleRowCount = sortedRows.length;
  const dataColCount = 1 + ALL_COLUMNS.filter((c) => visibleCols[c.key]).length;

  // --- Empty state ---

  if (project.batiments.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name="building" size={32} />
        </div>
        <h3>Aucun bâtiment configuré</h3>
        <p>Configurez d'abord vos bâtiments dans l'onglet Configuration</p>
      </div>
    );
  }

  // --- Groups for column headers ---

  const groups: Record<string, typeof entities> = {};
  displayEntities.forEach((e) => {
    const g = e.group || e.label;
    if (!groups[g]) groups[g] = [];
    groups[g].push(e);
  });

  return (
    <div style={{ animation: "slideInUp 0.4s ease both" }}>
      <TrackingHeader
        isLogements={isLogements}
        activeCount={activeEntities.length}
        totalCount={entities.length}
        excCount={excCount}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((v) => !v)}
        allColumns={ALL_COLUMNS}
        visibleCols={visibleCols}
        onToggleCol={toggleCol}
        filters={filters}
        onFilterChange={setFilters}
        visibleRowCount={visibleRowCount}
        totalRowCount={rows.length}
      />

      {/* Top scrollbar mirror */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        style={{ overflowX: "auto", overflowY: "hidden", marginBottom: -1 }}
      >
        <div ref={topScrollInner} style={{ height: 1 }} />
      </div>

      <div
        ref={mainScrollRef}
        onScroll={handleMainScroll}
        className="tracking-table-scroll"
        style={{
          overflow: "auto",
          maxHeight: "calc(100vh - 240px)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-default)",
        }}
      >
        <table className="tracking-table" role="grid" aria-label="Grille de suivi">
          <thead>
            {isLogements && (
              <tr className="group-header">
                <th colSpan={dataColCount} style={{ background: "var(--bg-raised)" }} />
                {Object.entries(groups).map(([gName, gEntities]) => (
                  <th key={gName} colSpan={gEntities.length}>
                    {gName}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <SortableHeader
                className="sticky-col"
                style={{ minWidth: 200 }}
                sortKey="decomposition"
                sortConfig={sortConfig}
                onSort={toggleSort}
                resizeProps={getResizeProps("_decomp")}
              >
                Décomposition
              </SortableHeader>
              {visibleCols.tache && (
                <th style={{ width: colWidths._tache || 100, minWidth: 70 }}>Lot</th>
              )}
              {visibleCols.ponderation && (
                <SortableHeader
                  style={{ width: 50, textAlign: "center", fontSize: 10 }}
                  sortKey="ponderation"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                >
                  Pond.
                </SortableHeader>
              )}
              {visibleCols.av && (
                <th style={{ width: 60, textAlign: "center", fontSize: 10 }}>Av.</th>
              )}
              {visibleCols.avlot && (
                <th style={{ width: 60, textAlign: "center", fontSize: 10 }}>Av/lot</th>
              )}
              {visibleCols.count && (
                <th style={{ width: 40, textAlign: "center", fontSize: 10 }}>N</th>
              )}
              {displayEntities.map((e) => {
                const isExc = isLogements && exceptions[e.id];
                const done = getColumnDoneCount(e.id);
                const allDone = done === rows.length && rows.length > 0;
                return (
                  <th
                    key={e.id}
                    className={isExc ? "col-exception" : ""}
                    style={{
                      textAlign: "center",
                      width: colWidths[e.id] || undefined,
                      minWidth: 44,
                      fontSize: 10,
                      padding: "6px 2px",
                      verticalAlign: "bottom",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          writingMode: entities.length > 10 ? "vertical-lr" : undefined,
                          transform: entities.length > 10 ? "rotate(180deg)" : undefined,
                          whiteSpace: "nowrap",
                          opacity: isExc ? 0.5 : 1,
                        }}
                      >
                        {e.label}
                      </span>
                      {isLogements && !readOnly && (
                        <button
                          className={`exc-toggle-btn ${isExc ? "exc-active" : ""}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleException(e.id);
                          }}
                          title={
                            isExc
                              ? "Réintégrer ce logement"
                              : "Marquer comme exception (exclu du calcul)"
                          }
                          style={{
                            width: 26,
                            height: 14,
                            borderRadius: 7,
                            border: `1px solid ${isExc ? "var(--warning)" : "var(--border-default)"}`,
                            background: isExc ? "var(--warning)" : "var(--bg-elevated)",
                            color: isExc ? "#fff" : "var(--text-tertiary)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: isExc ? "flex-end" : "flex-start",
                            fontSize: 8,
                            fontWeight: 600,
                            padding: "0 2px",
                            lineHeight: 1,
                            flexShrink: 0,
                            transition: "all 0.2s ease",
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: isExc ? "#fff" : "var(--text-tertiary)",
                              transition: "all 0.2s ease",
                            }}
                          />
                        </button>
                      )}
                      {!readOnly && (
                        <button
                          className="col-toggle-btn"
                          onClick={() => toggleColumn(e.id)}
                          title={
                            allDone
                              ? "Décocher toute la colonne"
                              : "Cocher toute la colonne"
                          }
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 3,
                            border: `1.5px solid ${allDone ? "var(--success)" : "var(--border-default)"}`,
                            background: allDone ? "var(--success)" : "var(--bg-default)",
                            color: allDone ? "#fff" : "var(--text-tertiary)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: 0,
                            lineHeight: 1,
                            flexShrink: 0,
                            opacity: isExc ? 0.4 : 1,
                          }}
                        >
                          {allDone ? "\u2713" : ""}
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const rs = rowStats[row.key] || {
                done: 0,
                total: 0,
                av: 0,
                avParLot: 0,
                pctDuLot: 0,
              };
              const excLabel = excCount > 0 ? ` (${excCount} exc.)` : "";
              return (
                <tr key={row.key}>
                  <td
                    className="sticky-col decomp-cell"
                    title={`${row.lotNumero} - ${row.lotNom} — ${row.decomposition}`}
                  >
                    <span className="decomp-lot-tag">{row.lotNumero}</span>
                    {row.decomposition}
                  </td>
                  {visibleCols.tache && (
                    <td style={{ fontSize: 11, whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {row.lotNom}
                    </td>
                  )}
                  {visibleCols.ponderation && (
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="number"
                        className="pond-input"
                        min={1}
                        step={1}
                        value={getPonderation(row.key)}
                        onChange={(e) => setPonderation(row.key, e.target.value)}
                        readOnly={readOnly}
                        style={{
                          width: 42,
                          textAlign: "center",
                          padding: "2px 4px",
                          fontSize: 12,
                          border: "1px solid var(--border-default)",
                          borderRadius: 4,
                          background: "var(--bg-default)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </td>
                  )}
                  {visibleCols.av && (
                    <td
                      className="cell-mono"
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        color:
                          rs.av >= 100
                            ? "var(--success)"
                            : rs.av > 0
                              ? "var(--warning)"
                              : "var(--text-tertiary)",
                      }}
                      data-tooltip={`${rs.done} / ${rs.total} ${isLogements ? "logements" : "bâtiments"}${excLabel}\n= ${rs.av.toFixed(2)}%`}
                    >
                      {rs.av.toFixed(2)}%
                    </td>
                  )}
                  {visibleCols.avlot && (
                    <td
                      className="cell-mono"
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                      }}
                      data-tooltip={`${(rs.pctDuLot * 100).toFixed(2)}% du lot × ${rs.av.toFixed(2)}%\n= ${rs.avParLot.toFixed(2)}%`}
                    >
                      {rs.avParLot.toFixed(2)}%
                    </td>
                  )}
                  {visibleCols.count && (
                    <td
                      className="cell-mono"
                      style={{ textAlign: "center", fontSize: 11, fontWeight: 600 }}
                    >
                      {rs.done}
                    </td>
                  )}
                  {displayEntities.map((e) => {
                    const isExc = isLogements && exceptions[e.id];
                    return (
                      <td
                        key={e.id}
                        className={isExc ? "cell-exception" : ""}
                        style={{
                          textAlign: "center",
                          padding: 2,
                          width: colWidths[e.id] || undefined,
                        }}
                      >
                        <StatusCell
                          value={getValue(row.key, e.id)}
                          onChange={(s: string) => setValue(row.key, e.id, s)}
                          readOnly={readOnly}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <TrackingFooter
            rows={rows}
            rowStats={rowStats}
            entities={displayEntities}
            isLogements={isLogements}
            exceptions={exceptions}
            visibleCols={visibleCols}
            colWidths={colWidths}
            getPonderation={getPonderation}
            getValue={getValue}
          />
        </table>
      </div>
    </div>
  );
}
