import { createContext, useContext, useState, useEffect } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { getSession, onAuthChange, signOut as authSignOut } from "../lib/auth";

export interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
  role: "admin" | "client";
}

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
  return data as UserProfile;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSignOut = async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    let unsubscribe = () => {};

    async function init() {
      try {
        const session = await getSession();
        if (session?.user) {
          setUser(session.user);
          const p = await fetchUserProfile(session.user.id);
          setProfile(p);
        }
        // No session = user stays null, LoginPage will be shown
      } catch (err) {
        console.error("Auth init failed:", err);
      } finally {
        setLoading(false);
      }

      unsubscribe = onAuthChange(async (authUser) => {
        setUser(authUser);
        if (authUser) {
          const p = await fetchUserProfile(authUser.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      });
    }

    init();
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
