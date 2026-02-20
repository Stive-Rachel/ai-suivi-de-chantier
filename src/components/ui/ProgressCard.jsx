import { memo } from "react";
import ProgressBar from "./ProgressBar";

export default memo(function ProgressCard({ title, items }) {
  const total = items.length > 0 ? items.reduce((s, i) => s + i.progress, 0) / items.length : 0;
  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <h4>{title}</h4>
        <span className="progress-card-total">{total.toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.lot} className="progress-item">
            <span className="progress-item-label">{item.lot}</span>
            <ProgressBar value={item.progress} height={5} />
          </div>
        ))}
      </div>
    </div>
  );
})
