import { useState, useMemo } from "react";
import { generateId, saveDB, migrateProject, getLogementNums } from "../lib/db";
import { DEFAULT_LOTS, DEFAULT_LOTS_INT, DEFAULT_LOTS_EXT } from "../lib/constants";
import { computeProjectProgress, computeDetailedProgress } from "../lib/computations";
import { formatMontant } from "../lib/format";
import * as dataLayer from "../lib/dataLayer";
import initialData from "../initialData.json";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import ProgressBar from "./ui/ProgressBar";

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ color: color || "var(--accent)" }}>
        <Icon name={icon} size={22} />
      </div>
      <div className="kpi-body">
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">{label}</span>
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

function ProjectKpis({ project }) {
  const { lotProgressInt, lotProgressExt } = useMemo(
    () => computeDetailedProgress(project),
    [project]
  );

  const nbBat = project.batiments.length;
  const nbLog = project.batiments.reduce((s, b) => s + getLogementNums(b).length, 0);

  // Count alerts and NOK
  const trackStats = useMemo(() => {
    let alerts = 0, noks = 0;
    for (const trackType of ["logements", "batiments"]) {
      const t = project.tracking?.[trackType] || {};
      for (const rowKey of Object.keys(t)) {
        if (rowKey.startsWith("_")) continue;
        for (const [entityId, cell] of Object.entries(t[rowKey])) {
          if (entityId.startsWith("_")) continue;
          if (cell?.status === "!") alerts++;
          if (cell?.status === "NOK") noks++;
        }
      }
    }
    return { alerts, noks };
  }, [project.tracking]);

  const avgInt = lotProgressInt.length > 0
    ? lotProgressInt.reduce((s, lp) => s + lp.progress, 0) / lotProgressInt.length
    : 0;
  const avgExt = lotProgressExt.length > 0
    ? lotProgressExt.reduce((s, lp) => s + lp.progress, 0) / lotProgressExt.length
    : 0;

  // Find lot with lowest progress
  const allLotProgress = [...lotProgressInt, ...lotProgressExt].filter((lp) => lp.progress < 100);
  const lowestLot = allLotProgress.length > 0
    ? allLotProgress.reduce((min, lp) => (lp.progress < min.progress ? lp : min))
    : null;

  return (
    <div className="project-kpis-detail">
      <div className="project-kpis-row">
        <div className="project-kpi-mini">
          <span className="kpi-mini-label">INT</span>
          <ProgressBar value={avgInt} height={5} />
        </div>
        <div className="project-kpi-mini">
          <span className="kpi-mini-label">EXT</span>
          <ProgressBar value={avgExt} height={5} />
        </div>
      </div>
      <div className="project-kpis-stats">
        <span><Icon name="building" size={12} /> {nbBat} bât.</span>
        <span><Icon name="home" size={12} /> {nbLog} log.</span>
        {trackStats.alerts > 0 && (
          <span className="kpi-alert-badge">! {trackStats.alerts}</span>
        )}
        {trackStats.noks > 0 && (
          <span className="kpi-nok-badge">NOK {trackStats.noks}</span>
        )}
      </div>
      {lowestLot && (
        <div className="project-kpi-lowest">
          Retard : {lowestLot.shortLot || lowestLot.lot} ({lowestLot.progress.toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ db, setDb, mode, userId, onOpenProject }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newClient, setNewClient] = useState("");

  const createProject = () => {
    if (!newName.trim()) return;
    const project = {
      id: generateId(),
      name: newName.trim(),
      location: newLocation.trim(),
      client: newClient.trim(),
      createdAt: new Date().toISOString(),
      montantTotal: 0,
      dateDebutChantier: "",
      dureeTotale: 0,
      montantExt: 0,
      montantInt: 0,
      dureeExt: 0,
      dureeInt: 0,
      dateDebutInt: "",
      dateDebutExt: "",
      semainesExclues: 0,
      semainesTravaillees: 0,
      batiments: [],
      lots: JSON.parse(JSON.stringify(DEFAULT_LOTS)),
      lotsInt: JSON.parse(JSON.stringify(DEFAULT_LOTS_INT)),
      lotsExt: JSON.parse(JSON.stringify(DEFAULT_LOTS_EXT)),
      tracking: { logements: {}, batiments: {} },
    };
    const updated = { ...db, projects: [...db.projects, project] };
    setDb(updated);
    saveDB(updated);
    dataLayer.createProjectInDB(project, userId).catch(console.error);
    setShowCreate(false);
    setNewName("");
    setNewLocation("");
    setNewClient("");
  };

  const deleteProject = (id) => {
    if (!confirm("Supprimer ce projet et toutes ses données ?")) return;
    const updated = { ...db, projects: db.projects.filter((p) => p.id !== id) };
    setDb(updated);
    saveDB(updated);
    dataLayer.deleteProjectFromDB(id).catch(console.error);
  };

  const loadDemo = () => {
    const seedProjects = JSON.parse(JSON.stringify(initialData.projects)).map(migrateProject);
    const existingIds = new Set(db.projects.map((p) => p.id));
    const hasExisting = seedProjects.some((p) => existingIds.has(p.id));
    if (hasExisting) {
      if (!confirm("Le projet de démo existe déjà. Voulez-vous le remplacer avec les données d'origine ?")) return;
      const otherProjects = db.projects.filter((p) => !seedProjects.some((s) => s.id === p.id));
      const updated = { ...db, projects: [...otherProjects, ...seedProjects] };
      setDb(updated);
      saveDB(updated);
      // Sync each seed project to Supabase
      for (const sp of seedProjects) {
        dataLayer.fullProjectSync(sp, userId).catch(console.error);
      }
    } else {
      const updated = { ...db, projects: [...db.projects, ...seedProjects] };
      setDb(updated);
      saveDB(updated);
      for (const sp of seedProjects) {
        dataLayer.createProjectInDB(sp, userId).catch(console.error);
      }
    }
  };

  // Global KPIs across all projects
  const globalKpis = useMemo(() => {
    const projects = db.projects;
    const nbProjects = projects.length;
    const nbBatTotal = projects.reduce((s, p) => s + p.batiments.length, 0);
    const nbLogTotal = projects.reduce((s, p) => s + p.batiments.reduce((sb, b) => sb + getLogementNums(b).length, 0), 0);
    const montantTotal = projects.reduce((s, p) => {
      const lotsMontant = (p.lots || []).reduce((sl, l) => sl + (l.montantMarche || 0), 0);
      return s + (lotsMontant || p.montantTotal || 0);
    }, 0);

    let totalAlerts = 0, totalNoks = 0, totalDone = 0, totalCells = 0;
    const projectProgresses = [];

    for (const p of projects) {
      const prog = computeProjectProgress(p);
      projectProgresses.push(prog);

      for (const trackType of ["logements", "batiments"]) {
        const t = p.tracking?.[trackType] || {};
        for (const rowKey of Object.keys(t)) {
          if (rowKey.startsWith("_")) continue;
          for (const [entityId, cell] of Object.entries(t[rowKey])) {
            if (entityId.startsWith("_")) continue;
            totalCells++;
            if (cell?.status === "X") totalDone++;
            if (cell?.status === "!") totalAlerts++;
            if (cell?.status === "NOK") totalNoks++;
          }
        }
      }
    }

    const avgProgress = projectProgresses.length > 0
      ? projectProgresses.reduce((s, v) => s + v, 0) / projectProgresses.length
      : 0;

    return { nbProjects, nbBatTotal, nbLogTotal, montantTotal, avgProgress, totalAlerts, totalNoks, totalDone, totalCells };
  }, [db.projects]);

  const hasProjects = db.projects.length > 0;

  return (
    <div className="app-shell">
      <header className="header">
        <div className="logo">
          <div className="logo-mark">SC</div>
          <div className="logo-text">
            <h1>Suivi Chantier</h1>
            <p>Gestion d'avancement multi-projets</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={loadDemo}>
            Charger démo
          </Button>
          <Button icon="plus" onClick={() => setShowCreate(true)}>
            Nouveau projet
          </Button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* KPI Summary Bar */}
        {hasProjects && (
          <div className="kpi-grid" style={{ animation: "slideInUp 0.3s ease both" }}>
            <KpiCard
              icon="folder"
              label="Projets"
              value={globalKpis.nbProjects}
              color="var(--accent)"
            />
            <KpiCard
              icon="building"
              label="Bâtiments"
              value={globalKpis.nbBatTotal}
              sub={`${globalKpis.nbLogTotal} logements`}
              color="var(--info)"
            />
            <KpiCard
              icon="chart"
              label="Avancement moyen"
              value={`${globalKpis.avgProgress.toFixed(1)}%`}
              sub={`${globalKpis.totalDone} / ${globalKpis.totalCells} cellules`}
              color={globalKpis.avgProgress >= 50 ? "var(--success)" : "var(--warning)"}
            />
            <KpiCard
              icon="settings"
              label="Montant total"
              value={formatMontant(globalKpis.montantTotal)}
              color="var(--text-secondary)"
            />
            {(globalKpis.totalAlerts > 0 || globalKpis.totalNoks > 0) && (
              <KpiCard
                icon="filter"
                label="Alertes"
                value={globalKpis.totalAlerts + globalKpis.totalNoks}
                sub={`${globalKpis.totalAlerts} alertes, ${globalKpis.totalNoks} NOK`}
                color="var(--danger)"
              />
            )}
          </div>
        )}

        {/* Project Cards */}
        {db.projects.length === 0 ? (
          <div className="empty-state" style={{ animation: "slideInUp 0.5s ease both" }}>
            <div className="empty-state-icon">
              <Icon name="folder" size={32} />
            </div>
            <h3>Aucun projet pour le moment</h3>
            <p>Créez votre premier projet ou chargez les données de démo</p>
            <div style={{ display: "flex", gap: 10 }}>
              <Button icon="plus" onClick={() => setShowCreate(true)}>
                Créer un projet
              </Button>
              <Button variant="secondary" onClick={loadDemo}>
                Charger démo
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="dashboard-section-title">Mes projets</h3>
            <div className="projects-grid stagger">
              {db.projects.map((p) => {
                const avgProgress = computeProjectProgress(p);
                return (
                  <div
                    key={p.id}
                    className="card card-interactive project-card"
                    onClick={() => onOpenProject(p.id)}
                  >
                    <div className="card-body">
                      <div className="project-card-header">
                        <div>
                          <h3>{p.name}</h3>
                          <div className="project-meta">
                            {p.location && <span>{p.location}</span>}
                            {p.client && <span>{p.client}</span>}
                          </div>
                        </div>
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(p.id);
                          }}
                          title="Supprimer"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                      <ProgressBar value={avgProgress} />
                      <ProjectKpis project={p} />
                      <div className="project-date">
                        Créé le {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau projet">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input label="Nom du projet *" value={newName} onChange={setNewName} placeholder="Ex: Résidence Les Oliviers" />
          <Input label="Localisation" value={newLocation} onChange={setNewLocation} placeholder="Ex: Cotonou, Bénin" />
          <Input label="Client / Maître d'ouvrage" value={newClient} onChange={setNewClient} placeholder="Ex: MCA-Bénin" />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button onClick={createProject} disabled={!newName.trim()}>
              Créer le projet
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
