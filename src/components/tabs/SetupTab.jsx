import MoneyInput from "../ui/MoneyInput";

export default function SetupTab({ project, updateProject }) {
  const updateField = (field, value) => {
    updateProject((p) => ({ ...p, [field]: value }));
  };

  const totalLogements = project.batiments.reduce((s, b) => s + (b.nbLogements || 0), 0);

  return (
    <div className="setup-content-wide" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Paramètres du projet</h3>
            <p>Informations générales, montants et durées</p>
          </div>
        </div>
        <div className="params-grid">
          <div className="param-field">
            <label>Nom du chantier</label>
            <input className="input-field" value={project.name || ""} onChange={(e) => updateField("name", e.target.value)} />
          </div>
          <div className="param-field">
            <label>Localisation</label>
            <input className="input-field" value={project.location || ""} onChange={(e) => updateField("location", e.target.value)} />
          </div>
          <div className="param-field">
            <label>Client / Maître d'ouvrage</label>
            <input className="input-field" value={project.client || ""} onChange={(e) => updateField("client", e.target.value)} />
          </div>
          <div className="param-field">
            <label>Montant des travaux (€)</label>
            <MoneyInput variant="field" value={project.montantTotal} onChange={(v) => updateField("montantTotal", v)} />
          </div>
          <div className="param-field">
            <label>Date de début de chantier</label>
            <input className="input-field" type="date" value={project.dateDebutChantier || ""} onChange={(e) => updateField("dateDebutChantier", e.target.value)} />
          </div>
          <div className="param-field">
            <label>Durée totale (mois)</label>
            <input className="input-field" type="number" min="0" value={project.dureeTotale || ""} onChange={(e) => updateField("dureeTotale", parseInt(e.target.value) || 0)} />
          </div>
          <div className="param-field">
            <label>Montant travaux extérieurs (€)</label>
            <MoneyInput variant="field" value={project.montantExt} onChange={(v) => updateField("montantExt", v)} />
          </div>
          <div className="param-field">
            <label>Montant travaux intérieurs (€)</label>
            <MoneyInput variant="field" value={project.montantInt} onChange={(v) => updateField("montantInt", v)} />
          </div>
          <div className="param-field">
            <label>Durée travaux extérieurs (mois)</label>
            <input className="input-field" type="number" min="0" value={project.dureeExt || ""} onChange={(e) => updateField("dureeExt", parseInt(e.target.value) || 0)} />
          </div>
          <div className="param-field">
            <label>Durée travaux intérieurs (mois)</label>
            <input className="input-field" type="number" min="0" value={project.dureeInt || ""} onChange={(e) => updateField("dureeInt", parseInt(e.target.value) || 0)} />
          </div>
          <div className="param-field">
            <label>Nombre de bâtiments</label>
            <input className="input-field" type="number" readOnly value={project.batiments.length} />
          </div>
          <div className="param-field">
            <label>Nombre de logements</label>
            <input className="input-field" type="number" readOnly value={totalLogements} />
          </div>
          <div className="param-field">
            <label>Semaines exclues</label>
            <input className="input-field" type="number" min="0" value={project.semainesExclues || ""} onChange={(e) => updateField("semainesExclues", parseInt(e.target.value) || 0)} />
          </div>
          <div className="param-field">
            <label>Semaines travaillées</label>
            <input className="input-field" type="number" min="0" value={project.semainesTravaillees || ""} onChange={(e) => updateField("semainesTravaillees", parseInt(e.target.value) || 0)} />
          </div>
          <div className="param-field">
            <label>Date début travaux intérieurs</label>
            <input className="input-field" type="date" value={project.dateDebutInt || ""} onChange={(e) => updateField("dateDebutInt", e.target.value)} />
          </div>
          <div className="param-field">
            <label>Date début travaux extérieurs</label>
            <input className="input-field" type="date" value={project.dateDebutExt || ""} onChange={(e) => updateField("dateDebutExt", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
