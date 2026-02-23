import { memo } from "react";

export default memo(function SortableHeader({
  children,
  sortKey,
  sortConfig,
  onSort,
  resizeProps,
  style,
  className = "",
  ...thProps
}) {
  const isActive = sortConfig?.key === sortKey;
  const dir = isActive ? sortConfig.direction : null;
  const arrow = dir === "asc" ? " ▲" : dir === "desc" ? " ▼" : "";

  return (
    <th
      className={`sortable-header ${isActive ? "sort-active" : ""} ${className}`}
      style={{ ...style, position: "relative" }}
      onClick={onSort ? () => onSort(sortKey) : undefined}
      {...thProps}
    >
      <span className="sortable-header-content">
        {children}
        {onSort && <span className="sort-indicator">{arrow || " ⇕"}</span>}
      </span>
      {resizeProps && (
        <span
          className="col-resize-handle"
          onMouseDown={resizeProps.onMouseDown}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </th>
  );
});
