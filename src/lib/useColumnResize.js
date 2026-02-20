import { useState, useCallback, useRef } from "react";

export function useColumnResize(initialWidths = {}) {
  const [colWidths, setColWidths] = useState(initialWidths);
  const dragging = useRef(null);

  const onResizeStart = useCallback((colKey, startX, startWidth) => {
    dragging.current = { colKey, startX, startWidth };

    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragging.current.startX;
      const newWidth = Math.max(30, dragging.current.startWidth + delta);
      setColWidths((prev) => ({ ...prev, [dragging.current.colKey]: newWidth }));
    };

    const onMouseUp = () => {
      dragging.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const getResizeProps = useCallback((colKey) => ({
    onMouseDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.parentElement.getBoundingClientRect();
      onResizeStart(colKey, e.clientX, rect.width);
    },
  }), [onResizeStart]);

  return { colWidths, getResizeProps };
}
