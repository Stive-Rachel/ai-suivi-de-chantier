-- Fix 1: CRITICAL — Restrict invitations table RLS policy
-- Previously allowed ANYONE to read ALL invitations.
-- Now only authenticated users can see invitations matching their own email.

DROP POLICY IF EXISTS "anyone_select_invitation_by_email" ON invitations;

-- Authenticated users can only see invitations for their own email
CREATE POLICY "users_select_own_invitation" ON invitations
  FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Unauthenticated users cannot see any invitations
-- The apply_invitation function (SECURITY DEFINER) handles invitation lookup during signup


-- Fix 3: HIGH — Prevent users from changing their own role via UPDATE
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role = (SELECT role FROM user_profiles WHERE user_id = auth.uid())
  );
