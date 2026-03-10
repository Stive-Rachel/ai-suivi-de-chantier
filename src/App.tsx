import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./components/AuthProvider";
import { useDataLayer } from "./lib/useDataLayer";
import { useTheme } from "./lib/useTheme";
import { useAutoFlush, getPendingCount } from "./lib/syncQueue";
import { replayOperation } from "./lib/dataLayer";
import { getDirtyCount } from "./lib/dirtyTracker";
import { getSentry } from "./lib/sentry";
import Dashboard from "./components/Dashboard";
import ProjectView from "./components/ProjectView";
import LoginPage from "./components/LoginPage";

function ErrorFallback() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "1rem",
        color: "var(--text-primary)",
      }}
    >
      <p>Une erreur est survenue</p>
      <button onClick={() => window.location.reload()}>Recharger</button>
    </div>
  );
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { db, setDb, loading, mode, forceSync } = useDataLayer(user?.id);
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

  // Warn before unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (getDirtyCount() > 0 || getPendingCount() > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
      forceSync={forceSync}
    />
  );
}

export default function App() {
  const Sentry = getSentry();
  if (Sentry?.ErrorBoundary) {
    return (
      <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
        <AppContent />
      </Sentry.ErrorBoundary>
    );
  }
  return <AppContent />;
}
