import { memo } from "react";

export default memo(function ProgressBar({ value, max = 100, height = 6 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colorClass = pct >= 75 ? "color-success" : pct >= 35 ? "color-warning" : "color-danger";
  return (
    <div className="progress-wrap">
      <div className="progress-track" style={{ height }}>
        <div
          className={`progress-fill ${colorClass}`}
          style={{ width: `${pct}%`, height }}
        />
      </div>
      <span className="progress-label">{pct.toFixed(1)}%</span>
    </div>
  );
})
