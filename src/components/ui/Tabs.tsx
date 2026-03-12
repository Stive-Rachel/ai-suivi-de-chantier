import { useRef, useEffect, useState, useCallback } from "react";
import Icon from "./Icon";

interface Tab {
  key: string;
  label: string;
  icon?: string;
  group?: string;
}

interface TabGroup {
  label: string;
  icon: string;
  tabs: Tab[];
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  /** Tab keys that should be shown as top-level buttons (not inside dropdowns) */
  promoted?: string[];
  /** Group definitions: groupKey -> { label, icon } */
  groups?: Record<string, { label: string; icon: string }>;
}

export default function Tabs({ tabs, active, onChange, promoted = [], groups = {} }: TabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  // Auto-scroll active tab into view
  useEffect(() => {
    const btn = activeRef.current;
    const container = scrollRef.current;
    if (!btn || !container) return;
    const left = btn.offsetLeft - container.offsetLeft;
    const btnCenter = left + btn.offsetWidth / 2;
    const containerCenter = container.clientWidth / 2;
    container.scrollTo({ left: btnCenter - containerCenter, behavior: "smooth" });
  }, [active]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".tab-dropdown")) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openDropdown]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!openDropdown) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDropdown(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [openDropdown]);

  const hasGroups = Object.keys(groups).length > 0;

  // If no groups config, fall back to simple flat tabs with separators
  if (!hasGroups) {
    const items: (Tab | "separator")[] = [];
    let lastGroup: string | undefined;
    for (const tab of tabs) {
      if (tab.group && tab.group !== lastGroup && items.length > 0) items.push("separator");
      items.push(tab);
      lastGroup = tab.group;
    }

    return (
      <div className="tabs-container">
        {canScrollLeft && <div className="tabs-fade tabs-fade-left" aria-hidden="true" />}
        <div className="tabs" role="tablist" ref={scrollRef}>
          {items.map((item, i) =>
            item === "separator" ? (
              <div key={`sep-${i}`} className="tab-separator" aria-hidden="true" />
            ) : (
              <button
                key={item.key}
                ref={active === item.key ? activeRef : undefined}
                role="tab"
                aria-selected={active === item.key}
                onClick={() => onChange(item.key)}
                className={`tab-btn ${active === item.key ? "active" : ""}`}
                title={item.label}
              >
                {item.icon && <Icon name={item.icon} size={15} />}
                <span className="tab-label">{item.label}</span>
              </button>
            )
          )}
        </div>
        {canScrollRight && <div className="tabs-fade tabs-fade-right" aria-hidden="true" />}
      </div>
    );
  }

  // ── Grouped mode: promoted tabs + dropdown groups ──
  const promotedSet = new Set(promoted);

  // Collect promoted tabs in order
  const promotedTabs = tabs.filter((t) => promotedSet.has(t.key));

  // Collect grouped tabs (non-promoted, grouped by group key)
  const groupMap: Record<string, Tab[]> = {};
  for (const tab of tabs) {
    if (promotedSet.has(tab.key)) continue;
    const g = tab.group || "_other";
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(tab);
  }

  // Build ordered group keys (preserve insertion order from tabs)
  const seenGroups: string[] = [];
  for (const tab of tabs) {
    if (promotedSet.has(tab.key)) continue;
    const g = tab.group || "_other";
    if (!seenGroups.includes(g)) seenGroups.push(g);
  }

  const toggleDropdown = (groupKey: string) => {
    setOpenDropdown((prev) => (prev === groupKey ? null : groupKey));
  };

  // Check if active tab is inside a group
  const activeGroup = tabs.find((t) => t.key === active)?.group;

  return (
    <div className="tabs-container">
      {canScrollLeft && <div className="tabs-fade tabs-fade-left" aria-hidden="true" />}
      <div className="tabs" role="tablist" ref={scrollRef}>
        {/* Promoted tabs */}
        {promotedTabs.map((tab) => (
          <button
            key={tab.key}
            ref={active === tab.key ? activeRef : undefined}
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => { onChange(tab.key); setOpenDropdown(null); }}
            className={`tab-btn ${active === tab.key ? "active" : ""}`}
            title={tab.label}
          >
            {tab.icon && <Icon name={tab.icon} size={15} />}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}

        {promotedTabs.length > 0 && seenGroups.length > 0 && (
          <div className="tab-separator" aria-hidden="true" />
        )}

        {/* Dropdown groups */}
        {seenGroups.map((groupKey) => {
          const groupTabs = groupMap[groupKey];
          if (!groupTabs || groupTabs.length === 0) return null;
          const groupDef = groups[groupKey] || { label: groupKey, icon: "folder" };
          const isOpen = openDropdown === groupKey;
          const hasActive = groupTabs.some((t) => t.key === active);
          const activeInGroup = groupTabs.find((t) => t.key === active);

          return (
            <div key={groupKey} className="tab-dropdown">
              <button
                ref={hasActive ? activeRef : undefined}
                className={`tab-btn tab-dropdown-trigger ${hasActive ? "active" : ""}`}
                onClick={() => toggleDropdown(groupKey)}
                aria-expanded={isOpen}
                aria-haspopup="true"
                title={groupDef.label}
              >
                <Icon name={groupDef.icon} size={15} />
                <span className="tab-label">
                  {hasActive ? activeInGroup!.label : groupDef.label}
                </span>
                <svg className={`tab-chevron ${isOpen ? "tab-chevron-open" : ""}`} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2.5 3.5L5 6L7.5 3.5" />
                </svg>
              </button>
              {isOpen && (
                <div className="tab-dropdown-menu">
                  {groupTabs.map((tab) => (
                    <button
                      key={tab.key}
                      role="tab"
                      aria-selected={active === tab.key}
                      className={`tab-dropdown-item ${active === tab.key ? "active" : ""}`}
                      onClick={() => { onChange(tab.key); setOpenDropdown(null); }}
                    >
                      {tab.icon && <Icon name={tab.icon} size={14} />}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canScrollRight && <div className="tabs-fade tabs-fade-right" aria-hidden="true" />}
    </div>
  );
}
