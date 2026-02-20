import { useState } from "react";
import { generateId, saveDB, migrateProject } from "../lib/db";
import { DEFAULT_LOTS, DEFAULT_LOTS_INT, DEFAULT_LOTS_EXT } from "../lib/constants";
import { computeProjectProgress } from "../lib/computations";
import initialData from "../initialData.json";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import ProgressBar from "./ui/ProgressBar";

export default function Dashboard({ db, setDb, onOpenProject }) {
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
    } else {
      const updated = { ...db, projects: [...db.projects, ...seedProjects] };
      setDb(updated);
      saveDB(updated);
    }
  };

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
        {db.projects.length === 0 ? (
          <div className="empty-state" style={{ animation: "slideInUp 0.5s ease both" }}>
            <div className="empty-state-icon">
              <Icon name="folder" size={32} />
            </div>
            <h3>Aucun projet pour le moment</h3>
            <p>Créez votre premier projet pour commencer le suivi</p>
            <Button icon="plus" onClick={() => setShowCreate(true)}>
              Créer un projet
            </Button>
          </div>
        ) : (
          <div className="projects-grid stagger">
            {db.projects.map((p) => {
              const nbBat = p.batiments.length;
              const nbLog = p.batiments.reduce((s, b) => s + (b.nbLogements || 0), 0);
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
                    <div className="project-stats">
                      <span>
                        <Icon name="building" size={13} /> {nbBat} bât.
                      </span>
                      <span>
                        <Icon name="home" size={13} /> {nbLog} log.
                      </span>
                    </div>
                    <ProgressBar value={avgProgress} />
                    <div className="project-date">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR", {
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
