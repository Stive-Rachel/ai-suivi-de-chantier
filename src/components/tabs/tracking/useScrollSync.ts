import { useRef, useEffect, useCallback } from "react";

export interface ScrollSyncRefs {
  topScrollRef: React.RefObject<HTMLDivElement | null>;
  topScrollInner: React.RefObject<HTMLDivElement | null>;
  mainScrollRef: React.RefObject<HTMLDivElement | null>;
  handleTopScroll: () => void;
  handleMainScroll: () => void;
}

export function useScrollSync(): ScrollSyncRefs {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollInner = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const syncing = useRef(false);

  // Sync top scrollbar width with table width
  useEffect(() => {
    const main = mainScrollRef.current;
    if (!main || !topScrollInner.current) return;
    const updateWidth = () => {
      if (topScrollInner.current) {
        topScrollInner.current.style.width = main.scrollWidth + "px";
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(main);
    return () => ro.disconnect();
  });

  const handleTopScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (mainScrollRef.current && topScrollRef.current) {
      mainScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  const handleMainScroll = useCallback(() => {
    if (syncing.current) return;
    syncing.current = true;
    if (topScrollRef.current && mainScrollRef.current) {
      topScrollRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
    }
    syncing.current = false;
  }, []);

  return { topScrollRef, topScrollInner, mainScrollRef, handleTopScroll, handleMainScroll };
}
