import { useState, useMemo } from "react";

export function useTableSort(data, defaultKey = null, defaultDir = "asc") {
  const [sortConfig, setSortConfig] = useState({ key: defaultKey, direction: defaultDir });

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return { key: null, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !data) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "fr");
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  return { sortConfig, toggleSort, sortedData };
}
