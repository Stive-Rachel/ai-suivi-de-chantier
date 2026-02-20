import { memo } from "react";
import { STATUS_CONFIG } from "../../lib/constants";

export default memo(function StatusCell({ value, onChange }) {
  const statuses = ["", "X", "!", "NOK", "i"];
  const idx = statuses.indexOf(value || "");
  const next = () => onChange(statuses[(idx + 1) % statuses.length]);
  const cfg = STATUS_CONFIG[value || ""];
  return (
    <button
      className={`status-cell ${cfg.cls}`}
      onClick={next}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); } }}
      title="Cliquer pour changer le statut"
      aria-label={`Statut : ${cfg.label || "vide"}`}
    >
      {cfg.label}
    </button>
  );
})
