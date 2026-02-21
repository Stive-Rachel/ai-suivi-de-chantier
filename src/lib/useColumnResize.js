import { useState, useCallback, useRef, useEffect } from "react";

export function useColumnResize(initialWidths = {}) {
  const [colWidths, setColWidths] = useState(initialWidths);
  const dragging = useRef(null);
  const didDrag = useRef(false);

  const onResizeStart = useCallback((colKey, startX, startWidth) => {
    dragging.current = { colKey, startX, startWidth };
    didDrag.current = false;

    const onMouseMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      didDrag.current = true;
      const delta = e.clientX - dragging.current.startX;
      const newWidth = Math.max(50, dragging.current.startWidth + delta);
      setColWidths((prev) => ({ ...prev, [dragging.current.colKey]: newWidth }));
    };

    const onMouseUp = () => {
      dragging.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Reset didDrag after a tick so click handler can check it
      setTimeout(() => { didDrag.current = false; }, 0);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const getResizeProps = useCallback((colKey) => ({
    onMouseDown: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const th = e.currentTarget.closest("th");
      const rect = th ? th.getBoundingClientRect() : e.currentTarget.parentElement.getBoundingClientRect();
      onResizeStart(colKey, e.clientX, rect.width);
    },
  }), [onResizeStart]);

  return { colWidths, getResizeProps, isDragging: didDrag };
}
