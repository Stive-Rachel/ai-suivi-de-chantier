import { useMemo } from "react";
import Icon from "./Icon";
import { getLogementNums } from "../../lib/db";

/**
 * AlertPanel — slide-over panel affichant toutes les cellules ! et NOK.
 * Props: project, open, onClose
 */
export default function AlertPanel({ project, open, onClose }) {
  const alerts = useMemo(() => {
    if (!project) return [];
    const result = [];

    const scanTracking = (trackType, lotsSource) => {
      const trackingData = project.tracking?.[trackType] || {};
      const isInt = trackType === "logements";
      const typeLabel = isInt ? "INT" : "EXT";

      for (const lot of lotsSource) {
        for (const decomp of lot.decompositions) {
          const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
          const rowData = trackingData[key];
          if (!rowData) continue;

          // Get entities
          const entities = isInt
            ? project.batiments.flatMap((bat) =>
                getLogementNums(bat).map((num) => ({
                  id: `${bat.id}_log_${num}`,
                  label: `Log ${num}`,
                  batName: bat.name,
                }))
              )
            : project.batiments.map((bat) => ({
                id: bat.id,
                label: bat.name,
                batName: bat.name,
              }));

          for (const entity of entities) {
            const cellData = rowData[entity.id];
            if (cellData && (cellData.status === "!" || cellData.status === "NOK")) {
              result.push({
                id: `${key}_${entity.id}`,
                status: cellData.status,
                type: typeLabel,
                batiment: entity.batName,
                entity: entity.label,
                lot: `${lot.numero} - ${lot.nom}`,
                decomposition: decomp,
                lotNumero: lot.numero,
              });
            }
          }
        }
      }
    };

    scanTracking("logements", project.lotsInt || []);
    scanTracking("batiments", project.lotsExt || []);

    // Sort: NOK first, then !, then by lot number
    result.sort((a, b) => {
      if (a.status !== b.status) return a.status === "NOK" ? -1 : 1;
      const na = parseFloat(a.lotNumero) || 0;
      const nb = parseFloat(b.lotNumero) || 0;
      return na - nb;
    });

    return result;
  }, [project]);

  const nokCount = alerts.filter((a) => a.status === "NOK").length;
  const alertCount = alerts.filter((a) => a.status === "!").length;

  if (!open) return null;

  return (
    <div className="alert-panel-overlay" onClick={onClose}>
      <div
        className="alert-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="alert-panel-header">
          <div>
            <h3>Alertes du chantier</h3>
            <p className="alert-panel-subtitle">
              {alerts.length === 0
                ? "Aucune alerte"
                : `${alerts.length} alerte(s) \u2014 ${nokCount} NOK, ${alertCount} Attention`}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Summary badges */}
        {alerts.length > 0 && (
          <div className="alert-panel-summary">
            {nokCount > 0 && (
              <span className="alert-summary-badge alert-summary-nok">
                {nokCount} NOK
              </span>
            )}
            {alertCount > 0 && (
              <span className="alert-summary-badge alert-summary-warn">
                {alertCount} Attention
              </span>
            )}
          </div>
        )}

        {/* Alert list */}
        <div className="alert-panel-list">
          {alerts.length === 0 ? (
            <div className="alert-panel-empty">
              <div className="alert-panel-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p>Aucune alerte. Tout est en ordre.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item ${alert.status === "NOK" ? "alert-item-nok" : "alert-item-warn"}`}
              >
                <div className="alert-item-badge">
                  {alert.status === "NOK" ? (
                    <span className="status-cell status-nok" style={{ width: 28, height: 24, fontSize: 9 }}>
                      NOK
                    </span>
                  ) : (
                    <span className="status-cell status-alert" style={{ width: 28, height: 24, fontSize: 12 }}>
                      !
                    </span>
                  )}
                </div>
                <div className="alert-item-content">
                  <div className="alert-item-title">
                    <span className="alert-item-type">[{alert.type}]</span>
                    {alert.entity}
                    <span className="alert-item-bat">{alert.batiment}</span>
                  </div>
                  <div className="alert-item-detail">
                    {alert.lot} &rsaquo; {alert.decomposition}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compte les alertes pour le badge dans le header.
 */
export function countAlerts(project) {
  if (!project?.tracking) return { total: 0, nok: 0, warn: 0 };

  let nok = 0;
  let warn = 0;

  const scan = (trackType, lotsSource) => {
    const trackingData = project.tracking?.[trackType] || {};
    for (const lot of lotsSource) {
      for (const decomp of lot.decompositions) {
        const key = `${lot.trackPrefix || lot.numero}-${decomp}`;
        const rowData = trackingData[key];
        if (!rowData) continue;
        for (const [k, v] of Object.entries(rowData)) {
          if (k.startsWith("_")) continue;
          if (v?.status === "NOK") nok++;
          else if (v?.status === "!") warn++;
        }
      }
    }
  };

  scan("logements", project.lotsInt || []);
  scan("batiments", project.lotsExt || []);

  return { total: nok + warn, nok, warn };
}
