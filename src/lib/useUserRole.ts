import { useState, useEffect } from "react";
import { useAuth } from "../components/AuthProvider";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useUserRole() {
  const { user, profile } = useAuth();
  const role = profile?.role ?? "admin";
  const isAdmin = role === "admin";
  const isClient = role === "client";

  const [allowedProjectIds, setAllowedProjectIds] = useState<string[] | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    if (!isClient || !user?.id || !isSupabaseConfigured() || !supabase) {
      setAllowedProjectIds(null);
      return;
    }

    let cancelled = false;
    setLoadingProjects(true);

    async function fetchAllowedProjects() {
      try {
        const { data: members, error } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", user.id);

        if (!cancelled) {
          if (error) {
            console.warn("useUserRole: could not fetch project_members", error);
            setAllowedProjectIds([]);
          } else {
            setAllowedProjectIds((members || []).map((m: { project_id: string }) => m.project_id));
          }
        }
      } catch (err) {
        console.warn("useUserRole: error fetching allowed projects", err);
        if (!cancelled) {
          setAllowedProjectIds([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingProjects(false);
        }
      }
    }

    fetchAllowedProjects();
    return () => { cancelled = true; };
  }, [user?.id, isClient]);

  return {
    role,
    isAdmin,
    isClient,
    profile,
    allowedProjectIds,
    loadingProjects,
  };
}
