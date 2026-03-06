-- Fix: Allow new users to create their own profile during signup
-- and apply invitation via a SECURITY DEFINER function

-- Allow users to INSERT their own profile
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Function to apply an invitation (called from the app after signup)
-- SECURITY DEFINER so it runs with full permissions
CREATE OR REPLACE FUNCTION public.apply_invitation(_user_id UUID, _email TEXT)
RETURNS VOID AS $$
DECLARE
  _inv RECORD;
  _pid TEXT;
BEGIN
  -- Find pending invitation
  SELECT * INTO _inv FROM public.invitations
    WHERE email = _email
      AND accepted = false
    ORDER BY created_at DESC
    LIMIT 1;

  IF _inv IS NULL THEN
    RETURN;
  END IF;

  -- Update user profile role
  INSERT INTO public.user_profiles (user_id, email, display_name, role)
  VALUES (_user_id, _email, '', _inv.role)
  ON CONFLICT (user_id) DO UPDATE SET role = _inv.role;

  -- Create project_members
  IF _inv.project_ids IS NOT NULL AND jsonb_array_length(_inv.project_ids) > 0 THEN
    FOR _pid IN SELECT jsonb_array_elements_text(_inv.project_ids) LOOP
      INSERT INTO public.project_members (project_id, user_id)
      VALUES (_pid, _user_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Mark invitation as accepted
  UPDATE public.invitations SET accepted = true WHERE id = _inv.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
