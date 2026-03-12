import { useId } from "react";

export default function Input({ label, value, onChange, placeholder, type = "text" }) {
  const id = useId();
  return (
    <div className="input-group">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
        inputMode={type === "number" ? "numeric" : undefined}
      />
    </div>
  );
}
