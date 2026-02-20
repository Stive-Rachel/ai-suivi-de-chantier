import { getLogementNums } from "../../lib/db";
import ExportButton from "../ui/ExportButton";

export default function ExportTab({ project, updateProject }) {
  const exportCSV = (csvType) => {
    const isLogements = csvType === "logements";
    const lots = isLogements ? project.lotsInt : project.lotsExt;
    const trackingData = project.tracking?.[csvType] || {};
    const entities = [];

    if (isLogements) {
      for (const bat of project.batiments) {
        for (const num of getLogementNums(bat)) {
          entities.push({ id: `${bat.id}_log_${num}`, label: `Log ${num} - ${bat.name}` });
        }
      }
    } else {
      project.batiments.forEach((b) => entities.push({ id: b.id, label: b.name }));
    }

    const headers = ["Lot", "Décomposition", "Tâche", "Pondération", ...entities.map((e) => e.label)];
    const csvRows = [];

    for (const lot of lots) {
      for (const decomp of lot.decompositions) {
        const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
        const row = [
          `${lot.numero} - ${lot.nom}`,
          decomp,
          trackingData[key]?._tache || "",
          trackingData[key]?._ponderation || 1,
          ...entities.map((e) => trackingData[key]?.[e.id]?.status || ""),
        ];
        csvRows.push(row);
      }
    }

    const csv = [headers, ...csvRows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_${csvType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.name && data.batiments) {
          if (confirm(`Importer "${data.name}" ? Les données actuelles du projet seront remplacées.`)) {
            updateProject((p) => ({
              ...p,
              ...data,
              id: p.id,
              createdAt: p.createdAt,
            }));
          }
        } else {
          alert("Le fichier ne contient pas de données de projet valides.");
        }
      } catch {
        alert("Fichier JSON invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="export-content" style={{ animation: "slideInUp 0.4s ease both" }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Exporter les données</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="export-grid">
          <ExportButton label="Logements (CSV)" desc="Export suivi intérieur" onClick={() => exportCSV("logements")} />
          <ExportButton label="Bâtiments (CSV)" desc="Export suivi extérieur" onClick={() => exportCSV("batiments")} />
        </div>
        <ExportButton label="Backup complet (JSON)" desc="Sauvegarde du projet entier" onClick={exportJSON} />
        <div className="import-section">
          <h4>Importer un projet</h4>
          <input
            type="file"
            accept=".json"
            onChange={importJSON}
            style={{ fontSize: 12, color: "var(--text-secondary)" }}
          />
        </div>
      </div>
    </div>
  );
}
