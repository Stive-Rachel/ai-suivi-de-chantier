# Auth System & Roles - Design

## Roles

| Role | See projects | Edit tracking | Invite users | Add comments/photos |
|------|-------------|---------------|-------------|-------------------|
| Admin | All | Yes | Yes | Yes |
| Client | Invited projects only | No | No | Yes |

## Auth Flow

- Login: email + password (Supabase Auth)
- No self-registration — admin sends invitation
- Invitation: admin enters email + selects project(s) -> client receives email with link to set password
- Login page: simple email/password form, no "create account" link
- Forgot password via Supabase built-in reset

## New Supabase Tables

### user_profiles
- user_id UUID PK REFERENCES auth.users(id) ON DELETE CASCADE
- email TEXT NOT NULL
- display_name TEXT DEFAULT ''
- role TEXT NOT NULL CHECK (role IN ('admin', 'client')) DEFAULT 'client'
- created_at TIMESTAMPTZ DEFAULT now()

### project_members
- project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- created_at TIMESTAMPTZ DEFAULT now()
- PRIMARY KEY (project_id, user_id)

## RLS Policies (replace current open access)

### projects
- Admin: SELECT/INSERT/UPDATE/DELETE all
- Client: SELECT only where project_id IN project_members for their user_id

### child tables (batiments, lots, lots_decomp, tracking_cells, tracking_meta)
- Admin: full access
- Client: SELECT only (via project membership)

### tracking_cells / tracking_meta
- Client: no INSERT/UPDATE/DELETE (read-only tracking)

### project_photos
- Admin: full access
- Client: SELECT + INSERT on projects they're members of (can add photos but not delete others')

## UI Changes

### New: Login Page
- Email + password form
- "Mot de passe oublie" link
- No registration link
- Redirect to app after login

### New: Users Section (admin only)
- In project settings or global settings
- List invited users with role
- "Inviter" button: enter email, select project(s), choose role
- Revoke access button

### Modified: Header
- Show user email/name
- Logout button
- Role indicator (admin badge)

### Modified: AuthProvider
- Replace signInAnonymously with email/password flow
- Redirect to login page if not authenticated
- Load user profile + role after auth

### Modified: Navigation/UI
- Hide edit controls for client role (tracking cells read-only)
- Hide admin-only tabs/sections (setup, lots config, etc.)
- Show "add photo" and "add comment" for clients

## Implementation Steps

1. SQL: Create user_profiles + project_members tables, update RLS policies
2. Login page component
3. Update AuthProvider (remove anonymous, add email/password)
4. User profile loading after auth
5. Invitation system (admin UI + Supabase invite email)
6. Role-based UI: hide/show controls based on role
7. Update RLS in production Supabase
8. Test: admin flow, client flow, unauthorized access
