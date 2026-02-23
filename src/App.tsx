import { useState } from "react";
import { useAuth } from "./components/AuthProvider";
import { useDataLayer } from "./lib/useDataLayer";
import Dashboard from "./components/Dashboard";
import ProjectView from "./components/ProjectView";

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { db, setDb, loading, mode } = useDataLayer(user?.id);
  const [openProjectId, setOpenProjectId] = useState(null);

  if (authLoading || loading || !db) {
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
      />
    );
  }

  return <Dashboard db={db} setDb={setDb} mode={mode} userId={user?.id} onOpenProject={setOpenProjectId} />;
}
