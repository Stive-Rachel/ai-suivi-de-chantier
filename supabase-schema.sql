-- ═══════════════════════════════════════════════════════════════════
-- Construction Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables
-- ═══════════════════════════════════════════════════════════════════

-- 1. Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  client TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  montant_total NUMERIC DEFAULT 0,
  montant_ext NUMERIC DEFAULT 0,
  montant_int NUMERIC DEFAULT 0,

  date_debut_chantier TEXT DEFAULT '',
  duree_totale INTEGER DEFAULT 0,
  duree_ext INTEGER DEFAULT 0,
  duree_int INTEGER DEFAULT 0,
  date_debut_int TEXT DEFAULT '',
  date_debut_ext TEXT DEFAULT '',
  semaines_exclues INTEGER DEFAULT 0,
  semaines_travaillees INTEGER DEFAULT 0,

  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Batiments
CREATE TABLE batiments (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nb_logements INTEGER DEFAULT 0,
  logements JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,

  PRIMARY KEY (project_id, id)
);

-- 3. Lots (global)
CREATE TABLE lots (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  nom TEXT NOT NULL DEFAULT '',
  montant_marche NUMERIC DEFAULT 0,
  montant_ext NUMERIC DEFAULT 0,
  montant_int NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,

  PRIMARY KEY (project_id, numero)
);

-- 4. Lots Decomp (lotsInt + lotsExt unified)
CREATE TABLE lots_decomp (
  id SERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('int', 'ext')),
  numero TEXT NOT NULL,
  nom TEXT NOT NULL DEFAULT '',
  nom_decomp TEXT DEFAULT '',
  track_prefix TEXT NOT NULL,
  decompositions JSONB DEFAULT '[]'::jsonb,
  montant NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,

  UNIQUE (project_id, type, track_prefix)
);

-- 5. Tracking Cells (hot path — 1 row per cell)
CREATE TABLE tracking_cells (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('logements', 'batiments')),
  row_key TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT DEFAULT '',

  PRIMARY KEY (project_id, track_type, row_key, entity_id)
);

CREATE INDEX idx_tracking_cells_project
  ON tracking_cells(project_id, track_type);

-- 6. Tracking Meta (ponderation + tache per row)
CREATE TABLE tracking_meta (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  track_type TEXT NOT NULL CHECK (track_type IN ('logements', 'batiments')),
  row_key TEXT NOT NULL,
  ponderation INTEGER DEFAULT 1,
  tache TEXT DEFAULT '',

  PRIMARY KEY (project_id, track_type, row_key)
);

-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE batiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots_decomp ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_meta ENABLE ROW LEVEL SECURITY;

-- Projects: users access their own
CREATE POLICY "users_own_projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Child tables: access via project ownership
CREATE POLICY "users_own_batiments" ON batiments
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "users_own_lots" ON lots
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "users_own_lots_decomp" ON lots_decomp
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "users_own_tracking_cells" ON tracking_cells
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "users_own_tracking_meta" ON tracking_meta
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════
-- Auto-update updated_at
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
