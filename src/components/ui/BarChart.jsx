/**
 * Horizontal bar chart — affiche des barres horizontales avec labels et valeurs.
 * Props: data = [{ label, value, color }], maxValue (default 100)
 */
export function HorizontalBarChart({ data = [], maxValue = 100, height = 20, showValue = true }) {
  if (data.length === 0) return null;

  return (
    <div className="hbar-chart">
      {data.map((item, i) => (
        <div key={i} className="hbar-row">
          <span className="hbar-label" title={item.label}>{item.label}</span>
          <div className="hbar-track" style={{ height }}>
            <div
              className="hbar-fill"
              style={{
                width: `${Math.min((item.value / maxValue) * 100, 100)}%`,
                backgroundColor: item.color || "var(--accent)",
                height: "100%",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          {showValue && (
            <span className="hbar-value">{item.value.toFixed(1)}%</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Vertical grouped bar chart — barres verticales groupées (ex: INT/EXT par bâtiment).
 * Props: data = [{ label, values: [{ value, color, label }] }], maxValue
 */
export function VerticalBarChart({ data = [], maxValue = 100, barHeight = 140 }) {
  if (data.length === 0) return null;

  return (
    <div className="vbar-chart">
      <div className="vbar-grid">
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
                    title={`${bar.label}: ${bar.value.toFixed(1)}%`}
                  >
                    <div
                      className="vbar-bar"
                      style={{
                        height: `${Math.min((bar.value / maxValue) * 100, 100)}%`,
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
