import { useState } from "react";
import { loadDB } from "./lib/db";
import Dashboard from "./components/Dashboard";
import ProjectView from "./components/ProjectView";

export default function App() {
  const [db, setDb] = useState(() => loadDB());
  const [openProjectId, setOpenProjectId] = useState(null);

  const openProject = db.projects.find((p) => p.id === openProjectId);

  if (openProject) {
    return (
      <ProjectView project={openProject} db={db} setDb={setDb} onBack={() => setOpenProjectId(null)} />
    );
  }

  return <Dashboard db={db} setDb={setDb} onOpenProject={setOpenProjectId} />;
}
