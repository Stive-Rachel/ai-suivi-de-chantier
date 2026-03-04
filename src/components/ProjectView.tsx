import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from "react";
import { saveDB } from "../lib/db";
import { computeProjectProgress } from "../lib/computations";
import * as dataLayer from "../lib/dataLayer";
import Button from "./ui/Button";
import Tabs from "./ui/Tabs";
import ProgressBar from "./ui/ProgressBar";
import Modal from "./ui/Modal";
import AlertPanel, { countAlerts } from "./ui/AlertPanel";
import ThemeToggle from "./ui/ThemeToggle";
import SyncStatusBadge from "./ui/SyncStatusBadge";
import SetupTab from "./tabs/SetupTab";
import BatimentsTab from "./tabs/BatimentsTab";
import LotsTab from "./tabs/LotsTab";
import TrackingGrid from "./tabs/TrackingGrid";
import QuickEntry from "./QuickEntry";

const DashboardTab = lazy(() => import("./tabs/DashboardTab"));
const RecapTab = lazy(() => import("./tabs/RecapTab"));
const RecapAvancementTab = lazy(() => import("./tabs/RecapAvancementTab"));
const AvancementTab = lazy(() => import("./tabs/AvancementTab"));
const ExportTab = lazy(() => import("./tabs/ExportTab"));
const GanttTab = lazy(() => import("./tabs/GanttTab"));
const PhotosTab = lazy(() => import("./tabs/PhotosTab"));
const PlanningTab = lazy(() => import("./tabs/PlanningTab"));
const HelpTab = lazy(() => import("./tabs/HelpTab"));

function TabLoader() {
  return <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Chargement...</div>;
}

export default function ProjectView({ project, db, setDb, mode, userId, onBack, theme, toggleTheme }: any) {
  const [activeTab, setActiveTab] = useState("setup");
  const [alertOpen, setAlertOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(() => {
    const isBergevin = project.name?.toLowerCase().includes("bergevin");
    return isBergevin && !localStorage.getItem(`disclaimer-dismissed-${project.id}`);
  });

  const updateProject = useCallback(
    (updater: any) => {
      setDb((prev: any) => {
        const updated = {
          ...prev,
          projects: prev.projects.map((p: any) => (p.id === project.id ? updater(p) : p)),
        };
        saveDB(updated);
        return updated;
      });
    },
    [project.id, setDb]
  );

  // Supabase sync helpers — fire-and-forget, localStorage is always saved first
  const supaSync = useMemo(() => ({
    updateFields: (fields: any) =>
      dataLayer.updateProjectFields(project.id, fields).catch(console.error),
    setTrackingCell: (trackType: string, rowKey: string, entityId: string, status: string) =>
      dataLayer.setTrackingCell(project.id, trackType, rowKey, entityId, status).catch(console.error),
    setTrackingMeta: (trackType: string, rowKey: string, meta: any) =>
      dataLayer.setTrackingMeta(project.id, trackType, rowKey, meta).catch(console.error),
    syncBatiments: (batiments: any) =>
      dataLayer.syncBatiments(project.id, batiments).catch(console.error),
    syncLots: (lots: any) =>
      dataLayer.syncLots(project.id, lots).catch(console.error),
    syncLotsDecomp: (lotsInt: any, lotsExt: any) =>
      dataLayer.syncLotsDecomp(project.id, lotsInt, lotsExt).catch(console.error),
    fullSync: (p: any) =>
      dataLayer.fullProjectSync(p, userId).catch(console.error),
  }), [project.id, userId]);

  const currentProject = db.projects.find((p: any) => p.id === project.id) || project;

  const globalProgress = useMemo(() => computeProjectProgress(currentProject), [currentProject]);

  const alertCounts = useMemo(() => countAlerts(currentProject), [currentProject]);

  const tabs = useMemo(() => [
    { key: "setup", label: "Configuration", icon: "settings" },
    { key: "batiments-config", label: "Bâtiments", icon: "building" },
    { key: "lots", label: "Lots", icon: "folder" },
    { key: "logements", label: "Suivi INT", icon: "home" },
    { key: "batiments", label: "Suivi EXT", icon: "building" },
    { key: "recap", label: "Récap", icon: "chart" },
    { key: "recap-av", label: "Récap Av.", icon: "chart" },
    { key: "avancement", label: "Avancement", icon: "chart" },
    { key: "gantt", label: "Planning", icon: "calendar" },
    { key: "planning-logements", label: "Cibles Log.", icon: "target" },
    { key: "photos", label: "Photos", icon: "camera" },
    { key: "export", label: "Export", icon: "download" },
    { key: "dashboard", label: "Tableau de bord", icon: "chart" },
    { key: "help", label: "Aide", icon: "help" },
  ], []);

  // Keyboard shortcuts: digits 1-9 switch tabs, 0 for 10th tab
  useEffect(() => {
    const tabKeys = tabs.map((t) => t.key);
    const handleKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      const digit = parseInt(e.key);
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        const idx = digit - 1;
        if (idx < tabKeys.length) setActiveTab(tabKeys[idx]);
      }
      if (e.key === "0" && tabKeys.length >= 10) setActiveTab(tabKeys[9]);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [tabs]);

  return (
    <div className="app-shell">
      <header className="project-header">
        <Button variant="ghost" icon="back" onClick={onBack} size="sm">
          Projets
        </Button>
        <div className="project-info">
          <h2>
            {currentProject.name}
            {currentProject.location && (
              <span style={{ fontWeight: 400, fontSize: "0.6em", color: "var(--text-secondary)", marginLeft: 12 }}>
                {currentProject.location}
                {currentProject.client ? ` · ${currentProject.client}` : ""}
              </span>
            )}
          </h2>
        </div>
        <div className="header-progress">
          <ProgressBar value={globalProgress} />
        </div>
        <button
          className="alert-bell-btn"
          onClick={() => setAlertOpen(true)}
          title={`${alertCounts.total} alerte(s)`}
          aria-label={`${alertCounts.total} alertes`}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {alertCounts.total > 0 && (
            <span className="alert-bell-badge">{alertCounts.total}</span>
          )}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SyncStatusBadge />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {mode === "supabase" && (
            <span className="connection-badge connected" title="Connecté à Supabase">cloud</span>
          )}
          {mode === "local" && (
            <span className="connection-badge local" title="Mode local (localStorage)">local</span>
          )}
        </div>
      </header>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="tab-content" key={activeTab} role="tabpanel">
        {activeTab === "setup" && <SetupTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "batiments-config" && <BatimentsTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "lots" && <LotsTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "logements" && <TrackingGrid project={currentProject} updateProject={updateProject} supaSync={supaSync} type="logements" />}
        {activeTab === "batiments" && <TrackingGrid project={currentProject} updateProject={updateProject} supaSync={supaSync} type="batiments" />}
        <Suspense fallback={<TabLoader />}>
          {activeTab === "dashboard" && <DashboardTab project={currentProject} />}
          {activeTab === "recap" && <RecapTab project={currentProject} />}
          {activeTab === "recap-av" && <RecapAvancementTab project={currentProject} />}
          {activeTab === "avancement" && <AvancementTab project={currentProject} />}
          {activeTab === "gantt" && <GanttTab project={currentProject} />}
          {activeTab === "planning-logements" && <PlanningTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
          {activeTab === "photos" && <PhotosTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
          {activeTab === "export" && <ExportTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
          {activeTab === "help" && <HelpTab />}
        </Suspense>
      </div>

      <AlertPanel project={currentProject} open={alertOpen} onClose={() => setAlertOpen(false)} />

      <Modal open={disclaimerOpen} onClose={() => {
        localStorage.setItem(`disclaimer-dismissed-${project.id}`, "1");
        setDisclaimerOpen(false);
      }} title="Avertissement" width={480}>
        <div style={{ padding: "16px 20px", lineHeight: 1.6, color: "var(--text-secondary)" }}>
          <p style={{ margin: "0 0 12px" }}>
            <strong style={{ color: "var(--text-primary)" }}>Des écarts peuvent exister</strong> entre le fichier Excel d'origine et les calculs effectués dans cette application.
          </p>
          <p style={{ margin: "0 0 16px" }}>
            Il est recommandé de <strong style={{ color: "var(--text-primary)" }}>vérifier les données et les calculs</strong> avant de les utiliser comme référence officielle.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={() => {
              localStorage.setItem(`disclaimer-dismissed-${project.id}`, "1");
              setDisclaimerOpen(false);
            }}>
              J'ai compris
            </Button>
          </div>
        </div>
      </Modal>

      <QuickEntry
        project={currentProject}
        updateProject={updateProject}
        supaSync={supaSync}
      />
    </div>
  );
}
