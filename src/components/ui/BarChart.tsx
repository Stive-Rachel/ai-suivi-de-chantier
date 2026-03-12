/**
 * Horizontal bar chart — premium data visualization.
 * Props: data = [{ label, value, color }], maxValue (default 100)
 */
export function HorizontalBarChart({ data = [], maxValue = 100, height = 20, showValue = true }) {
  if (data.length === 0) return null;

  return (
    <div className="hbar-chart">
      {data.map((item, i) => {
        const pct = Math.min((item.value / maxValue) * 100, 100);
        const color = item.color || "var(--accent)";
        // Extract lot number
        const dashIdx = item.label.indexOf(" - ");
        const lotNum = dashIdx > -1 ? item.label.slice(0, dashIdx).trim() : "";
        const lotName = dashIdx > -1 ? item.label.slice(dashIdx + 3).trim() : item.label;

        return (
          <div key={i} className={`hbar-row ${i % 2 === 0 ? "hbar-row-alt" : ""}`}>
            <div className="hbar-row-accent" style={{ background: color }} />
            <div className="hbar-label">
              {lotNum && <span className="hbar-lot-num">{lotNum}</span>}
              <span className="hbar-lot-name">{lotName}</span>
            </div>
            <div className="hbar-track" style={{ height }}>
              <div className="hbar-ticks">
                <span style={{ left: "25%" }} />
                <span style={{ left: "50%" }} />
                <span style={{ left: "75%" }} />
              </div>
              <div
                className="hbar-fill"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  height: "100%",
                  transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>
            {showValue && (
              <span className="hbar-value" style={{ color }}>{item.value.toFixed(2)}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Vertical grouped bar chart — barres verticales groupées (ex: INT/EXT par bâtiment).
 * Props: data = [{ label, values: [{ value, color, label }] }], maxValue
 */
export function VerticalBarChart({ data = [], maxValue = 100, barHeight = 200 }) {
  if (data.length === 0) return null;

  const barWidth = data.length > 15 ? 14 : data.length > 8 ? 18 : 24;

  return (
    <div className="vbar-chart" style={{ overflowX: data.length > 12 ? "auto" : "visible" }}>
      <div className="vbar-grid" style={{ minWidth: data.length > 12 ? data.length * 55 : "auto" }}>
        {/* Y-axis labels */}
        <div className="vbar-yaxis">
          {[100, 75, 50, 25, 0].map((v) => (
            <span key={v} className="vbar-ylabel">{v}%</span>
          ))}
        </div>

        <div className="vbar-body" style={{ height: barHeight }}>
          {/* Grid lines */}
          <div className="vbar-gridlines">
            {[0, 25, 50, 75, 100].map((v) => (
              <div
                key={v}
                className="vbar-gridline"
                style={{ bottom: `${v}%` }}
              />
            ))}
          </div>

          {/* Bars */}
          <div className="vbar-groups">
            {data.map((group, gi) => (
              <div key={gi} className="vbar-group">
                {group.values.map((bar, bi) => (
                  <div
                    key={bi}
                    className="vbar-bar-wrapper"
                    style={{ width: barWidth }}
                    title={`${bar.label}: ${bar.value.toFixed(2)}%`}
                  >
                    {bar.value > 0 && (
                      <span className="vbar-bar-pct">{Math.round(bar.value)}%</span>
                    )}
                    <div
                      className="vbar-bar"
                      style={{
                        height: `${Math.max(Math.min((bar.value / maxValue) * 100, 100), 1.5)}%`,
                        backgroundColor: bar.color || "var(--accent)",
                        transition: "height 0.5s ease",
                      }}
                    />
                  </div>
                ))}
                <span className="vbar-xlabel">{group.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      {data.length > 0 && data[0].values.length > 1 && (
        <div className="vbar-legend">
          {data[0].values.map((bar, i) => (
            <span key={i} className="vbar-legend-item">
              <span
                className="vbar-legend-dot"
                style={{ backgroundColor: bar.color }}
              />
              {bar.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
