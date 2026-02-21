import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { saveDB } from "../lib/db";
import { computeProjectProgress } from "../lib/computations";
import * as dataLayer from "../lib/dataLayer";
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

export default function ProjectView({ project, db, setDb, mode, userId, onBack }) {
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

  // Supabase sync helpers — fire-and-forget, localStorage is always saved first
  const supaSync = useMemo(() => ({
    updateFields: (fields) =>
      dataLayer.updateProjectFields(project.id, fields).catch(console.error),
    setTrackingCell: (trackType, rowKey, entityId, status) =>
      dataLayer.setTrackingCell(project.id, trackType, rowKey, entityId, status).catch(console.error),
    setTrackingMeta: (trackType, rowKey, meta) =>
      dataLayer.setTrackingMeta(project.id, trackType, rowKey, meta).catch(console.error),
    syncBatiments: (batiments) =>
      dataLayer.syncBatiments(project.id, batiments).catch(console.error),
    syncLots: (lots) =>
      dataLayer.syncLots(project.id, lots).catch(console.error),
    syncLotsDecomp: (lotsInt, lotsExt) =>
      dataLayer.syncLotsDecomp(project.id, lotsInt, lotsExt).catch(console.error),
    fullSync: (p) =>
      dataLayer.fullProjectSync(p, userId).catch(console.error),
  }), [project.id, userId]);

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
        {mode === "supabase" && (
          <span className="connection-badge connected" title="Connecté à Supabase">cloud</span>
        )}
        {mode === "local" && (
          <span className="connection-badge local" title="Mode local (localStorage)">local</span>
        )}
      </header>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="tab-content" role="tabpanel">
        {activeTab === "setup" && <SetupTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "batiments-config" && <BatimentsTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "lots" && <LotsTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "logements" && <TrackingGrid project={currentProject} updateProject={updateProject} supaSync={supaSync} type="logements" />}
        {activeTab === "batiments" && <TrackingGrid project={currentProject} updateProject={updateProject} supaSync={supaSync} type="batiments" />}
        <Suspense fallback={<TabLoader />}>
          {activeTab === "recap" && <RecapTab project={currentProject} />}
          {activeTab === "recap-av" && <RecapAvancementTab project={currentProject} />}
          {activeTab === "avancement" && <AvancementTab project={currentProject} />}
          {activeTab === "export" && <ExportTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        </Suspense>
      </div>
    </div>
  );
}
