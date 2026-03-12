import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from "react";
import { saveDB } from "../lib/db";
import { computeProjectProgress } from "../lib/computations";
import * as dataLayer from "../lib/dataLayer";
import { markDirty, markClean } from "../lib/dirtyTracker";
import { useUserRole } from "../lib/useUserRole";
import { useAuth } from "./AuthProvider";
import Button from "./ui/Button";
import Tabs from "./ui/Tabs";
import ProgressBar from "./ui/ProgressBar";
import AlertPanel, { countAlerts } from "./ui/AlertPanel";
import ThemeToggle from "./ui/ThemeToggle";
import SyncStatusBadge from "./ui/SyncStatusBadge";
import SetupTab from "./tabs/SetupTab";
import BatimentsTab from "./tabs/BatimentsTab";
import LotsTab from "./tabs/LotsTab";
import TrackingGrid from "./tabs/TrackingGrid";
import QuickEntry from "./QuickEntry";
import type { Project, DB, Batiment, Lot, LotDecomp } from "../types";

const DashboardTab = lazy(() => import("./tabs/DashboardTab"));
const RecapTab = lazy(() => import("./tabs/RecapTab"));
const RecapAvancementTab = lazy(() => import("./tabs/RecapAvancementTab"));
const AvancementTab = lazy(() => import("./tabs/AvancementTab"));
const ExportTab = lazy(() => import("./tabs/ExportTab"));
const GanttTab = lazy(() => import("./tabs/GanttTab"));
const PhotosTab = lazy(() => import("./tabs/PhotosTab"));
const PlanningTab = lazy(() => import("./tabs/PlanningTab"));
const HelpTab = lazy(() => import("./tabs/HelpTab"));
const InviteUsersPanel = lazy(() => import("./InviteUsersPanel"));

function TabLoader() {
  return (
    <div className="skeleton-loader">
      <div className="skeleton-line skeleton-line-short skeleton-line-thick" />
      <div className="skeleton-line skeleton-line-long" />
      <div className="skeleton-line skeleton-line-medium" />
      <div className="skeleton-line skeleton-line-full" />
      <div className="skeleton-line skeleton-line-long" />
      <div className="skeleton-line skeleton-line-short" />
    </div>
  );
}

interface ProjectViewProps {
  project: Project;
  db: DB;
  setDb: (updater: (prev: DB) => DB) => void;
  mode: string;
  userId: string;
  onBack: () => void;
  theme: string;
  toggleTheme: () => void;
}

export default function ProjectView({ project, db, setDb, mode, userId, onBack, theme, toggleTheme }: ProjectViewProps) {
  const { isClient } = useUserRole();
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState(isClient ? "logements" : "setup");
  const [alertOpen, setAlertOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateProject = useCallback(
    (updater: (p: Project) => Project) => {
      setDb((prev: DB) => {
        const updated = {
          ...prev,
          projects: prev.projects.map((p: Project) => (p.id === project.id ? updater(p) : p)),
        };
        saveDB(updated);
        return updated;
      });
    },
    [project.id, setDb]
  );

  // Supabase sync helpers — fire-and-forget with retry, localStorage is always saved first
  const supaSync = useMemo(() => {
    const safe = (label: string, fn: () => Promise<void>) => {
      const opId = markDirty(label, project.id);
      dataLayer.withRetry(fn).then(({ ok }) => {
        if (ok) {
          markClean(opId);
        } else {
          setSaveError(`Erreur de sauvegarde (${label}). Les modifications sont conservées localement.`);
          setTimeout(() => setSaveError(null), 8000);
        }
      });
    };
    return {
      updateFields: (fields: Partial<Project>) =>
        safe("champs", () => dataLayer.updateProjectFields(project.id, fields)),
      setTrackingCell: (trackType: string, rowKey: string, entityId: string, status: string) =>
        safe("cellule", () => dataLayer.setTrackingCell(project.id, trackType, rowKey, entityId, status)),
      setTrackingMeta: (trackType: string, rowKey: string, meta: { ponderation?: number; tache?: string }) =>
        safe("meta", () => dataLayer.setTrackingMeta(project.id, trackType, rowKey, meta)),
      syncBatiments: (batiments: Batiment[]) =>
        safe("batiments", () => dataLayer.syncBatiments(project.id, batiments)),
      syncLots: (lots: Lot[]) =>
        safe("lots", () => dataLayer.syncLots(project.id, lots)),
      syncLotsDecomp: (lotsInt: LotDecomp[], lotsExt: LotDecomp[]) =>
        safe("decomp", () => dataLayer.syncLotsDecomp(project.id, lotsInt, lotsExt)),
      fullSync: (p: Project) =>
        safe("sync", () => dataLayer.fullProjectSync(p, userId)),
    };
  }, [project.id, userId]);

  const currentProject = db.projects.find((p: Project) => p.id === project.id) || project;

  const globalProgress = useMemo(() => computeProjectProgress(currentProject), [currentProject]);

  const alertCounts = useMemo(() => countAlerts(currentProject), [currentProject]);

  // Tabs hidden for clients: Configuration, Batiments, Lots
  const ADMIN_ONLY_TABS = new Set(["setup", "batiments-config", "lots", "users"]);

  const tabs = useMemo(() => {
    const allTabs = [
      // Groupe: Configuration
      { key: "setup", label: "Configuration", icon: "settings", group: "config" },
      { key: "batiments-config", label: "Bâtiments", icon: "building", group: "config" },
      { key: "lots", label: "Lots", icon: "folder", group: "config" },
      // Groupe: Suivi
      { key: "logements", label: "Suivi INT", icon: "home", group: "suivi" },
      { key: "batiments", label: "Suivi EXT", icon: "building", group: "suivi" },
      // Groupe: Analyse
      { key: "recap", label: "Récap", icon: "chart", group: "analyse" },
      { key: "recap-av", label: "Récap Av.", icon: "chart", group: "analyse" },
      { key: "avancement", label: "Avancement", icon: "chart", group: "analyse" },
      { key: "dashboard", label: "Tableau de bord", icon: "chart", group: "analyse" },
      // Groupe: Planning
      { key: "gantt", label: "Planning", icon: "calendar", group: "planning" },
      { key: "planning-logements", label: "Cibles Log.", icon: "target", group: "planning" },
      // Groupe: Outils
      { key: "photos", label: "Photos", icon: "camera", group: "outils" },
      { key: "export", label: "Export", icon: "download", group: "outils" },
      { key: "users", label: "Utilisateurs", icon: "settings", group: "outils" },
      { key: "help", label: "Aide", icon: "help", group: "outils" },
    ];
    if (isClient) {
      return allTabs.filter((t) => !ADMIN_ONLY_TABS.has(t.key));
    }
    return allTabs;
  }, [isClient]);

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
          <Button variant="ghost" size="sm" onClick={signOut}>
            Déconnexion
          </Button>
        </div>
      </header>

      {saveError && (
        <div role="alert" style={{
          background: "var(--warning, #f59e0b)",
          color: "#000",
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 500,
          textAlign: "center",
          cursor: "pointer",
        }} onClick={() => setSaveError(null)}>
          {saveError}
        </div>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <main className="tab-content" key={activeTab} role="tabpanel">
        {activeTab === "setup" && <SetupTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "batiments-config" && <BatimentsTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "lots" && <LotsTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
        {activeTab === "logements" && <TrackingGrid project={currentProject} updateProject={updateProject} supaSync={supaSync} type="logements" readOnly={isClient} />}
        {activeTab === "batiments" && <TrackingGrid project={currentProject} updateProject={updateProject} supaSync={supaSync} type="batiments" readOnly={isClient} />}
        <Suspense fallback={<TabLoader />}>
          {activeTab === "dashboard" && <DashboardTab project={currentProject} />}
          {activeTab === "recap" && <RecapTab project={currentProject} />}
          {activeTab === "recap-av" && <RecapAvancementTab project={currentProject} />}
          {activeTab === "avancement" && <AvancementTab project={currentProject} />}
          {activeTab === "gantt" && <GanttTab project={currentProject} />}
          {activeTab === "planning-logements" && <PlanningTab project={currentProject} updateProject={updateProject} supaSync={supaSync} readOnly={isClient} />}
          {activeTab === "photos" && <PhotosTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
          {activeTab === "export" && <ExportTab project={currentProject} updateProject={updateProject} supaSync={supaSync} />}
          {activeTab === "users" && <InviteUsersPanel projects={db.projects} />}
          {activeTab === "help" && <HelpTab />}
        </Suspense>
      </main>

      <AlertPanel project={currentProject} open={alertOpen} onClose={() => setAlertOpen(false)} />

      {!isClient && (
        <QuickEntry
          project={currentProject}
          updateProject={updateProject}
          supaSync={supaSync}
        />
      )}
    </div>
  );
}
