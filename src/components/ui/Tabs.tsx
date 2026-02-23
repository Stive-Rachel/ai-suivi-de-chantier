import Icon from "./Icon";

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs-container">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={`tab-btn ${active === t.key ? "active" : ""}`}
          >
            {t.icon && <Icon name={t.icon} size={14} />}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
