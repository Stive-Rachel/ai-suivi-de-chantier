import { useState, useMemo, useCallback } from "react";
import { getLogementNums } from "../lib/db";
import Icon from "./ui/Icon";

/**
 * QuickEntry — mobile step-by-step status entry.
 * Visible only on mobile as a FAB. Opens a full-screen overlay.
 */
export default function QuickEntry({ project, updateProject, supaSync }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0=type, 1=batiment, 2=lot, 3=decomp, 4=entity, 5=status
  const [trackType, setTrackType] = useState(null); // "logements" | "batiments"
  const [selectedBat, setSelectedBat] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedDecomp, setSelectedDecomp] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const lots = useMemo(() => {
    if (!trackType) return [];
    return trackType === "logements" ? (project.lotsInt || []) : (project.lotsExt || []);
  }, [trackType, project.lotsInt, project.lotsExt]);

  const entities = useMemo(() => {
    if (!trackType || !selectedBat) return [];
    if (trackType === "logements") {
      return getLogementNums(selectedBat).map((num) => ({
        id: `${selectedBat.id}_log_${num}`,
        label: `Logement ${num}`,
      }));
    }
    // For batiments tracking, entities are the batiments themselves
    return project.batiments.map((b) => ({ id: b.id, label: b.name }));
  }, [trackType, selectedBat, project.batiments]);

  const decompositions = useMemo(() => {
    if (!selectedLot) return [];
    return selectedLot.decompositions || [];
  }, [selectedLot]);

  const reset = useCallback(() => {
    setStep(0);
    setTrackType(null);
    setSelectedBat(null);
    setSelectedLot(null);
    setSelectedDecomp(null);
    setSelectedEntity(null);
    setConfirmation(null);
  }, []);

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleSelectType = (type) => {
    setTrackType(type);
    if (type === "batiments") {
      // Skip batiment selection for EXT — go directly to lot
      setStep(2);
    } else {
      setStep(1);
    }
  };

  const handleSelectBat = (bat) => {
    setSelectedBat(bat);
    setStep(2);
  };

  const handleSelectLot = (lot) => {
    setSelectedLot(lot);
    setStep(3);
  };

  const handleSelectDecomp = (decomp) => {
    setSelectedDecomp(decomp);
    if (trackType === "batiments") {
      // For EXT, go to entity selection (which batiment)
      setStep(4);
    } else {
      // For INT, go to entity selection (which logement)
      setStep(4);
    }
  };

  const handleSelectEntity = (entity) => {
    setSelectedEntity(entity);
    setStep(5);
  };

  const handleSetStatus = (status) => {
    if (!selectedLot || !selectedDecomp || !selectedEntity) return;

    const rowKey = `${selectedLot.trackPrefix || selectedLot.numero}-${selectedDecomp}`;
    const entityId = selectedEntity.id;

    updateProject((p) => {
      const t = { ...p.tracking };
      const type = trackType;
      if (!t[type]) t[type] = {};
      if (!t[type][rowKey]) t[type][rowKey] = {};
      t[type][rowKey] = { ...t[type][rowKey], [entityId]: { status } };
      return { ...p, tracking: t };
    });

    supaSync?.setTrackingCell(trackType, rowKey, entityId, status);

    setConfirmation(
      status
        ? `${selectedEntity.label} : ${status}`
        : `${selectedEntity.label} : effac\u00e9`
    );

    // Auto-advance back to entity selection after a short delay
    setTimeout(() => {
      setConfirmation(null);
      setStep(4); // go back to entity selection for quick multiple entries
      setSelectedEntity(null);
    }, 800);
  };

  const goBack = () => {
    if (step === 0) { handleClose(); return; }
    if (step === 1) { setTrackType(null); setStep(0); return; }
    if (step === 2) {
      if (trackType === "batiments") { setTrackType(null); setStep(0); }
      else { setSelectedBat(null); setStep(1); }
      return;
    }
    if (step === 3) { setSelectedLot(null); setStep(2); return; }
    if (step === 4) { setSelectedDecomp(null); setStep(3); return; }
    if (step === 5) { setSelectedEntity(null); setStep(4); return; }
  };

  // Determine current row status for selected entity
  const getCurrentStatus = (entityId) => {
    if (!selectedLot || !selectedDecomp || !entityId) return "";
    const rowKey = `${selectedLot.trackPrefix || selectedLot.numero}-${selectedDecomp}`;
    return project.tracking?.[trackType]?.[rowKey]?.[entityId]?.status || "";
  };

  if (!project.batiments?.length) return null;

  return (
    <>
      {/* FAB — visible only on mobile via CSS */}
      <button
        className="quick-entry-fab"
        onClick={() => setOpen(true)}
        aria-label="Saisie rapide"
        title="Saisie rapide"
      >
        <Icon name="plus" size={24} />
      </button>

      {/* Full-screen overlay */}
      {open && (
        <div className="quick-entry-overlay">
          <div className="quick-entry-header">
            <button className="btn btn-ghost btn-sm" onClick={goBack}>
              <Icon name="back" size={18} />
              {step === 0 ? "Fermer" : "Retour"}
            </button>
            <h3>Saisie rapide</h3>
            <button className="btn btn-ghost btn-sm" onClick={handleClose}>
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="quick-entry-body">
            {/* Step 0: Choose tracking type */}
            {step === 0 && (
              <div className="quick-entry-step">
                <div className="quick-entry-step-label">Type de suivi</div>
                <div className="quick-entry-options">
                  <button
                    className="quick-entry-option"
                    onClick={() => handleSelectType("logements")}
                  >
                    <Icon name="home" size={16} /> Suivi INT (Logements)
                  </button>
                  <button
                    className="quick-entry-option"
                    onClick={() => handleSelectType("batiments")}
                  >
                    <Icon name="building" size={16} /> Suivi EXT (B&acirc;timents)
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Choose batiment (INT only) */}
            {step === 1 && (
              <div className="quick-entry-step">
                <div className="quick-entry-step-label">
                  S&eacute;lectionner un b&acirc;timent
                </div>
                <div className="quick-entry-options">
                  {project.batiments.map((bat) => (
                    <button
                      key={bat.id}
                      className="quick-entry-option"
                      onClick={() => handleSelectBat(bat)}
                    >
                      {bat.name} ({getLogementNums(bat).length} logements)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Choose lot */}
            {step === 2 && (
              <div className="quick-entry-step">
                <div className="quick-entry-step-label">
                  S&eacute;lectionner un lot
                </div>
                <div className="quick-entry-options">
                  {lots.map((lot) => (
                    <button
                      key={lot.numero}
                      className="quick-entry-option"
                      onClick={() => handleSelectLot(lot)}
                    >
                      Lot {lot.numero} — {lot.nom}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Choose decomposition */}
            {step === 3 && (
              <div className="quick-entry-step">
                <div className="quick-entry-step-label">
                  D&eacute;composition — Lot {selectedLot?.numero} {selectedLot?.nom}
                </div>
                <div className="quick-entry-options">
                  {decompositions.map((d) => (
                    <button
                      key={d}
                      className="quick-entry-option"
                      onClick={() => handleSelectDecomp(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Choose entity */}
            {step === 4 && (
              <div className="quick-entry-step">
                <div className="quick-entry-step-label">
                  {trackType === "logements"
                    ? `Logement — ${selectedBat?.name}`
                    : "B\u00e2timent"}
                </div>
                <div className="quick-entry-options">
                  {(trackType === "batiments"
                    ? project.batiments.map((b) => ({ id: b.id, label: b.name }))
                    : entities
                  ).map((e) => {
                    const current = getCurrentStatus(e.id);
                    return (
                      <button
                        key={e.id}
                        className={`quick-entry-option ${selectedEntity?.id === e.id ? "selected" : ""}`}
                        onClick={() => handleSelectEntity(e)}
                      >
                        {e.label}
                        {current && (
                          <span style={{
                            marginLeft: "auto",
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            fontSize: 13,
                            color: current === "X" ? "var(--success)"
                              : current === "!" ? "var(--warning)"
                              : current === "NOK" ? "var(--danger)"
                              : "var(--info)",
                          }}>
                            {current}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 5: Set status */}
            {step === 5 && (
              <div className="quick-entry-step">
                <div className="quick-entry-step-label">
                  Statut pour {selectedEntity?.label}
                </div>
                {confirmation ? (
                  <div className="quick-entry-confirmation">{confirmation}</div>
                ) : (
                  <div className="quick-entry-statuses">
                    <button
                      className="quick-entry-status-btn qe-ok"
                      onClick={() => handleSetStatus("X")}
                    >
                      X
                    </button>
                    <button
                      className="quick-entry-status-btn qe-alert"
                      onClick={() => handleSetStatus("!")}
                    >
                      !
                    </button>
                    <button
                      className="quick-entry-status-btn qe-nok"
                      onClick={() => handleSetStatus("NOK")}
                    >
                      NOK
                    </button>
                    <button
                      className="quick-entry-status-btn qe-clear"
                      onClick={() => handleSetStatus("")}
                    >
                      --
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
