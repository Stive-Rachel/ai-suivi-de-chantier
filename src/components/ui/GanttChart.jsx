import { useState, useMemo, useCallback, useRef } from "react";

/**
 * Gantt chart SVG — affiche des barres horizontales sur un axe temps.
 * Props:
 *   tasks[] : { id, label, start (Date), end (Date), progress (0-100), color }
 *   todayLine : boolean (afficher la ligne aujourd'hui)
 *   zoom : "week" | "month"
 *   onZoomChange : (zoom) => void
 */
const ROW_HEIGHT = 36;
const LABEL_WIDTH = 200;
const HEADER_HEIGHT = 48;
const DAY_MS = 86400000;

function addWeeks(date, weeks) {
  return new Date(date.getTime() + weeks * 7 * DAY_MS);
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatWeek(date) {
  const d = new Date(date);
  return `S${getWeekNumber(d)}`;
}

function formatMonth(date) {
  const months = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(date);
  return `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / DAY_MS + 1) / 7);
}

function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export default function GanttChart({
  tasks = [],
  todayLine = true,
  zoom = "week",
  onZoomChange,
}) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  // Compute time range from tasks
  const { timeStart, timeEnd, periods } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      return {
        timeStart: startOfWeek(now),
        timeEnd: addWeeks(startOfWeek(now), 4),
        periods: [],
      };
    }

    let minDate = tasks[0].start;
    let maxDate = tasks[0].end;
    for (const t of tasks) {
      if (t.start < minDate) minDate = t.start;
      if (t.end > maxDate) maxDate = t.end;
    }

    // Add padding
    const padStart = zoom === "week"
      ? startOfWeek(new Date(minDate.getTime() - 7 * DAY_MS))
      : startOfMonth(new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1));
    const padEnd = zoom === "week"
      ? addWeeks(startOfWeek(maxDate), 2)
      : new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 1);

    // Generate period markers
    const p = [];
    if (zoom === "week") {
      let current = new Date(padStart);
      while (current < padEnd) {
        p.push({ date: new Date(current), label: formatWeek(current) });
        current = addWeeks(current, 1);
      }
    } else {
      let current = new Date(padStart);
      while (current < padEnd) {
        p.push({ date: new Date(current), label: formatMonth(current) });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
    }

    return { timeStart: padStart, timeEnd: padEnd, periods: p };
  }, [tasks, zoom]);

  const totalDays = diffDays(timeStart, timeEnd);
  const colWidth = zoom === "week" ? 42 : 70;
  const chartWidth = periods.length * colWidth;
  const chartHeight = tasks.length * ROW_HEIGHT;
  const totalWidth = LABEL_WIDTH + chartWidth;
  const totalHeight = HEADER_HEIGHT + chartHeight;

  const dateToX = useCallback(
    (date) => {
      if (totalDays === 0) return 0;
      const days = diffDays(timeStart, date);
      return LABEL_WIDTH + (days / totalDays) * chartWidth;
    },
    [timeStart, totalDays, chartWidth]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = dateToX(today);
  const showToday = todayLine && todayX >= LABEL_WIDTH && todayX <= totalWidth;

  const handleMouseEnter = (task, e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      task,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => setTooltip(null);

  if (tasks.length === 0) {
    return (
      <div className="empty-placeholder">
        Aucune tache a afficher dans le planning
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="gantt-container"
      style={{ position: "relative" }}
    >
      {/* Zoom controls */}
      {onZoomChange && (
        <div className="gantt-zoom-controls">
          <button
            className={`gantt-zoom-btn ${zoom === "week" ? "active" : ""}`}
            onClick={() => onZoomChange("week")}
          >
            Semaines
          </button>
          <button
            className={`gantt-zoom-btn ${zoom === "month" ? "active" : ""}`}
            onClick={() => onZoomChange("month")}
          >
            Mois
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 600 }}>
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          style={{ display: "block" }}
        >
          {/* Background */}
          <rect width={totalWidth} height={totalHeight} fill="var(--bg-card)" rx="8" />

          {/* Header background */}
          <rect x={0} y={0} width={totalWidth} height={HEADER_HEIGHT} fill="var(--bg-raised)" />
          <line
            x1={0}
            y1={HEADER_HEIGHT}
            x2={totalWidth}
            y2={HEADER_HEIGHT}
            stroke="var(--border-strong)"
            strokeWidth="1"
          />

          {/* Label column header */}
          <text
            x={14}
            y={HEADER_HEIGHT / 2 + 4}
            fill="var(--text-secondary)"
            fontSize="11"
            fontWeight="600"
            fontFamily="var(--font-sans)"
            textAnchor="start"
          >
            Lot / Tache
          </text>

          {/* Separator line */}
          <line
            x1={LABEL_WIDTH}
            y1={0}
            x2={LABEL_WIDTH}
            y2={totalHeight}
            stroke="var(--border-default)"
            strokeWidth="1"
          />

          {/* Period headers and grid lines */}
          {periods.map((p, i) => {
            const x = LABEL_WIDTH + i * colWidth;
            return (
              <g key={i}>
                <text
                  x={x + colWidth / 2}
                  y={20}
                  fill="var(--text-secondary)"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
                {zoom === "week" && (
                  <text
                    x={x + colWidth / 2}
                    y={34}
                    fill="var(--text-tertiary)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {p.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                  </text>
                )}
                {/* Vertical grid */}
                <line
                  x1={x}
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={totalHeight}
                  stroke="var(--border-subtle)"
                  strokeWidth="0.5"
                />
              </g>
            );
          })}

          {/* Row backgrounds and labels */}
          {tasks.map((task, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            const isEven = i % 2 === 0;
            return (
              <g key={task.id || i}>
                {/* Alternating row bg */}
                {!isEven && (
                  <rect
                    x={0}
                    y={y}
                    width={totalWidth}
                    height={ROW_HEIGHT}
                    fill="var(--bg-elevated)"
                    opacity="0.4"
                  />
                )}
                {/* Row divider */}
                <line
                  x1={0}
                  y1={y + ROW_HEIGHT}
                  x2={totalWidth}
                  y2={y + ROW_HEIGHT}
                  stroke="var(--border-subtle)"
                  strokeWidth="0.5"
                />
                {/* Label */}
                <text
                  x={14}
                  y={y + ROW_HEIGHT / 2 + 4}
                  fill="var(--text-primary)"
                  fontSize="11"
                  fontWeight="500"
                  fontFamily="var(--font-sans)"
                >
                  {task.label.length > 28 ? task.label.slice(0, 26) + "..." : task.label}
                </text>
              </g>
            );
          })}

          {/* Task bars */}
          {tasks.map((task, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT;
            const barY = y + 8;
            const barH = ROW_HEIGHT - 16;
            const x1 = dateToX(task.start);
            const x2 = dateToX(task.end);
            const barW = Math.max(x2 - x1, 4);
            const progress = Math.min(Math.max(task.progress || 0, 0), 100);
            const progressW = (progress / 100) * barW;
            const color = task.color || "var(--accent)";

            return (
              <g
                key={`bar-${task.id || i}`}
                onMouseEnter={(e) => handleMouseEnter(task, e)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: "pointer" }}
              >
                {/* Track (background bar) */}
                <rect
                  x={x1}
                  y={barY}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={color}
                  opacity="0.15"
                />
                {/* Progress fill */}
                {progressW > 0 && (
                  <rect
                    x={x1}
                    y={barY}
                    width={progressW}
                    height={barH}
                    rx={4}
                    fill={color}
                    opacity="0.85"
                    style={{ transition: "width 0.4s ease" }}
                  />
                )}
                {/* Progress text */}
                {barW > 40 && (
                  <text
                    x={x1 + barW / 2}
                    y={barY + barH / 2 + 3.5}
                    fill={progress > 30 ? "#fff" : "var(--text-primary)"}
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {progress.toFixed(2)}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Today line */}
          {showToday && (
            <g>
              <line
                x1={todayX}
                y1={HEADER_HEIGHT}
                x2={todayX}
                y2={totalHeight}
                stroke="var(--danger)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <rect
                x={todayX - 22}
                y={HEADER_HEIGHT - 14}
                width={44}
                height={14}
                rx={3}
                fill="var(--danger)"
              />
              <text
                x={todayX}
                y={HEADER_HEIGHT - 4}
                fill="#fff"
                fontSize="8"
                fontWeight="700"
                fontFamily="var(--font-mono)"
                textAnchor="middle"
              >
                Auj.
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="gantt-tooltip"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.offsetWidth || 400) - 220),
            top: tooltip.y - 10,
          }}
        >
          <div className="gantt-tooltip-title">{tooltip.task.label}</div>
          <div className="gantt-tooltip-row">
            <span>Debut :</span>
            <span>{tooltip.task.start.toLocaleDateString("fr-FR")}</span>
          </div>
          <div className="gantt-tooltip-row">
            <span>Fin :</span>
            <span>{tooltip.task.end.toLocaleDateString("fr-FR")}</span>
          </div>
          <div className="gantt-tooltip-row">
            <span>Avancement :</span>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>
              {(tooltip.task.progress || 0).toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
