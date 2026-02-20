export default function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}
