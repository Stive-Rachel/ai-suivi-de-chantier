import { useState, useCallback, lazy, Suspense } from "react";
import { saveDB } from "../lib/db";
import { computeProjectProgress } from "../lib/computations";
import Button from "./ui/Button";
import Tabs from "./ui/Tabs";
import ProgressBar from "./ui/ProgressBar";
import SetupTab from "./tabs/SetupTab";
import BatimentsTab from "./tabs/BatimentsTab";
import LotsTab from "./tabs/LotsTab";
import TrackingGrid from "./tabs/TrackingGrid";

const RecapTab = lazy(() => import("./tabs/RecapTab"));
const RecapAvancementTab = lazy(() => import("./tabs/RecapAvancementTab"));
const AvancementTab = lazy(() => import("./tabs/AvancementTab"));
const ExportTab = lazy(() => import("./tabs/ExportTab"));

function TabLoader() {
  return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Chargement...</div>;
}

export default function ProjectView({ project, db, setDb, onBack }) {
  const [activeTab, setActiveTab] = useState("setup");

  const updateProject = useCallback(
    (updater) => {
      setDb((prev) => {
        const updated = {
          ...prev,
          projects: prev.projects.map((p) => (p.id === project.id ? updater(p) : p)),
        };
        saveDB(updated);
        return updated;
      });
    },
    [project.id, setDb]
  );

  const currentProject = db.projects.find((p) => p.id === project.id) || project;

  const tabs = [
    { key: "setup", label: "Configuration", icon: "settings" },
    { key: "batiments-config", label: "Bâtiments", icon: "building" },
    { key: "lots", label: "Lots", icon: "folder" },
    { key: "logements", label: "Suivi INT", icon: "home" },
    { key: "batiments", label: "Suivi EXT", icon: "building" },
    { key: "recap", label: "Récap", icon: "chart" },
    { key: "recap-av", label: "Récap Av.", icon: "chart" },
    { key: "avancement", label: "Avancement", icon: "chart" },
    { key: "export", label: "Export", icon: "download" },
  ];

  return (
    <div className="app-shell">
      <header className="project-header">
        <Button variant="ghost" icon="back" onClick={onBack} size="sm">
          Projets
        </Button>
        <div className="separator" />
        <div className="project-info">
          <h2>{currentProject.name}</h2>
          <p>
            {currentProject.location}
            {currentProject.client ? ` \u00b7 ${currentProject.client}` : ""}
          </p>
        </div>
        <div className="header-progress">
          <ProgressBar value={computeProjectProgress(currentProject)} />
        </div>
      </header>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="tab-content" role="tabpanel">
        {activeTab === "setup" && <SetupTab project={currentProject} updateProject={updateProject} />}
        {activeTab === "batiments-config" && <BatimentsTab project={currentProject} updateProject={updateProject} />}
        {activeTab === "lots" && <LotsTab project={currentProject} updateProject={updateProject} />}
        {activeTab === "logements" && <TrackingGrid project={currentProject} updateProject={updateProject} type="logements" />}
        {activeTab === "batiments" && <TrackingGrid project={currentProject} updateProject={updateProject} type="batiments" />}
        <Suspense fallback={<TabLoader />}>
          {activeTab === "recap" && <RecapTab project={currentProject} />}
          {activeTab === "recap-av" && <RecapAvancementTab project={currentProject} />}
          {activeTab === "avancement" && <AvancementTab project={currentProject} />}
          {activeTab === "export" && <ExportTab project={currentProject} updateProject={updateProject} />}
        </Suspense>
      </div>
    </div>
  );
}
