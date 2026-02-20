import { useState, useMemo, Fragment } from "react";
import { getLogementNums } from "../../lib/db";
import { STATUS_BADGE_STYLES } from "../../lib/constants";
import { useColumnResize } from "../../lib/useColumnResize";
import Icon from "../ui/Icon";
import StatusCell from "../ui/StatusCell";
import SortableHeader from "../ui/SortableHeader";
import FilterBar from "../ui/FilterBar";

export default function TrackingGrid({ project, updateProject, type }) {
  const isLogements = type === "logements";
  const lots = isLogements ? project.lotsInt : project.lotsExt;

  const [filters, setFilters] = useState({ lotNumero: "", statusFilter: "all", searchText: "" });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const { colWidths, getResizeProps } = useColumnResize({});

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

  const setValue = (rowKey, entityId, status) => {
    updateProject((p) => {
      const t = { ...p.tracking };
      if (!t[type]) t[type] = {};
      if (!t[type][rowKey]) t[type][rowKey] = {};
      t[type][rowKey] = { ...t[type][rowKey], [entityId]: { status } };
      return { ...p, tracking: t };
    });
  };

  const setPonderation = (rowKey, value) => {
    updateProject((p) => {
      const t = { ...p.tracking };
      if (!t[type]) t[type] = {};
      if (!t[type][rowKey]) t[type][rowKey] = {};
      t[type][rowKey] = { ...t[type][rowKey], _ponderation: parseInt(value) || 1 };
      return { ...p, tracking: t };
    });
  };

  // Group rows by lot
  const lotGroups = useMemo(() => {
    const g = {};
    rows.forEach((r) => {
      if (!g[r.lotNumero]) g[r.lotNumero] = { nom: r.lotNom, rows: [] };
      g[r.lotNumero].rows.push(r);
    });
    return g;
  }, [rows]);

  // Filter
  const filteredLotGroups = useMemo(() => {
    const result = {};
    for (const [lotNum, lotGroup] of Object.entries(lotGroups)) {
      if (filters.lotNumero && lotNum !== filters.lotNumero) continue;

      const filteredRows = lotGroup.rows.filter((row) => {
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

      if (filteredRows.length > 0) {
        result[lotNum] = { nom: lotGroup.nom, rows: filteredRows };
      }
    }
    return result;
  }, [lotGroups, filters, entities, tracking]);

  // Sort within lot groups
  const sortedLotGroups = useMemo(() => {
    if (!sortConfig.key) return filteredLotGroups;
    const result = {};
    for (const [lotNum, lotGroup] of Object.entries(filteredLotGroups)) {
      const sorted = [...lotGroup.rows].sort((a, b) => {
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
      result[lotNum] = { nom: lotGroup.nom, rows: sorted };
    }
    return result;
  }, [filteredLotGroups, sortConfig, tracking]);

  const visibleRowCount = Object.values(sortedLotGroups).reduce((s, g) => s + g.rows.length, 0);

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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
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
      </div>

      <FilterBar
        lots={lots.map((l) => ({ numero: l.numero, nom: l.nom }))}
        filters={filters}
        onFilterChange={setFilters}
      />

      {visibleRowCount !== rows.length && (
        <div className="filter-count" style={{ marginBottom: 8 }}>
          {visibleRowCount} / {rows.length} tâches affichées
        </div>
      )}

      <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }}>
        <table className="tracking-table">
          <thead>
            {isLogements && (
              <tr className="group-header">
                <th colSpan={3} style={{ background: "var(--bg-raised)" }} />
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
              >
                Lot — Décomposition
              </SortableHeader>
              <th style={{ minWidth: 120 }}>Tâches</th>
              <SortableHeader
                style={{ width: 55, textAlign: "center" }}
                sortKey="ponderation"
                sortConfig={sortConfig}
                onSort={toggleSort}
              >
                Pond.
              </SortableHeader>
              {entities.map((e) => (
                <SortableHeader
                  key={e.id}
                  sortKey={e.id}
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                  resizeProps={getResizeProps(e.id)}
                  style={{
                    textAlign: "center",
                    width: colWidths[e.id] || undefined,
                    minWidth: 42,
                    fontSize: 10,
                    writingMode: entities.length > 12 ? "vertical-lr" : undefined,
                    transform: entities.length > 12 ? "rotate(180deg)" : undefined,
                  }}
                >
                  {e.label}
                </SortableHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(sortedLotGroups).map(([lotNum, lotGroup]) => (
              <Fragment key={lotNum}>
                <tr className="lot-separator">
                  <td colSpan={3 + entities.length}>
                    LOT {lotNum} — {lotGroup.nom}
                  </td>
                </tr>
                {lotGroup.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="sticky-col">{row.decomposition}</td>
                    <td>
                      <input
                        className="task-input"
                        defaultValue={tracking[row.key]?._tache || ""}
                        onBlur={(e) => {
                          updateProject((p) => {
                            const t = { ...p.tracking };
                            if (!t[type]) t[type] = {};
                            if (!t[type][row.key]) t[type][row.key] = {};
                            t[type][row.key] = { ...t[type][row.key], _tache: e.target.value };
                            return { ...p, tracking: t };
                          });
                        }}
                        placeholder="—"
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <select
                        className="pond-select"
                        value={getPonderation(row.key)}
                        onChange={(e) => setPonderation(row.key, e.target.value)}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
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
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, fontSize: 12, background: "var(--bg-raised)" }}>
              <td className="sticky-col">Total pondérations</td>
              <td></td>
              <td style={{ textAlign: "center" }}>
                {rows.reduce((s, r) => s + getPonderation(r.key), 0)}
              </td>
              {entities.map((e) => (
                <td key={e.id} style={{ textAlign: "center", fontSize: 10, width: colWidths[e.id] || undefined }}>
                  {(() => {
                    let done = 0, total = 0;
                    for (const r of rows) {
                      const p = getPonderation(r.key);
                      total += p;
                      if (getValue(r.key, e.id) === "X") done += p;
                    }
                    return total > 0 ? ((done / total) * 100).toFixed(0) + "%" : "—";
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
