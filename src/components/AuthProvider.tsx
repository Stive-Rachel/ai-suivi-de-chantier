import { createContext, useContext, useState, useEffect } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { getSession, onAuthChange, signInAnonymously } from "../lib/auth";

const AuthContext = createContext({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        } else {
          const u = await signInAnonymously();
          setUser(u);
        }
      } catch (err) {
        console.error("Auth init failed:", err);
      } finally {
        setLoading(false);
      }

      unsubscribe = onAuthChange(setUser);
    }

    init();
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
