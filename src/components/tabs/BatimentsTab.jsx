import { useState } from "react";
import { generateId } from "../../lib/db";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";

export default function BatimentsTab({ project, updateProject, supaSync }) {
  const [showAddBat, setShowAddBat] = useState(false);
  const [batName, setBatName] = useState("");
  const [batLogements, setBatLogements] = useState("10");

  const getNextBatName = () => {
    if (project.batiments.length === 0) return "Bâtiment 1";
    const lastName = project.batiments[project.batiments.length - 1].name;
    const match = lastName.match(/^(.+?)(\d+)(bis|ter|quat)?$/i);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2]);
      return `${prefix}${num + 1}`;
    }
    return `${lastName} +1`;
  };

  const openAddBat = () => {
    setBatName(getNextBatName());
    setShowAddBat(true);
  };

  const addBatiment = () => {
    if (!batName.trim()) return;
    const newBat = { id: generateId(), name: batName.trim(), nbLogements: parseInt(batLogements) || 1 };
    updateProject((p) => {
      const updated = { ...p, batiments: [...p.batiments, newBat] };
      supaSync?.syncBatiments(updated.batiments);
      return updated;
    });
    setBatName("");
    setBatLogements("10");
    setShowAddBat(false);
  };

  const removeBatiment = (id) => {
    if (!confirm("Supprimer ce bâtiment ? Les données de suivi associées seront perdues."))
      return;
    updateProject((p) => {
      const updated = { ...p, batiments: p.batiments.filter((b) => b.id !== id) };
      supaSync?.syncBatiments(updated.batiments);
      return updated;
    });
  };

  const updateBatiment = (id, field, value) => {
    updateProject((p) => {
      const updated = { ...p, batiments: p.batiments.map((b) => (b.id === id ? { ...b, [field]: value } : b)) };
      supaSync?.syncBatiments(updated.batiments);
      return updated;
    });
  };

  const totalLogements = project.batiments.reduce((s, b) => s + (b.nbLogements || 0), 0);

  return (
    <div className="setup-content-wide" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Bâtiments & Logements</h3>
            <p>
              {project.batiments.length} bâtiment(s) &bull; {totalLogements} logement(s)
            </p>
          </div>
          <Button icon="plus" size="sm" onClick={openAddBat}>
            Ajouter
          </Button>
        </div>

        {project.batiments.length === 0 ? (
          <div className="empty-placeholder">Ajoutez des bâtiments pour commencer</div>
        ) : (
          <div className="config-table-wrap">
            <table className="config-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Nom du Bâtiment</th>
                  <th style={{ width: 150, textAlign: "center" }}>Nombre de Logements</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {project.batiments.map((b, idx) => (
                  <tr key={b.id}>
                    <td className="cell-center cell-mono">{idx + 1}</td>
                    <td>
                      <input
                        className="inline-edit"
                        value={b.name}
                        onChange={(e) => updateBatiment(b.id, "name", e.target.value)}
                      />
                    </td>
                    <td className="cell-center">
                      <input
                        className="inline-edit inline-edit-num"
                        type="number"
                        min="1"
                        value={b.nbLogements}
                        onChange={(e) => updateBatiment(b.id, "nbLogements", parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td className="cell-center">
                      <button className="delete-btn" style={{ opacity: 1 }} onClick={() => removeBatiment(b.id)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td className="cell-bold">Total</td>
                  <td className="cell-center cell-bold cell-mono">{totalLogements}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAddBat} onClose={() => setShowAddBat(false)} title="Ajouter un bâtiment">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Nom du bâtiment" value={batName} onChange={setBatName} placeholder="Ex: Bâtiment A" />
          <Input label="Nombre de logements" value={batLogements} onChange={setBatLogements} type="number" placeholder="10" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowAddBat(false)}>Annuler</Button>
            <Button onClick={addBatiment} disabled={!batName.trim()}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
