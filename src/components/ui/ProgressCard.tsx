import { memo, useState } from "react";
import ProgressBar from "./ProgressBar";

export default memo(function ProgressCard({ title, items }) {
  const [compact, setCompact] = useState(true);
  const total = items.length > 0 ? items.reduce((s, i) => s + i.progress, 0) / items.length : 0;
  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <h4>{title}</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn-icon"
            onClick={() => setCompact((v) => !v)}
            data-tooltip={compact ? "Afficher noms complets" : "Afficher noms courts"}
            style={{ fontSize: 13, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", cursor: "pointer" }}
          >
            {compact ? "Aa" : "ABC"}
          </button>
          <span className="progress-card-total">{total.toFixed(1)}%</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.lot} className="progress-item">
            <span className="progress-item-label" data-tooltip={compact ? item.lot : undefined}>
              {compact ? (item.shortLot || item.lot) : item.lot}
            </span>
            <ProgressBar value={item.progress} height={5} />
          </div>
        ))}
      </div>
    </div>
  );
});
