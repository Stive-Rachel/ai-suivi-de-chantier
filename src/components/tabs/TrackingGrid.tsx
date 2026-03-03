import { useState, useMemo } from "react";
import { getLogementNums } from "../../lib/db";
import { STATUS_BADGE_STYLES } from "../../lib/constants";
import { useColumnResize } from "../../lib/useColumnResize";
import Icon from "../ui/Icon";
import StatusCell from "../ui/StatusCell";
import SortableHeader from "../ui/SortableHeader";
import FilterBar from "../ui/FilterBar";

const ALL_COLUMNS = [
  { key: "tache", label: "Tâches", defaultVisible: true },
  { key: "ponderation", label: "Pondération", defaultVisible: true },
  { key: "av", label: "Avancement", defaultVisible: true },
  { key: "avlot", label: "Av/Lot", defaultVisible: true },
  { key: "count", label: "Nb. fait", defaultVisible: true },
];

export default function TrackingGrid({ project, updateProject, supaSync, type }) {
  const isLogements = type === "logements";
  const lotsRaw = isLogements ? project.lotsInt : project.lotsExt;
  const lots = useMemo(() => [...(lotsRaw || [])].sort((a, b) => {
    const na = parseFloat(a.numero) || 0;
    const nb = parseFloat(b.numero) || 0;
    if (na !== nb) return na - nb;
    return (a.nom || "").localeCompare(b.nom || "");
  }), [lotsRaw]);

  const [filters, setFilters] = useState({ statusFilter: "all", searchText: "" });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [showSettings, setShowSettings] = useState(false);
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = localStorage.getItem(`tracking_cols_${type}`);
    if (saved) try { return JSON.parse(saved); } catch {}
    return Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible]));
  });
  const { colWidths, getResizeProps } = useColumnResize({});

  const toggleCol = (key) => {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`tracking_cols_${type}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return { key: null, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const entities = useMemo(() => {
    if (isLogements) {
      const result = [];
      for (const bat of project.batiments) {
        for (const num of getLogementNums(bat)) {
          result.push({ id: `${bat.id}_log_${num}`, label: `Log ${num}`, group: bat.name });
        }
      }
      return result;
    } else {
      return project.batiments.map((b) => ({ id: b.id, label: b.name, group: null }));
    }
  }, [project.batiments, isLogements]);

  const rows = useMemo(() => {
    const result = [];
    for (const lot of lots) {
      for (const decomp of lot.decompositions) {
        result.push({
          key: `${lot.trackPrefix || lot.numero}-${decomp}`,
          lotNumero: lot.numero,
          lotNom: lot.nom,
          decomposition: decomp,
        });
      }
    }
    return result;
  }, [lots]);

  const tracking = project.tracking?.[type] || {};
  const getValue = (rowKey, entityId) => tracking[rowKey]?.[entityId]?.status || "";
  const getPonderation = (rowKey) => tracking[rowKey]?._ponderation || 1;

  // Calcul avancement par décomposition
  const rowStats = useMemo(() => {
    const stats = {};
    const allLots = project.lots || [];
    for (const lot of lots) {
      const lotMarche = allLots.find((l) => l.numero === lot.numero)?.montantMarche || 0;
      const pctDuLot = lotMarche > 0 ? (lot.montant || 0) / lotMarche : 0;
      for (const decomp of lot.decompositions) {
        const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
        let done = 0;
        for (const e of entities) {
          if (tracking[key]?.[e.id]?.status === "X") done++;
        }
        const av = entities.length > 0 ? (done / entities.length) * 100 : 0;
        stats[key] = { done, total: entities.length, av, avParLot: pctDuLot * av, pctDuLot };
      }
    }
    return stats;
  }, [lots, entities, tracking, project.lots]);

  const setValue = (rowKey, entityId, status) => {
    updateProject((p) => {
      const t = { ...p.tracking };
      if (!t[type]) t[type] = {};
      if (!t[type][rowKey]) t[type][rowKey] = {};
      t[type][rowKey] = { ...t[type][rowKey], [entityId]: { status } };
      return { ...p, tracking: t };
    });
    supaSync?.setTrackingCell(type, rowKey, entityId, status);
  };

  const toggleColumn = (entityId) => {
    const allDone = rows.every((r) => getValue(r.key, entityId) === "X");
    const newStatus = allDone ? "" : "X";
    updateProject((p) => {
      const t = { ...p.tracking };
      if (!t[type]) t[type] = {};
      for (const r of rows) {
        if (!t[type][r.key]) t[type][r.key] = {};
        t[type][r.key] = { ...t[type][r.key], [entityId]: { status: newStatus } };
      }
      return { ...p, tracking: t };
    });
    for (const r of rows) {
      supaSync?.setTrackingCell(type, r.key, entityId, newStatus);
    }
  };

  const getColumnDoneCount = (entityId) => {
    let done = 0;
    for (const r of rows) {
      if (getValue(r.key, entityId) === "X") done++;
    }
    return done;
  };

  const setPonderation = (rowKey, value) => {
    const v = parseInt(value) || 1;
    updateProject((p) => {
      const t = { ...p.tracking };
      if (!t[type]) t[type] = {};
      if (!t[type][rowKey]) t[type][rowKey] = {};
      t[type][rowKey] = { ...t[type][rowKey], _ponderation: v };
      return { ...p, tracking: t };
    });
    supaSync?.setTrackingMeta(type, rowKey, { ponderation: v });
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (!row.decomposition.toLowerCase().includes(search)) return false;
      }
      if (filters.statusFilter !== "all") {
        const statuses = entities.map((e) => getValue(row.key, e.id));
        switch (filters.statusFilter) {
          case "incomplete":
            if (statuses.every((s) => s === "X")) return false;
            break;
          case "complete":
            if (!statuses.every((s) => s === "X")) return false;
            break;
          case "alert":
            if (!statuses.some((s) => s === "!")) return false;
            break;
          case "nok":
            if (!statuses.some((s) => s === "NOK")) return false;
            break;
        }
      }
      return true;
    });
  }, [rows, filters, entities, tracking]);

  // Sort rows: default A-Z by decomposition name, or by user-selected column
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      if (!sortConfig.key) {
        return a.decomposition.localeCompare(b.decomposition, "fr");
      }
      let aVal, bVal;
      if (sortConfig.key === "decomposition") {
        aVal = a.decomposition;
        bVal = b.decomposition;
      } else if (sortConfig.key === "ponderation") {
        aVal = getPonderation(a.key);
        bVal = getPonderation(b.key);
      } else {
        aVal = getValue(a.key, sortConfig.key) || "";
        bVal = getValue(b.key, sortConfig.key) || "";
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "fr");
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortConfig, tracking]);

  const visibleRowCount = sortedRows.length;

  // Count visible data columns for colspan
  const dataColCount = 1 + ALL_COLUMNS.filter((c) => visibleCols[c.key]).length;

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

  const groups = {};
  entities.forEach((e) => {
    const g = e.group || e.label;
    if (!groups[g]) groups[g] = [];
    groups[g].push(e);
  });

  return (
    <div style={{ animation: "slideInUp 0.4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>
          {isLogements ? "Suivi Intérieur — Logements" : "Suivi Extérieur — Bâtiments"}
        </h3>
        <div className="status-legend">
          {Object.entries(STATUS_BADGE_STYLES).map(([k, s]) => (
            <span key={k} className="status-badge" style={s}>
              {k}
            </span>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowSettings((v) => !v)}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}
        >
          <Icon name="settings" size={14} />
          Colonnes
        </button>
      </div>

      {showSettings && (
        <div className="grid-settings-panel">
          <span className="grid-settings-label">Colonnes visibles :</span>
          {ALL_COLUMNS.map((col) => (
            <label key={col.key} className="grid-settings-check">
              <input
                type="checkbox"
                checked={visibleCols[col.key]}
                onChange={() => toggleCol(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}

      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
      />

      {visibleRowCount !== rows.length && (
        <div className="filter-count" style={{ marginBottom: 8 }}>
          {visibleRowCount} / {rows.length} tâches affichées
        </div>
      )}

      <div className="tracking-table-scroll" style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 240px)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
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
                <th style={{ width: colWidths._tache || 100, minWidth: 70 }}>Tâches</th>
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
              {entities.map((e) => {
                const done = getColumnDoneCount(e.id);
                const allDone = done === rows.length && rows.length > 0;
                return (
                  <th
                    key={e.id}
                    style={{
                      textAlign: "center",
                      width: colWidths[e.id] || undefined,
                      minWidth: 44,
                      fontSize: 10,
                      padding: "6px 2px",
                      verticalAlign: "bottom",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{
                        writingMode: entities.length > 10 ? "vertical-lr" : undefined,
                        transform: entities.length > 10 ? "rotate(180deg)" : undefined,
                        whiteSpace: "nowrap",
                      }}>
                        {e.label}
                      </span>
                      <button
                        className="col-toggle-btn"
                        onClick={() => toggleColumn(e.id)}
                        title={allDone ? "Décocher toute la colonne" : "Cocher toute la colonne"}
                        style={{
                          width: 18, height: 18, borderRadius: 3,
                          border: `1.5px solid ${allDone ? "var(--success)" : "var(--border-default)"}`,
                          background: allDone ? "var(--success)" : "var(--bg-default)",
                          color: allDone ? "#fff" : "var(--text-tertiary)",
                          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, padding: 0, lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        {allDone ? "✓" : ""}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.key}>
                <td className="sticky-col decomp-cell" title={row.decomposition}>
                  {row.decomposition}
                </td>
                {visibleCols.tache && (
                  <td>
                    <input
                      className="task-input"
                      defaultValue={tracking[row.key]?._tache || ""}
                      onBlur={(e) => {
                        const val = e.target.value;
                        updateProject((p) => {
                          const t = { ...p.tracking };
                          if (!t[type]) t[type] = {};
                          if (!t[type][row.key]) t[type][row.key] = {};
                          t[type][row.key] = { ...t[type][row.key], _tache: val };
                          return { ...p, tracking: t };
                        });
                        supaSync?.setTrackingMeta(type, row.key, { tache: val });
                      }}
                      placeholder="—"
                    />
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
                      style={{ width: 42, textAlign: "center", padding: "2px 4px", fontSize: 12, border: "1px solid var(--border-default)", borderRadius: 4, background: "var(--bg-default)", color: "var(--text-primary)" }}
                    />
                  </td>
                )}
                {(() => {
                  const rs = rowStats[row.key] || { done: 0, total: 0, av: 0, avParLot: 0 };
                  return (
                    <>
                      {visibleCols.av && (
                        <td
                          className="cell-mono"
                          style={{ textAlign: "center", fontSize: 11, color: rs.av >= 100 ? "var(--success)" : rs.av > 0 ? "var(--warning)" : "var(--text-tertiary)" }}
                          data-tooltip={`${rs.done} / ${rs.total} ${isLogements ? "logements" : "bâtiments"}\n= ${rs.av.toFixed(2)}%`}
                        >
                          {rs.av.toFixed(2)}%
                        </td>
                      )}
                      {visibleCols.avlot && (
                        <td
                          className="cell-mono"
                          style={{ textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}
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
                    </>
                  );
                })()}
                {entities.map((e) => (
                  <td
                    key={e.id}
                    style={{
                      textAlign: "center",
                      padding: 2,
                      width: colWidths[e.id] || undefined,
                    }}
                  >
                    <StatusCell value={getValue(row.key, e.id)} onChange={(s) => setValue(row.key, e.id, s)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, fontSize: 12, background: "var(--bg-raised)" }}>
              <td className="sticky-col">Total</td>
              {visibleCols.tache && <td></td>}
              {visibleCols.ponderation && (
                <td style={{ textAlign: "center" }}>
                  {rows.reduce((s, r) => s + getPonderation(r.key), 0)}
                </td>
              )}
              {(() => {
                let totalAv = 0, totalAvLot = 0, totalDone = 0;
                for (const r of rows) {
                  const rs = rowStats[r.key];
                  if (rs) { totalAvLot += rs.avParLot; totalDone += rs.done; }
                }
                totalAv = rows.length > 0
                  ? rows.reduce((s, r) => s + (rowStats[r.key]?.av || 0), 0) / rows.length
                  : 0;
                return (
                  <>
                    {visibleCols.av && (
                      <td style={{ textAlign: "center", fontSize: 10 }}>{totalAv.toFixed(2)}%</td>
                    )}
                    {visibleCols.avlot && (
                      <td style={{ textAlign: "center", fontSize: 10 }}>{totalAvLot.toFixed(2)}%</td>
                    )}
                    {visibleCols.count && (
                      <td style={{ textAlign: "center", fontSize: 10 }}>{totalDone}</td>
                    )}
                  </>
                );
              })()}
              {entities.map((e) => (
                <td key={e.id} style={{ textAlign: "center", fontSize: 10, width: colWidths[e.id] || undefined }}>
                  {(() => {
                    let done = 0, total = 0;
                    for (const r of rows) {
                      const p = getPonderation(r.key);
                      total += p;
                      if (getValue(r.key, e.id) === "X") done += p;
                    }
                    return total > 0 ? ((done / total) * 100).toFixed(2) + "%" : "—";
                  })()}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
