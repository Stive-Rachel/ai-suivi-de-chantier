// ─── Core Domain Types ──────────────────────────────────────────────────────

export interface PlanningLogementEntry {
  semaine: number;
  dateDebut: string;
  cible: number;
}

export interface Batiment {
  id: string;
  name: string;
  nbLogements: number;
  logements?: number[];
}

export interface Lot {
  numero: string;
  nom: string;
  montantMarche: number;
  montantExt: number;
  montantInt: number;
}

export interface LotDecomp {
  numero: string;
  nom: string;
  nomDecomp?: string;
  trackPrefix?: string;
  decompositions: string[];
  montant: number;
}

export type CellStatus = "" | "X" | "!" | "NOK" | "i";

export interface TrackingCell {
  status: CellStatus;
}

export type TrackingRow = Record<string, TrackingCell | number | string> & {
  _ponderation?: number;
  _tache?: string;
};

export type TrackingMap = Record<string, TrackingRow>;

export interface TrackingData {
  logements: TrackingMap;
  batiments: TrackingMap;
}

/** Map of entityId -> true for logements excluded from progress tracking */
export type ExceptionsMap = Record<string, boolean>;

export interface Project {
  id: string;
  name: string;
  location: string;
  client: string;
  createdAt: string;
  montantTotal: number;
  montantExt: number;
  montantInt: number;
  dateDebutChantier: string;
  dureeTotale: number;
  dureeExt: number;
  dureeInt: number;
  dateDebutInt: string;
  dateDebutExt: string;
  semainesExclues: number;
  semainesTravaillees: number;
  batiments: Batiment[];
  lots: Lot[];
  lotsInt: LotDecomp[];
  lotsExt: LotDecomp[];
  tracking: TrackingData;
  /** Logements marked as exceptions (excluded from progress calculations) */
  exceptions?: ExceptionsMap;
  planningLogements?: PlanningLogementEntry[];
}

export interface DB {
  projects: Project[];
}

// ─── Computation Results ────────────────────────────────────────────────────

export interface LotProgress {
  lot: string;
  shortLot: string;
  montant: number;
  progress: number;
}

export interface BatimentProgress {
  name: string;
  int: number;
  ext: number;
  total: number;
}

export interface DetailedProgress {
  lotProgressInt: LotProgress[];
  lotProgressExt: LotProgress[];
  batimentProgress: BatimentProgress[];
}

// ─── UI Types ───────────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  cls: string;
}

export interface StatusBadgeStyle {
  background: string;
  color: string;
}

// ─── Supabase Row Types ─────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  name: string;
  location: string;
  client: string;
  created_at: string;
  montant_total: number;
  montant_ext: number;
  montant_int: number;
  date_debut_chantier: string;
  duree_totale: number;
  duree_ext: number;
  duree_int: number;
  date_debut_int: string;
  date_debut_ext: string;
  semaines_exclues: number;
  semaines_travaillees: number;
  user_id: string;
}

export interface BatimentRow {
  id: string;
  project_id: string;
  name: string;
  nb_logements: number;
  logements: number[];
  sort_order: number;
}

export interface LotRow {
  project_id: string;
  numero: string;
  nom: string;
  montant_marche: number;
  montant_ext: number;
  montant_int: number;
  sort_order: number;
}

export interface LotDecompRow {
  project_id: string;
  type: "int" | "ext";
  numero: string;
  nom: string;
  nom_decomp: string;
  track_prefix: string;
  decompositions: string[];
  montant: number;
  sort_order: number;
}

export interface TrackingCellRow {
  project_id: string;
  track_type: string;
  row_key: string;
  entity_id: string;
  status: string;
}

export interface TrackingMetaRow {
  project_id: string;
  track_type: string;
  row_key: string;
  ponderation: number;
  tache: string;
}
