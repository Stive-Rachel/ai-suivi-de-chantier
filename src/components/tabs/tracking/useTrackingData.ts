import { useMemo } from "react";
import { getLogementNums } from "../../../lib/db";
import type {
  Project,
  Batiment,
  LotDecomp,
  ExceptionsMap,
  TrackingMap,
  CellStatus,
} from "../../../types";

export interface TrackingEntity {
  id: string;
  label: string;
  group: string | null;
}

export interface TrackingRowData {
  key: string;
  lotNumero: string;
  lotNom: string;
  decomposition: string;
}

export interface RowStat {
  done: number;
  total: number;
  av: number;
  avParLot: number;
  pctDuLot: number;
}

export interface TrackingFilters {
  statusFilter: string;
  searchText: string;
  entitySearch?: string;
}

export interface SortConfig {
  key: string | null;
  direction: "asc" | "desc";
}

interface UseTrackingDataParams {
  project: Project;
  type: "logements" | "batiments";
  filters: TrackingFilters;
  sortConfig: SortConfig;
}

interface UseTrackingDataResult {
  isLogements: boolean;
  lots: LotDecomp[];
  entities: TrackingEntity[];
  activeEntities: TrackingEntity[];
  excCount: number;
  rows: TrackingRowData[];
  rowStats: Record<string, RowStat>;
  filteredRows: TrackingRowData[];
  sortedRows: TrackingRowData[];
  tracking: TrackingMap;
  exceptions: ExceptionsMap;
  getValue: (rowKey: string, entityId: string) => CellStatus | string;
  getPonderation: (rowKey: string) => number;
}

export function useTrackingData({
  project,
  type,
  filters,
  sortConfig,
}: UseTrackingDataParams): UseTrackingDataResult {
  const isLogements = type === "logements";
  const lotsRaw = isLogements ? project.lotsInt : project.lotsExt;

  const lots = useMemo(
    () =>
      [...(lotsRaw || [])].sort((a, b) => {
        const na = parseFloat(a.numero) || 0;
        const nb = parseFloat(b.numero) || 0;
        if (na !== nb) return na - nb;
        return (a.nom || "").localeCompare(b.nom || "");
      }),
    [lotsRaw],
  );

  const exceptions: ExceptionsMap = project.exceptions || {};
  const tracking: TrackingMap = project.tracking?.[type] || {};

  const getValue = (rowKey: string, entityId: string): CellStatus | string =>
    (tracking[rowKey]?.[entityId] as { status: string } | undefined)?.status || "";

  const getPonderation = (rowKey: string): number =>
    (tracking[rowKey]?._ponderation as number) || 1;

  const entities = useMemo((): TrackingEntity[] => {
    if (isLogements) {
      const result: TrackingEntity[] = [];
      for (const bat of project.batiments) {
        for (const num of getLogementNums(bat)) {
          result.push({
            id: `${bat.id}_log_${num}`,
            label: `${num}`,
            group: bat.name,
          });
        }
      }
      return result;
    }
    return project.batiments.map((b) => ({ id: b.id, label: b.name, group: null }));
  }, [project.batiments, isLogements]);

  const activeEntities = useMemo((): TrackingEntity[] => {
    if (!isLogements) return entities;
    return entities.filter((e) => !exceptions[e.id]);
  }, [entities, exceptions, isLogements]);

  const excCount = useMemo((): number => {
    if (!isLogements) return 0;
    return entities.filter((e) => exceptions[e.id]).length;
  }, [entities, exceptions, isLogements]);

  const rows = useMemo((): TrackingRowData[] => {
    const result: TrackingRowData[] = [];
    for (const lot of lots) {
      for (const decomp of lot.decompositions) {
        result.push({
          key: `${lot.trackPrefix || lot.numero}-${decomp}`,
          lotNumero: lot.numero,
          lotNom: lot.nom,
          decomposition: decomp,
        });
      }
    }
    return result;
  }, [lots]);

  const rowStats = useMemo((): Record<string, RowStat> => {
    const stats: Record<string, RowStat> = {};
    const allLots = project.lots || [];
    for (const lot of lots) {
      const lotMarche =
        allLots.find((l) => l.numero === lot.numero)?.montantMarche || 0;
      const pctDuLot = lotMarche > 0 ? (lot.montant || 0) / lotMarche : 0;
      for (const decomp of lot.decompositions) {
        const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
        let done = 0;
        let naCount = 0;
        for (const e of activeEntities) {
          const status = (tracking[key]?.[e.id] as { status: string } | undefined)
            ?.status;
          if (status === "X") done++;
          else if (status === "N/A") naCount++;
        }
        const activeCount = activeEntities.length - naCount;
        const av = activeCount > 0 ? (done / activeCount) * 100 : 0;
        stats[key] = { done, total: activeCount, av, avParLot: pctDuLot * av, pctDuLot };
      }
    }
    return stats;
  }, [lots, activeEntities, tracking, project.lots]);

  const filteredRows = useMemo((): TrackingRowData[] => {
    return rows.filter((row) => {
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        if (!row.decomposition.toLowerCase().includes(search)) return false;
      }
      if (filters.statusFilter !== "all") {
        const statuses = entities.map((e) => getValue(row.key, e.id));
        switch (filters.statusFilter) {
          case "incomplete":
            if (statuses.every((s) => s === "X")) return false;
            break;
          case "complete":
            if (!statuses.every((s) => s === "X")) return false;
            break;
          case "alert":
            if (!statuses.some((s) => s === "!")) return false;
            break;
          case "nok":
            if (!statuses.some((s) => s === "NOK")) return false;
            break;
        }
      }
      return true;
    });
  }, [rows, filters, entities, tracking]);

  const sortedRows = useMemo((): TrackingRowData[] => {
    const sorted = [...filteredRows].sort((a, b) => {
      if (!sortConfig.key) {
        const na = parseFloat(a.lotNumero) || 0;
        const nb = parseFloat(b.lotNumero) || 0;
        if (na !== nb) return na - nb;
        return a.decomposition.localeCompare(b.decomposition, "fr");
      }
      let aVal: string | number;
      let bVal: string | number;
      if (sortConfig.key === "decomposition") {
        aVal = a.decomposition;
        bVal = b.decomposition;
      } else if (sortConfig.key === "ponderation") {
        aVal = getPonderation(a.key);
        bVal = getPonderation(b.key);
      } else {
        aVal = getValue(a.key, sortConfig.key) || "";
        bVal = getValue(b.key, sortConfig.key) || "";
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal), "fr");
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortConfig, tracking]);

  return {
    isLogements,
    lots,
    entities,
    activeEntities,
    excCount,
    rows,
    rowStats,
    filteredRows,
    sortedRows,
    tracking,
    exceptions,
    getValue,
    getPonderation,
  };
}
