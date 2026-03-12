import { useRef, useEffect, useState, useCallback } from "react";
import Icon from "./Icon";

interface Tab {
  key: string;
  label: string;
  icon?: string;
  group?: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
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
    container.scrollTo({
      left: btnCenter - containerCenter,
      behavior: "smooth",
    });
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

  // Build grouped tabs with separators
  const items: (Tab | "separator")[] = [];
  let lastGroup: string | undefined;
  for (const tab of tabs) {
    if (tab.group && tab.group !== lastGroup && items.length > 0) {
      items.push("separator");
    }
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
