import { memo } from "react";
import { STATUS_CONFIG } from "../../lib/constants";

export default memo(function StatusCell({ value, onChange, readOnly = false }) {
  const statuses = ["", "X", "N/A", "!", "NOK", "i"];
  const idx = statuses.indexOf(value || "");
  const next = () => {
    if (readOnly) return;
    onChange(statuses[(idx + 1) % statuses.length]);
  };
  const cfg = STATUS_CONFIG[value || ""];
  return (
    <button
      className={`status-cell ${cfg.cls}`}
      onClick={next}
      onKeyDown={(e) => { if (!readOnly && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); } }}
      title={readOnly ? `Statut : ${cfg.label || "vide"}` : "Cliquer pour changer le statut"}
      aria-label={`Statut : ${cfg.label || "vide"}`}
      style={readOnly ? { cursor: "default", pointerEvents: "auto" } : undefined}
      tabIndex={readOnly ? -1 : 0}
    >
      {cfg.label}
    </button>
  );
})
