import { useState } from "react";
import { formatMontant } from "../../lib/format";

export default function MoneyInput({ value, onChange, variant = "inline" }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const isField = variant === "field";

  if (editing) {
    return (
      <input
        className={isField ? "input-field" : "inline-edit inline-edit-num"}
        type="number"
        step="0.01"
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onChange(parseFloat(raw) || 0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
        }}
      />
    );
  }

  return (
    <span
      className={isField ? "money-display-field" : "money-display"}
      onClick={() => { setRaw(value || ""); setEditing(true); }}
    >
      {value ? formatMontant(value) : "- €"}
    </span>
  );
}
