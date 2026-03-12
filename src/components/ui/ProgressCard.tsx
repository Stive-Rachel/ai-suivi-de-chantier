import { memo, useState } from "react";

function MiniRing({ value, size = 52, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  const c = size / 2;
  const color = value >= 75 ? "var(--success)" : value >= 35 ? "var(--warning)" : "var(--danger)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pc-ring">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-default)" strokeWidth={stroke} />
      <circle
        cx={c} cy={c} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

function StatusDot({ value }) {
  const color = value >= 75 ? "var(--success)" : value >= 35 ? "var(--warning)" : value > 0 ? "var(--danger)" : "var(--border-default)";
  return <span className="pc-dot" style={{ background: color }} />;
}

export default memo(function ProgressCard({ title, items }) {
  const [compact, setCompact] = useState(false);
  const total = items.length > 0 ? items.reduce((s, i) => s + i.progress, 0) / items.length : 0;

  return (
    <div className="pc-card">
      {/* Header */}
      <div className="pc-header">
        <div className="pc-header-left">
          <MiniRing value={total} />
          <div className="pc-header-info">
            <span className="pc-header-pct">{total.toFixed(2)}%</span>
            <span className="pc-header-title">{title}</span>
          </div>
        </div>
        <button
          className="pc-toggle"
          onClick={() => setCompact((v) => !v)}
          data-tooltip={compact ? "Noms complets" : "Noms courts"}
        >
          {compact ? "Aa" : "A"}
        </button>
      </div>

      {/* Items */}
      <div className="pc-items">
        {items.map((item, idx) => {
          const pct = Math.min(item.progress, 100);
          const color = pct >= 75 ? "var(--success)" : pct >= 35 ? "var(--warning)" : pct > 0 ? "var(--danger)" : "var(--border-strong)";
          const label = compact ? (item.shortLot || item.lot) : item.lot;

          // Extract lot number prefix (e.g., "1&2" from "1&2 - GROS OEUVRE...")
          const dashIdx = label.indexOf(" - ");
          const lotNum = dashIdx > -1 ? label.slice(0, dashIdx).trim() : "";
          const lotName = dashIdx > -1 ? label.slice(dashIdx + 3).trim() : label;

          return (
            <div
              key={item.lot}
              className={`pc-row ${idx % 2 === 0 ? "pc-row-alt" : ""}`}
              data-tooltip={compact ? item.lot : undefined}
            >
              <div className="pc-row-accent" style={{ background: color }} />
              <div className="pc-row-body">
                <div className="pc-row-top">
                  <div className="pc-row-label">
                    {lotNum && <span className="pc-lot-num">{lotNum}</span>}
                    <span className="pc-lot-name">{lotName}</span>
                  </div>
                  <span className="pc-row-pct" style={{ color }}>{pct.toFixed(2)}%</span>
                </div>
                <div className="pc-bar-track">
                  <div className="pc-bar-ticks">
                    <span style={{ left: "25%" }} />
                    <span style={{ left: "50%" }} />
                    <span style={{ left: "75%" }} />
                  </div>
                  <div
                    className="pc-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                  >
                    {pct >= 15 && (
                      <span className="pc-bar-label">{pct.toFixed(0)}%</span>
                    )}
                  </div>
                  {pct > 0 && pct < 15 && (
                    <span className="pc-bar-label-outside" style={{ color, left: `calc(${pct}% + 4px)` }}>{pct.toFixed(0)}%</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pc-footer">
        <span>{items.length} lot{items.length > 1 ? "s" : ""}</span>
      </div>
    </div>
  );
});
