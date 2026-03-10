-- ═══════════════════════════════════════════════════════════════════
-- Construction Tracker — Auth & RLS Migration
-- Ce script ajoute le système d'authentification multi-rôles
-- (admin / client) avec des policies RLS granulaires.
--
-- IDEMPOTENT : peut être relancé sans erreur.
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. Nouvelles tables
-- ═══════════════════════════════════════════════════════════════════

-- 1a. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1b. project_members
CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- Index pour les lookups par user_id
CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON project_members(user_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Activer RLS sur les nouvelles tables
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Helper : fonction pour vérifier si l'utilisateur est admin
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper : vérifier si l'utilisateur est membre d'un projet
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = _project_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Drop des anciennes policies
-- ═══════════════════════════════════════════════════════════════════

-- projects
DROP POLICY IF EXISTS "users_own_projects" ON projects;
DROP POLICY IF EXISTS "admin_all_projects" ON projects;
DROP POLICY IF EXISTS "client_select_projects" ON projects;

-- batiments
DROP POLICY IF EXISTS "users_own_batiments" ON batiments;
DROP POLICY IF EXISTS "admin_all_batiments" ON batiments;
DROP POLICY IF EXISTS "client_select_batiments" ON batiments;

-- lots
DROP POLICY IF EXISTS "users_own_lots" ON lots;
DROP POLICY IF EXISTS "admin_all_lots" ON lots;
DROP POLICY IF EXISTS "client_select_lots" ON lots;

-- lots_decomp
DROP POLICY IF EXISTS "users_own_lots_decomp" ON lots_decomp;
DROP POLICY IF EXISTS "admin_all_lots_decomp" ON lots_decomp;
DROP POLICY IF EXISTS "client_select_lots_decomp" ON lots_decomp;

-- tracking_cells
DROP POLICY IF EXISTS "users_own_tracking_cells" ON tracking_cells;
DROP POLICY IF EXISTS "admin_all_tracking_cells" ON tracking_cells;
DROP POLICY IF EXISTS "client_select_tracking_cells" ON tracking_cells;

-- tracking_meta
DROP POLICY IF EXISTS "users_own_tracking_meta" ON tracking_meta;
DROP POLICY IF EXISTS "admin_all_tracking_meta" ON tracking_meta;
DROP POLICY IF EXISTS "client_select_tracking_meta" ON tracking_meta;

-- user_profiles
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;

-- project_members
DROP POLICY IF EXISTS "admin_all_project_members" ON project_members;
DROP POLICY IF EXISTS "client_select_project_members" ON project_members;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Nouvelles policies RLS
-- ═══════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------
-- 5a. projects
-- ---------------------------------------------------------------

-- Admin : accès complet
CREATE POLICY "admin_all_projects" ON projects
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Client : SELECT uniquement sur les projets dont il est membre
CREATE POLICY "client_select_projects" ON projects
  FOR SELECT
  USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- Client : UPDATE pour permettre la sync des champs projet
CREATE POLICY "client_update_projects" ON projects
  FOR UPDATE
  USING (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5b. batiments
-- ---------------------------------------------------------------

CREATE POLICY "admin_all_batiments" ON batiments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "client_select_batiments" ON batiments
  FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5c. lots
-- ---------------------------------------------------------------

CREATE POLICY "admin_all_lots" ON lots
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "client_select_lots" ON lots
  FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5d. lots_decomp
-- ---------------------------------------------------------------

CREATE POLICY "admin_all_lots_decomp" ON lots_decomp
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "client_select_lots_decomp" ON lots_decomp
  FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5e. tracking_cells
-- ---------------------------------------------------------------

CREATE POLICY "admin_all_tracking_cells" ON tracking_cells
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "client_select_tracking_cells" ON tracking_cells
  FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "client_insert_tracking_cells" ON tracking_cells
  FOR INSERT
  WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "client_update_tracking_cells" ON tracking_cells
  FOR UPDATE
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5f. tracking_meta
-- ---------------------------------------------------------------

CREATE POLICY "admin_all_tracking_meta" ON tracking_meta
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "client_select_tracking_meta" ON tracking_meta
  FOR SELECT
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "client_insert_tracking_meta" ON tracking_meta
  FOR INSERT
  WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

CREATE POLICY "client_update_tracking_meta" ON tracking_meta
  FOR UPDATE
  USING (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5g. user_profiles
-- ---------------------------------------------------------------

-- Chaque utilisateur peut lire son propre profil
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Les admins peuvent lire tous les profils
CREATE POLICY "admin_read_all_profiles" ON user_profiles
  FOR SELECT
  USING (public.is_admin());

-- Chaque utilisateur peut mettre à jour son propre profil (sauf le rôle)
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------
-- 5i. project_members
-- ---------------------------------------------------------------

-- Admin : CRUD complet
CREATE POLICY "admin_all_project_members" ON project_members
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Client : peut lire ses propres appartenances
CREATE POLICY "client_select_project_members" ON project_members
  FOR SELECT
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════
-- 6. Trigger : auto-création du profil à l'inscription
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    'client'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop le trigger s'il existe avant de le recréer
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- 7. Table invitations (système d'invitation par les admins)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  project_ids JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Drop anciennes policies invitations
DROP POLICY IF EXISTS "admin_all_invitations" ON invitations;
DROP POLICY IF EXISTS "anyone_select_invitation_by_email" ON invitations;

-- Admin : CRUD complet sur les invitations
CREATE POLICY "admin_all_invitations" ON invitations
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tout le monde peut lire les invitations par email (nécessaire pour le signup)
-- On ne filtre pas par user car l'utilisateur n'est pas encore inscrit
CREATE POLICY "anyone_select_invitation_by_email" ON invitations
  FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════════════
-- 8. Mise à jour du trigger handle_new_user pour appliquer les invitations
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _inv RECORD;
  _pid TEXT;
BEGIN
  -- Chercher une invitation pending pour cet email
  SELECT * INTO _inv FROM public.invitations
    WHERE email = COALESCE(NEW.email, '')
      AND accepted = false
    ORDER BY created_at DESC
    LIMIT 1;

  IF _inv IS NOT NULL THEN
    -- Créer le profil avec le rôle de l'invitation
    INSERT INTO public.user_profiles (user_id, email, display_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
      _inv.role
    )
    ON CONFLICT (user_id) DO UPDATE SET role = _inv.role;

    -- Créer les project_members pour chaque projet de l'invitation
    IF _inv.project_ids IS NOT NULL AND jsonb_array_length(_inv.project_ids) > 0 THEN
      FOR _pid IN SELECT jsonb_array_elements_text(_inv.project_ids) LOOP
        INSERT INTO public.project_members (project_id, user_id)
        VALUES (_pid, NEW.id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;

    -- Marquer l'invitation comme acceptée
    UPDATE public.invitations SET accepted = true WHERE id = _inv.id;
  ELSE
    -- Pas d'invitation : créer un profil client par défaut
    INSERT INTO public.user_profiles (user_id, email, display_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
      'client'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-créer le trigger avec la nouvelle fonction
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
