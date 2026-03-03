import { useState, useMemo } from "react";
import { computeDetailedProgress } from "../../lib/computations";
import GanttChart from "../ui/GanttChart";

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

// Palette de couleurs pour les lots
const LOT_COLORS = [
  "var(--accent)",      // terracotta
  "var(--success)",     // vert
  "var(--info)",        // bleu
  "var(--warning)",     // jaune
  "#8B5CF6",            // violet
  "#EC4899",            // rose
  "#14B8A6",            // teal
  "#F97316",            // orange
  "#6366F1",            // indigo
  "#84CC16",            // lime
  "#D946EF",            // fuchsia
  "#0EA5E9",            // sky
];

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function addWeeks(date, weeks) {
  return new Date(date.getTime() + weeks * WEEK_MS);
}

export default function GanttTab({ project }) {
  const [zoom, setZoom] = useState("week");
  const [viewMode, setViewMode] = useState("all"); // "all" | "int" | "ext"

  const { lotProgressInt, lotProgressExt } = useMemo(
    () => computeDetailedProgress(project),
    [project]
  );

  // Build Gantt tasks from lot progress data
  const tasks = useMemo(() => {
    const result = [];
    const dateDebutChantier = parseDate(project.dateDebutChantier);
    if (!dateDebutChantier) return result;

    const dureeTotale = project.dureeTotale || 17; // default weeks
    const dureeExt = project.dureeExt || dureeTotale;
    const dureeInt = project.dureeInt || dureeTotale;
    const dateDebutExt = parseDate(project.dateDebutExt) || dateDebutChantier;
    const dateDebutInt = parseDate(project.dateDebutInt) || dateDebutChantier;

    // Distribute duration across lots evenly, but stagger them slightly
    const buildTasks = (progressData, lotsSource, startDate, duration, prefix, typeColor) => {
      const lotsCount = progressData.length;
      if (lotsCount === 0) return;

      // Check if lots have custom dates
      const lotsWithDates = (lotsSource || []).filter(l => l.dateDebut || l.dateFin);
      const hasCustomDates = lotsWithDates.length > 0;

      // Map lot progress to their source lot data for date lookup
      const lotSourceMap = new Map();
      for (const lotSrc of (lotsSource || [])) {
        const key = `${lotSrc.numero} - ${lotSrc.nom}`;
        if (!lotSourceMap.has(key)) {
          lotSourceMap.set(key, lotSrc);
        }
      }

      progressData.forEach((lp, i) => {
        // Check for custom dates from lot source
        const sourceLot = lotSourceMap.get(lp.lot);
        const customStart = sourceLot ? parseDate(sourceLot.dateDebut) : null;
        const customEnd = sourceLot ? parseDate(sourceLot.dateFin) : null;

        let taskStart, taskEnd;

        if (customStart && customEnd) {
          taskStart = customStart;
          taskEnd = customEnd;
        } else if (hasCustomDates && customStart) {
          // Has start but no end — use average per-lot duration
          const avgWeeks = Math.max(Math.round(duration / lotsCount), 2);
          taskStart = customStart;
          taskEnd = addWeeks(customStart, avgWeeks);
        } else {
          // Distribute lots over the total duration with overlap
          const weeksPerLot = Math.max(Math.round(duration * 0.6), 2);
          const stagger = lotsCount > 1 ? (duration - weeksPerLot) / (lotsCount - 1) : 0;
          const offsetWeeks = Math.round(i * stagger);

          taskStart = addWeeks(startDate, offsetWeeks);
          taskEnd = addWeeks(taskStart, weeksPerLot);
        }

        const color = LOT_COLORS[i % LOT_COLORS.length];

        result.push({
          id: `${prefix}_${i}`,
          label: `${prefix === "EXT" ? "[EXT]" : "[INT]"} ${lp.shortLot || lp.lot}`,
          start: taskStart,
          end: taskEnd,
          progress: lp.progress,
          color,
        });
      });
    };

    if (viewMode === "all" || viewMode === "ext") {
      buildTasks(lotProgressExt, project.lotsExt, dateDebutExt, dureeExt, "EXT", "var(--accent)");
    }
    if (viewMode === "all" || viewMode === "int") {
      buildTasks(lotProgressInt, project.lotsInt, dateDebutInt, dureeInt, "INT", "var(--info)");
    }

    return result;
  }, [project, lotProgressInt, lotProgressExt, viewMode]);

  const hasDate = !!parseDate(project.dateDebutChantier);

  return (
    <div className="gantt-tab" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Planning Gantt</h3>
            <p>
              {tasks.length} tache(s)
              {hasDate
                ? ` \u00b7 Debut : ${new Date(project.dateDebutChantier).toLocaleDateString("fr-FR")}`
                : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* View mode filter */}
            <div className="gantt-view-filter">
              <button
                className={`gantt-filter-btn ${viewMode === "all" ? "active" : ""}`}
                onClick={() => setViewMode("all")}
              >
                Tous
              </button>
              <button
                className={`gantt-filter-btn ${viewMode === "ext" ? "active" : ""}`}
                onClick={() => setViewMode("ext")}
              >
                Ext.
              </button>
              <button
                className={`gantt-filter-btn ${viewMode === "int" ? "active" : ""}`}
                onClick={() => setViewMode("int")}
              >
                Int.
              </button>
            </div>
          </div>
        </div>

        {!hasDate ? (
          <div className="empty-placeholder">
            Configurez la date de debut du chantier dans l'onglet Configuration pour afficher le planning.
          </div>
        ) : tasks.length === 0 ? (
          <div className="empty-placeholder">
            Aucun lot configure. Ajoutez des lots dans l'onglet Lots.
          </div>
        ) : (
          <GanttChart
            tasks={tasks}
            todayLine={true}
            zoom={zoom}
            onZoomChange={setZoom}
          />
        )}
      </div>

      {/* Legend */}
      {tasks.length > 0 && (
        <div className="config-section" style={{ marginTop: 14 }}>
          <div className="section-header">
            <h3 style={{ fontSize: 13 }}>Legende</h3>
          </div>
          <div className="gantt-legend">
            {tasks.map((t) => (
              <div key={t.id} className="gantt-legend-item">
                <span
                  className="gantt-legend-dot"
                  style={{ backgroundColor: t.color }}
                />
                <span className="gantt-legend-label">{t.label}</span>
                <span className="gantt-legend-value">{t.progress.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
