import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./components/AuthProvider";
import { useDataLayer } from "./lib/useDataLayer";
import { useTheme } from "./lib/useTheme";
import { useAutoFlush } from "./lib/syncQueue";
import { replayOperation } from "./lib/dataLayer";
import Dashboard from "./components/Dashboard";
import ProjectView from "./components/ProjectView";
import LoginPage from "./components/LoginPage";

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { db, setDb, loading, mode } = useDataLayer(user?.id);
  const [openProjectId, setOpenProjectId] = useState(null);
  const { theme, toggleTheme } = useTheme();

  // Reset to home when user changes (login/logout)
  useEffect(() => {
    setOpenProjectId(null);
  }, [user?.id]);

  // Auto-flush sync queue when coming back online
  useAutoFlush(useCallback(replayOperation, []));

  // Keyboard shortcut: Escape goes back to projects list
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape" && openProjectId) {
        setOpenProjectId(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [openProjectId]);

  if (authLoading) {
    return (
      <div className="app-shell">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-tertiary)" }}>
          Chargement...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (loading || !db) {
    return (
      <div className="app-shell">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text-tertiary)" }}>
          Chargement...
        </div>
      </div>
    );
  }

  const openProject = db.projects.find((p) => p.id === openProjectId);

  if (openProject) {
    return (
      <ProjectView
        project={openProject}
        db={db}
        setDb={setDb}
        mode={mode}
        userId={user?.id}
        onBack={() => setOpenProjectId(null)}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <Dashboard
      db={db}
      setDb={setDb}
      mode={mode}
      userId={user?.id}
      onOpenProject={setOpenProjectId}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
