import { memo } from "react";

export default memo(function ProgressBar({ value, max = 100, height = 6, showLabel = true, showTicks = false }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colorClass = pct >= 75 ? "color-success" : pct >= 35 ? "color-warning" : "color-danger";
  return (
    <div className="progress-wrap">
      <div className="progress-track" style={{ height }}>
        {showTicks && (
          <div className="progress-ticks">
            <span className="progress-tick" style={{ left: "25%" }} />
            <span className="progress-tick" style={{ left: "50%" }} />
            <span className="progress-tick" style={{ left: "75%" }} />
          </div>
        )}
        <div
          className={`progress-fill ${colorClass}`}
          style={{ width: `${pct}%`, height }}
        />
      </div>
      {showLabel && (
        <span className="progress-label">{pct.toFixed(2)}%</span>
      )}
    </div>
  );
});
