import { useState, useMemo, useCallback } from "react";
import { getLogementNums } from "../../lib/db";
import type { Project, PlanningLogementEntry } from "../../types";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the Monday of the ISO week containing `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Add N weeks to a date. */
function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 7 * n);
  return d;
}

/** Format date as YYYY-MM-DD. */
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format date for display: DD/MM/YYYY. */
function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Determine how many weeks from project start to today + a buffer. */
function computeWeekCount(startDate: string): number {
  if (!startDate) return 12;
  const start = getMonday(new Date(startDate));
  const now = new Date();
  const diff = Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  // Show at least 4 more weeks beyond today, minimum 8 total
  return Math.max(diff + 4, 8);
}

// ─── Compute actual completed logements ─────────────────────────────────────

/**
 * A logement is "fully done" when ALL its decomposition rows across ALL lots
 * have status "X" in the INT tracking grid.
 */
function countCompletedLogements(project: Project): number {
  const tracking = project.tracking?.logements || {};
  const lotsInt = project.lotsInt || [];

  // Collect all logement entity IDs
  const allLogementIds: string[] = [];
  for (const bat of project.batiments) {
    for (const num of getLogementNums(bat)) {
      allLogementIds.push(`${bat.id}_log_${num}`);
    }
  }

  if (allLogementIds.length === 0) return 0;

  // Build set of all row keys (decomposition steps)
  const allRowKeys: string[] = [];
  for (const lot of lotsInt) {
    for (const decomp of lot.decompositions) {
      allRowKeys.push(`${lot.trackPrefix || lot.numero}-${decomp}`);
    }
  }

  if (allRowKeys.length === 0) return 0;

  let completed = 0;
  for (const entityId of allLogementIds) {
    let allDone = true;
    for (const rowKey of allRowKeys) {
      const cell = tracking[rowKey]?.[entityId] as { status?: string } | undefined;
      if (cell?.status !== "X") {
        allDone = false;
        break;
      }
    }
    if (allDone) completed++;
  }
  return completed;
}

function getTotalLogements(project: Project): number {
  return project.batiments.reduce((sum, bat) => sum + getLogementNums(bat).length, 0);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PlanningTabProps {
  project: Project;
  updateProject: (updater: (p: Project) => Project) => void;
  supaSync: any;
}

export default function PlanningTab({ project, updateProject, supaSync }: PlanningTabProps) {
  const [editingCell, setEditingCell] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [extraWeeks, setExtraWeeks] = useState(0);

  const startDate = project.dateDebutInt || project.dateDebutChantier || "";
  const baseWeekCount = computeWeekCount(startDate);
  const maxPlannedWeek = useMemo(() => {
    const entries = project.planningLogements || [];
    return entries.reduce((max, e) => Math.max(max, e.semaine), 0);
  }, [project.planningLogements]);
  const weekCount = Math.max(baseWeekCount, maxPlannedWeek) + extraWeeks;
  const totalLogements = getTotalLogements(project);
  const completedLogements = useMemo(() => countCompletedLogements(project), [project]);

  // Build the week rows from the planning data
  const planningMap = useMemo(() => {
    const map = new Map<number, PlanningLogementEntry>();
    for (const entry of project.planningLogements || []) {
      map.set(entry.semaine, entry);
    }
    return map;
  }, [project.planningLogements]);

  const weeks = useMemo(() => {
    if (!startDate) return [];
    const monday = getMonday(new Date(startDate));
    const result: Array<{
      semaine: number;
      dateDebut: string;
      cible: number;
    }> = [];
    for (let i = 0; i < weekCount; i++) {
      const weekStart = addWeeks(monday, i);
      const semaine = i + 1;
      const existing = planningMap.get(semaine);
      result.push({
        semaine,
        dateDebut: toISO(weekStart),
        cible: existing?.cible ?? 0,
      });
    }
    return result;
  }, [startDate, weekCount, planningMap]);

  // Cumulative cible: running sum of per-week targets
  const cibleCumul = useMemo(() => {
    let sum = 0;
    return weeks.map((w) => { sum += w.cible; return sum; });
  }, [weeks]);

  // Determine which week is "current"
  const currentWeekIndex = useMemo(() => {
    if (!startDate) return -1;
    const monday = getMonday(new Date(startDate));
    const now = new Date();
    const diff = Math.floor((now.getTime() - monday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return diff;
  }, [startDate]);

  const updateCible = useCallback(
    (semaine: number, dateDebut: string, value: number) => {
      updateProject((p) => {
        const existing = [...(p.planningLogements || [])];
        const idx = existing.findIndex((e) => e.semaine === semaine);
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], cible: value };
        } else {
          existing.push({ semaine, dateDebut, cible: value });
        }
        // Sort by semaine
        existing.sort((a, b) => a.semaine - b.semaine);
        return { ...p, planningLogements: existing };
      });
      // Sync planning data to Supabase via updateFields (stored as JSON)
      supaSync?.updateFields?.({});
    },
    [updateProject, supaSync]
  );

  const addMoreWeeks = useCallback(() => {
    setExtraWeeks((prev) => prev + 4);
  }, []);

  const handleStartEdit = (semaine: number, currentCible: number) => {
    setEditingCell(semaine);
    setEditValue(String(currentCible));
  };

  const handleFinishEdit = (semaine: number, dateDebut: string) => {
    const parsed = parseInt(editValue) || 0;
    const clamped = Math.max(0, Math.min(parsed, totalLogements));
    updateCible(semaine, dateDebut, clamped);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, semaine: number, dateDebut: string) => {
    if (e.key === "Enter") {
      handleFinishEdit(semaine, dateDebut);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleFinishEdit(semaine, dateDebut);
      // Move to next row
      const nextWeek = weeks.find((w) => w.semaine === semaine + 1);
      if (nextWeek) {
        // Small timeout to let state update
        setTimeout(() => handleStartEdit(nextWeek.semaine, nextWeek.cible), 0);
      }
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!startDate) {
    return (
      <div className="empty-state" style={{ animation: "slideInUp 0.4s ease both" }}>
        <div className="empty-state-icon">
          <Icon name="calendar" size={32} />
        </div>
        <h3>Date de debut non configuree</h3>
        <p>
          Configurez la date de debut des travaux interieurs ou la date de debut
          de chantier dans l'onglet Configuration pour activer le planning.
        </p>
      </div>
    );
  }

  if (project.batiments.length === 0) {
    return (
      <div className="empty-state" style={{ animation: "slideInUp 0.4s ease both" }}>
        <div className="empty-state-icon">
          <Icon name="building" size={32} />
        </div>
        <h3>Aucun batiment configure</h3>
        <p>Configurez d'abord vos batiments dans l'onglet Configuration</p>
      </div>
    );
  }

  // Find the cumulative cible for current week
  const cibleCourante = currentWeekIndex >= 0 && currentWeekIndex < cibleCumul.length ? cibleCumul[currentWeekIndex] : 0;

  // Calculate ecart (gap)
  const ecart = completedLogements - cibleCourante;
  const ecartColor = ecart >= 0 ? "var(--success)" : "var(--danger)";
  const ecartSign = ecart >= 0 ? "+" : "";

  return (
    <div style={{ animation: "slideInUp 0.4s ease both" }}>
      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
            Total logements
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{totalLogements}</div>
        </div>

        <div style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
            Logements termines
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--success)" }}>{completedLogements}</div>
        </div>

        <div style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
            Cible semaine courante
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{cibleCourante}</div>
        </div>

        <div style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
            Ecart (reel - cible)
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: ecartColor }}>
            {ecartSign}{ecart}
          </div>
        </div>
      </div>

      {/* ── Chart: Cible vs Réel ── */}
      {weeks.length > 0 && totalLogements > 0 && (() => {
        const W = 800, H = 300, padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;
        const maxY = totalLogements;
        const lastCibleWeekIdx = cibleCumul.reduce((acc, v, i) => v > 0 ? i : acc, -1);
        const endIdx = Math.max(currentWeekIndex, lastCibleWeekIdx, 0);
        const displayWeeks = weeks.slice(0, endIdx + 2);
        const displayCumul = cibleCumul.slice(0, endIdx + 2);
        if (displayWeeks.length < 2) return null;
        const xScale = (i: number) => padL + (i / (displayWeeks.length - 1)) * chartW;
        const yScale = (v: number) => padT + chartH - (v / maxY) * chartH;
        // Build cible path (cumulative)
        const ciblePts = displayCumul.map((v, i) => `${xScale(i)},${yScale(v)}`);
        const cibleLine = "M" + ciblePts.join(" L");
        const cibleArea = cibleLine + ` L${xScale(displayWeeks.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`;
        // Build réel path (flat line at completedLogements up to currentWeekIndex)
        const reelEnd = Math.min(currentWeekIndex, displayWeeks.length - 1);
        const reelPts = displayWeeks.slice(0, reelEnd + 1).map((_, i) => `${xScale(i)},${yScale(completedLogements)}`);
        const reelLine = reelPts.length > 1 ? "M" + reelPts.join(" L") : null;
        const reelArea = reelLine ? reelLine + ` L${xScale(reelEnd)},${yScale(0)} L${xScale(0)},${yScale(0)} Z` : null;
        // Y-axis ticks
        const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(p * maxY));
        return (
          <div style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            padding: "20px 16px 12px",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-card)",
            marginBottom: 24,
            overflowX: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 12 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Courbe Cible vs Réel</h4>
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-secondary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 3, background: "var(--accent)", borderRadius: 2, display: "inline-block" }} />
                  Cible
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 16, height: 3, background: "var(--success)", borderRadius: 2, display: "inline-block" }} />
                  Réel
                </span>
              </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }}>
              {/* Grid lines */}
              {yTicks.map((v) => (
                <g key={v}>
                  <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="var(--border-subtle)" strokeWidth={1} />
                  <text x={padL - 8} y={yScale(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-tertiary)">{v}</text>
                </g>
              ))}
              {/* X-axis labels */}
              {displayWeeks.map((w, i) => {
                const showLabel = displayWeeks.length <= 20 || i % Math.ceil(displayWeeks.length / 15) === 0;
                return showLabel ? (
                  <text key={i} x={xScale(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">
                    S{w.semaine}
                  </text>
                ) : null;
              })}
              {/* Current week vertical line */}
              {currentWeekIndex >= 0 && currentWeekIndex < displayWeeks.length && (
                <line
                  x1={xScale(currentWeekIndex)} x2={xScale(currentWeekIndex)}
                  y1={padT} y2={padT + chartH}
                  stroke="var(--accent)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5}
                />
              )}
              {/* Cible area + line */}
              <path d={cibleArea} fill="var(--accent)" opacity={0.08} />
              <path d={cibleLine} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
              {/* Réel area + line */}
              {reelArea && <path d={reelArea} fill="var(--success)" opacity={0.10} />}
              {reelLine && <path d={reelLine} fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinejoin="round" />}
              {/* Dots on cible */}
              {displayCumul.map((v, i) => v > 0 ? (
                <circle key={`c${i}`} cx={xScale(i)} cy={yScale(v)} r={3.5} fill="var(--accent)" />
              ) : null)}
              {/* Réel endpoint dot */}
              {reelEnd >= 0 && (
                <circle cx={xScale(reelEnd)} cy={yScale(completedLogements)} r={4.5} fill="var(--success)" stroke="var(--bg-card)" strokeWidth={2} />
              )}
            </svg>
          </div>
        );
      })()}

      {/* Table header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>
          Planning cibles logements par semaine
        </h3>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          Debut : {formatDate(startDate)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          onClick={addMoreWeeks}
          style={{ marginLeft: "auto" }}
        >
          Ajouter des semaines
        </Button>
      </div>

      {/* Table */}
      <div style={{
        overflowX: "auto",
        overflowY: "auto",
        maxHeight: "calc(100vh - 360px)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-default)",
      }}>
        <table className="tracking-table" role="grid" aria-label="Planning logements par semaine">
          <thead>
            <tr>
              <th style={{ minWidth: 80, textAlign: "center", fontSize: 12 }}>Semaine</th>
              <th style={{ minWidth: 120, textAlign: "center", fontSize: 12 }}>Date debut</th>
              <th style={{ minWidth: 100, textAlign: "center", fontSize: 12 }}>
                Cible / sem.
              </th>
              <th style={{ minWidth: 100, textAlign: "center", fontSize: 12 }}>
                Cible cumul
              </th>
              <th style={{ minWidth: 100, textAlign: "center", fontSize: 12 }}>
                Réel cumul
              </th>
              <th style={{ minWidth: 200, fontSize: 12 }}>Comparaison</th>
              <th style={{ minWidth: 80, textAlign: "center", fontSize: 12 }}>Ecart</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, idx) => {
              const isCurrent = idx === currentWeekIndex;
              const isPast = idx < currentWeekIndex;
              const cumul = cibleCumul[idx] || 0;
              const ecartWeek = completedLogements - cumul;
              const showComparison = cumul > 0 || isPast || isCurrent;

              // Progress bar calculations
              const ciblePct = totalLogements > 0 ? (cumul / totalLogements) * 100 : 0;
              const reelPct = totalLogements > 0 ? (completedLogements / totalLogements) * 100 : 0;

              return (
                <tr
                  key={week.semaine}
                  style={{
                    background: isCurrent
                      ? "var(--accent-bg)"
                      : isPast && cumul > 0 && completedLogements < cumul
                        ? "var(--danger-bg)"
                        : undefined,
                  }}
                >
                  <td style={{
                    textAlign: "center",
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: 13,
                    color: isCurrent ? "var(--accent)" : "var(--text-primary)",
                  }}>
                    S{week.semaine}
                    {isCurrent && (
                      <span style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        marginLeft: 6,
                        verticalAlign: "middle",
                      }} />
                    )}
                  </td>

                  <td style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                    {formatDate(week.dateDebut)}
                  </td>

                  {/* Cible column - editable */}
                  <td style={{ textAlign: "center", padding: "4px 8px" }}>
                    {editingCell === week.semaine ? (
                      <input
                        type="number"
                        min={0}
                        max={totalLogements}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleFinishEdit(week.semaine, week.dateDebut)}
                        onKeyDown={(e) => handleKeyDown(e, week.semaine, week.dateDebut)}
                        autoFocus
                        style={{
                          width: 70,
                          textAlign: "center",
                          padding: "4px 8px",
                          fontSize: 13,
                          fontWeight: 600,
                          border: "2px solid var(--accent)",
                          borderRadius: "var(--radius-xs)",
                          background: "var(--bg-base)",
                          color: "var(--text-primary)",
                          outline: "none",
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => handleStartEdit(week.semaine, week.cible)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 50,
                          padding: "4px 12px",
                          fontSize: 13,
                          fontWeight: 600,
                          color: week.cible > 0 ? "var(--accent)" : "var(--text-tertiary)",
                          background: week.cible > 0 ? "var(--accent-bg)" : "var(--bg-input)",
                          border: "1px solid transparent",
                          borderRadius: "var(--radius-xs)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.borderColor = "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.borderColor = "transparent";
                        }}
                        title="Cliquer pour modifier"
                      >
                        {week.cible > 0 ? week.cible : "—"}
                      </button>
                    )}
                  </td>

                  {/* Cible cumul */}
                  <td style={{
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    color: cumul > 0 ? "var(--accent)" : "var(--text-tertiary)",
                  }}>
                    {cumul > 0 ? cumul : "—"}
                  </td>

                  {/* Reels column - auto-calculated */}
                  <td style={{
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    color: (isPast || isCurrent) ? "var(--text-primary)" : "var(--text-tertiary)",
                  }}>
                    {(isPast || isCurrent) ? completedLogements : "—"}
                  </td>

                  {/* Visual comparison */}
                  <td style={{ padding: "6px 12px" }}>
                    {showComparison && (isPast || isCurrent) ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {/* Cible bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", width: 36, textAlign: "right" }}>Cible</span>
                          <div style={{
                            flex: 1,
                            height: 8,
                            background: "var(--bg-elevated)",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${Math.min(ciblePct, 100)}%`,
                              height: "100%",
                              background: "var(--accent)",
                              borderRadius: 4,
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 32, fontFamily: "var(--font-mono)" }}>
                            {ciblePct.toFixed(0)}%
                          </span>
                        </div>
                        {/* Reel bar */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", width: 36, textAlign: "right" }}>Reel</span>
                          <div style={{
                            flex: 1,
                            height: 8,
                            background: "var(--bg-elevated)",
                            borderRadius: 4,
                            overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${Math.min(reelPct, 100)}%`,
                              height: "100%",
                              background: completedLogements >= cumul ? "var(--success)" : "var(--warning)",
                              borderRadius: 4,
                              transition: "width 0.3s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 32, fontFamily: "var(--font-mono)" }}>
                            {reelPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>

                  {/* Ecart */}
                  <td style={{
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    {showComparison && (isPast || isCurrent) && cumul > 0 ? (
                      <span style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: "var(--radius-xs)",
                        fontSize: 12,
                        fontWeight: 700,
                        background: ecartWeek >= 0 ? "var(--success-bg)" : "var(--danger-bg)",
                        color: ecartWeek >= 0 ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${ecartWeek >= 0 ? "var(--success-border)" : "var(--danger-border)"}`,
                      }}>
                        {ecartWeek >= 0 ? "+" : ""}{ecartWeek}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600, fontSize: 12, background: "var(--bg-raised)" }}>
              <td style={{ textAlign: "center" }}>Total</td>
              <td></td>
              <td style={{ textAlign: "center", fontWeight: 700 }}>
                {weeks.reduce((s, w) => s + w.cible, 0)}
              </td>
              <td style={{ textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>
                {cibleCumul.length > 0 ? cibleCumul[cibleCumul.length - 1] : 0}
              </td>
              <td style={{ textAlign: "center", fontWeight: 700, color: "var(--success)" }}>
                {completedLogements}
              </td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Info note */}
      <div style={{
        marginTop: 16,
        padding: "12px 16px",
        background: "var(--info-bg)",
        border: "1px solid var(--info-border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 12,
        color: "var(--text-secondary)",
        lineHeight: 1.6,
      }}>
        <strong style={{ color: "var(--info)" }}>Note :</strong>{" "}
        La colonne "Nb logements cible" represente le nombre cumule de logements
        qui devraient etre termines a la fin de chaque semaine. Cliquez sur une
        cellule pour modifier la cible. Un logement est considere comme termine
        lorsque toutes ses decompositions dans tous les lots interieurs ont le
        statut "X".
      </div>
    </div>
  );
}
