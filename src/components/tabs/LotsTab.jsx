import { useState, Fragment } from "react";
import { formatMontant } from "../../lib/format";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import MoneyInput from "../ui/MoneyInput";

export default function LotsTab({ project, updateProject, supaSync }) {
  const [showAddLot, setShowAddLot] = useState(false);
  const [newLotNum, setNewLotNum] = useState("");
  const [newLotNom, setNewLotNom] = useState("");
  const [decompModal, setDecompModal] = useState(null);
  const [newDecomp, setNewDecomp] = useState("");
  const [expandedDecomp, setExpandedDecomp] = useState(null);

  const lots = project.lots || [];
  const totalMarche = lots.reduce((s, l) => s + (l.montantMarche || 0), 0);
  const totalExt = lots.reduce((s, l) => s + (l.montantExt || 0), 0);
  const totalInt = lots.reduce((s, l) => s + (l.montantInt || 0), 0);

  // Wrapper: sync lots to Supabase after any lots change
  const updateProjectAndSyncLots = (updater) => {
    updateProject((p) => {
      const result = updater(p);
      supaSync?.syncLots(result.lots);
      return result;
    });
  };

  // Wrapper: sync decomps to Supabase after any decomp change
  const updateProjectAndSyncDecomp = (updater) => {
    updateProject((p) => {
      const result = updater(p);
      supaSync?.syncLotsDecomp(result.lotsInt, result.lotsExt);
      return result;
    });
  };

  const updateLotField = (index, field, value) => {
    updateProjectAndSyncLots((p) => {
      const updated = [...p.lots];
      updated[index] = { ...updated[index], [field]: value };
      return { ...p, lots: updated };
    });
  };

  const sortLots = () => {
    updateProjectAndSyncLots((p) => ({
      ...p,
      lots: [...p.lots].sort((a, b) => {
        const na = parseInt(a.numero) || 0;
        const nb = parseInt(b.numero) || 0;
        return na - nb;
      }),
    }));
  };

  const addLot = () => {
    if (!newLotNum.trim() || !newLotNom.trim()) return;
    updateProjectAndSyncLots((p) => ({
      ...p,
      lots: [...p.lots, { numero: newLotNum.trim(), nom: newLotNom.trim(), montantMarche: 0, montantExt: 0, montantInt: 0 }],
    }));
    setNewLotNum("");
    setNewLotNom("");
    setShowAddLot(false);
  };

  const removeLot = (index) => {
    const lot = lots[index];
    if (!confirm(`Supprimer le lot ${lot.numero} — ${lot.nom} ?`)) return;
    updateProjectAndSyncLots((p) => ({
      ...p,
      lots: p.lots.filter((_, i) => i !== index),
    }));
  };

  const getDecomps = (lotIndex, type) => {
    const lot = lots[lotIndex];
    if (!lot) return [];
    const source = type === "ext" ? project.lotsExt : project.lotsInt;
    return source.filter((l) => l.numero === lot.numero);
  };

  const addStepToSubLot = (lotIndex, type, subLotIndex) => {
    if (!newDecomp.trim()) return;
    const field = type === "ext" ? "lotsExt" : "lotsInt";
    const lot = lots[lotIndex];
    updateProjectAndSyncDecomp((p) => {
      const arr = [...p[field]];
      const matching = arr.filter((l) => l.numero === lot.numero);
      const target = matching[subLotIndex];
      if (target) {
        const realIdx = arr.indexOf(target);
        arr[realIdx] = { ...target, decompositions: [...target.decompositions, newDecomp.trim()] };
      }
      return { ...p, [field]: arr };
    });
    setNewDecomp("");
  };

  const addNewSubLot = (lotIndex, type) => {
    if (!newDecomp.trim()) return;
    const field = type === "ext" ? "lotsExt" : "lotsInt";
    const lot = lots[lotIndex];
    updateProjectAndSyncDecomp((p) => ({
      ...p,
      [field]: [...p[field], { numero: lot.numero, nom: lot.nom, nomDecomp: newDecomp.trim(), montant: 0, decompositions: [] }],
    }));
    setNewDecomp("");
  };

  const removeDecomposition = (lotIndex, type, subLotIndex, decompIndex) => {
    const field = type === "ext" ? "lotsExt" : "lotsInt";
    const lot = lots[lotIndex];
    updateProjectAndSyncDecomp((p) => {
      const arr = [...p[field]];
      const matching = arr.filter((l) => l.numero === lot.numero);
      const target = matching[subLotIndex];
      if (target) {
        const realIdx = arr.indexOf(target);
        arr[realIdx] = { ...target, decompositions: target.decompositions.filter((_, i) => i !== decompIndex) };
      }
      return { ...p, [field]: arr };
    });
  };

  const updateDecompField = (lotIndex, type, subLotIndex, field, value) => {
    const arrField = type === "ext" ? "lotsExt" : "lotsInt";
    const lot = lots[lotIndex];
    updateProjectAndSyncDecomp((p) => {
      const arr = [...p[arrField]];
      const matching = arr.filter((l) => l.numero === lot.numero);
      const target = matching[subLotIndex];
      if (target) {
        const realIdx = arr.indexOf(target);
        arr[realIdx] = { ...target, [field]: value };
      }
      return { ...p, [arrField]: arr };
    });
  };

  return (
    <div className="setup-content-wide" style={{ animation: "slideInUp 0.4s ease both" }}>
      <div className="config-section">
        <div className="section-header">
          <div>
            <h3>Lots & Décompositions</h3>
            <p>{lots.length} lot(s) configuré(s)</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon="sort" size="sm" variant="ghost" onClick={sortLots}>
              Trier
            </Button>
            <Button icon="plus" size="sm" onClick={() => setShowAddLot(true)}>
              Ajouter un lot
            </Button>
          </div>
        </div>

        {lots.length === 0 ? (
          <div className="empty-placeholder">Ajoutez des lots pour commencer</div>
        ) : (
          <div className="config-table-wrap">
            <table className="config-table lots-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>N° lot</th>
                  <th>Intitulé du lot</th>
                  <th style={{ width: 130, textAlign: "right" }}>Montant marché</th>
                  <th style={{ width: 60, textAlign: "right" }}>%</th>
                  <th style={{ width: 80, textAlign: "center" }} className="col-ext">Déc. Ext</th>
                  <th style={{ width: 130, textAlign: "right" }} className="col-ext">Montant Ext.</th>
                  <th style={{ width: 60, textAlign: "right" }} className="col-ext">% Ext.</th>
                  <th style={{ width: 80, textAlign: "center" }} className="col-int">Déc. Int</th>
                  <th style={{ width: 130, textAlign: "right" }} className="col-int">Montant Int.</th>
                  <th style={{ width: 60, textAlign: "right" }} className="col-int">% Int.</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot, i) => {
                  const pctMarche = totalMarche > 0 ? ((lot.montantMarche || 0) / totalMarche * 100) : 0;
                  const pctExt = totalExt > 0 ? ((lot.montantExt || 0) / totalExt * 100) : 0;
                  const pctInt = totalInt > 0 ? ((lot.montantInt || 0) / totalInt * 100) : 0;
                  const nbDecompExt = project.lotsExt.filter((l) => l.numero === lot.numero).length;
                  const nbDecompInt = project.lotsInt.filter((l) => l.numero === lot.numero).length;
                  return (
                    <tr key={i}>
                      <td className="cell-center cell-mono cell-bold">{lot.numero}</td>
                      <td>
                        <input className="inline-edit" value={lot.nom} onChange={(e) => updateLotField(i, "nom", e.target.value)} />
                      </td>
                      <td className="cell-right cell-mono">
                        <MoneyInput value={lot.montantMarche} onChange={(v) => updateLotField(i, "montantMarche", v)} />
                      </td>
                      <td className="cell-right cell-mono cell-muted">{pctMarche.toFixed(0)}%</td>
                      <td className="cell-center col-ext">
                        <button className="decomp-count-btn" onClick={() => setDecompModal({ lotIndex: i, type: "ext" })}>
                          {nbDecompExt}
                        </button>
                      </td>
                      <td className="cell-right col-ext cell-mono">
                        <MoneyInput value={lot.montantExt} onChange={(v) => updateLotField(i, "montantExt", v)} />
                      </td>
                      <td className="cell-right cell-mono cell-muted col-ext">{pctExt.toFixed(0)}%</td>
                      <td className="cell-center col-int">
                        <button className="decomp-count-btn" onClick={() => setDecompModal({ lotIndex: i, type: "int" })}>
                          {nbDecompInt}
                        </button>
                      </td>
                      <td className="cell-right col-int cell-mono">
                        <MoneyInput value={lot.montantInt} onChange={(v) => updateLotField(i, "montantInt", v)} />
                      </td>
                      <td className="cell-right cell-mono cell-muted col-int">{pctInt.toFixed(0)}%</td>
                      <td className="cell-center">
                        <button className="delete-btn" style={{ opacity: 1 }} onClick={() => removeLot(i)}>
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td className="cell-bold">Total</td>
                  <td className="cell-right cell-bold cell-mono">{formatMontant(totalMarche)}</td>
                  <td className="cell-right cell-mono cell-bold">100%</td>
                  <td className="cell-center col-ext cell-bold cell-mono">
                    {project.lotsExt.length}
                  </td>
                  <td className="cell-right col-ext cell-bold cell-mono">{formatMontant(totalExt)}</td>
                  <td className="cell-right col-ext cell-mono cell-bold">100%</td>
                  <td className="cell-center col-int cell-bold cell-mono">
                    {project.lotsInt.length}
                  </td>
                  <td className="cell-right col-int cell-bold cell-mono">{formatMontant(totalInt)}</td>
                  <td className="cell-right col-int cell-mono cell-bold">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      <Modal open={showAddLot} onClose={() => setShowAddLot(false)} title="Ajouter un lot">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Numéro du lot" value={newLotNum} onChange={setNewLotNum} placeholder="Ex: 11" />
          <Input label="Intitulé du lot" value={newLotNom} onChange={setNewLotNom} placeholder="Ex: PEINTURE" />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setShowAddLot(false)}>Annuler</Button>
            <Button onClick={addLot} disabled={!newLotNum.trim() || !newLotNom.trim()}>Ajouter</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!decompModal} onClose={() => { setDecompModal(null); setNewDecomp(""); setExpandedDecomp(null); }} title={decompModal ? `Décompositions ${decompModal.type === "ext" ? "extérieures" : "intérieures"} — Lot ${(lots[decompModal.lotIndex] || {}).numero}` : ""} width={780}>
        {decompModal && (() => {
          const decomps = getDecomps(decompModal.lotIndex, decompModal.type);
          const totalLot = decomps.reduce((s, d) => s + (d.montant || 0), 0);
          const source = decompModal.type === "ext" ? project.lotsExt : project.lotsInt;
          const totalGlobal = source.reduce((s, d) => s + (d.montant || 0), 0);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {decomps.length === 0 ? (
                <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Aucune décomposition</p>
              ) : (
                <div className="config-table-wrap">
                  <table className="config-table decomp-table">
                    <thead>
                      <tr>
                        <th>Nom Décomposition</th>
                        <th style={{ width: 140, textAlign: "right" }}>Montant</th>
                        <th style={{ width: 60, textAlign: "right" }}>%</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {decomps.map((subLot, si) => (
                        <Fragment key={si}>
                          <tr className={expandedDecomp === si ? "decomp-row-expanded" : "decomp-row"} onClick={() => setExpandedDecomp(expandedDecomp === si ? null : si)} style={{ cursor: "pointer" }}>
                            <td style={{ fontWeight: 600 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 10, color: "var(--text-tertiary)", transition: "transform 0.2s", transform: expandedDecomp === si ? "rotate(90deg)" : "rotate(0deg)" }}>&#9654;</span>
                                {subLot.nomDecomp || subLot.nom}
                              </span>
                            </td>
                            <td className="cell-right cell-mono" onClick={(e) => e.stopPropagation()}>
                              <MoneyInput value={subLot.montant} onChange={(v) => updateDecompField(decompModal.lotIndex, decompModal.type, si, "montant", v)} />
                            </td>
                            <td className="cell-right cell-mono cell-muted">
                              {totalGlobal > 0 ? ((subLot.montant || 0) / totalGlobal * 100).toFixed(2) + "%" : "—"}
                            </td>
                            <td className="cell-center" onClick={(e) => e.stopPropagation()}>
                              <button className="delete-btn" style={{ opacity: 1 }} onClick={() => {
                                if (!confirm(`Supprimer "${subLot.nomDecomp || subLot.nom}" ?`)) return;
                                const field = decompModal.type === "ext" ? "lotsExt" : "lotsInt";
                                updateProjectAndSyncDecomp((p) => {
                                  const arr = [...p[field]];
                                  const matching = arr.filter((l) => l.numero === (lots[decompModal.lotIndex] || {}).numero);
                                  const realIdx = arr.indexOf(matching[si]);
                                  if (realIdx >= 0) arr.splice(realIdx, 1);
                                  return { ...p, [field]: arr };
                                });
                              }}>
                                <Icon name="trash" size={12} />
                              </button>
                            </td>
                          </tr>
                          {expandedDecomp === si && (
                            <tr>
                              <td colSpan={4} style={{ padding: "0 12px 12px 28px", background: "var(--bg-raised)" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 8 }}>
                                  {subLot.decompositions.map((d, di) => (
                                    <div key={di} className="decomp-item" style={{ fontSize: 12 }}>
                                      <span>{d}</span>
                                      <button className="delete-btn" style={{ opacity: 1 }} onClick={() => removeDecomposition(decompModal.lotIndex, decompModal.type, si, di)}>
                                        <Icon name="trash" size={11} />
                                      </button>
                                    </div>
                                  ))}
                                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                    <input className="input-field" style={{ flex: 1, padding: "5px 8px", fontSize: 12 }} value={newDecomp} onChange={(e) => setNewDecomp(e.target.value)} placeholder="Nouvelle étape..." onKeyDown={(e) => { if (e.key === "Enter") { addStepToSubLot(decompModal.lotIndex, decompModal.type, si); } }} />
                                    <Button size="sm" onClick={() => addStepToSubLot(decompModal.lotIndex, decompModal.type, si)} disabled={!newDecomp.trim()}>+</Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="cell-bold">Total</td>
                        <td className="cell-right cell-bold cell-mono">{formatMontant(totalLot)}</td>
                        <td className="cell-right cell-bold cell-mono">{totalGlobal > 0 ? ((totalLot / totalGlobal) * 100).toFixed(2) + "%" : "—"}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input className="input-field" style={{ flex: 1 }} value={newDecomp} onChange={(e) => setNewDecomp(e.target.value)} placeholder="Ajouter une décomposition..." onKeyDown={(e) => { if (e.key === "Enter") addNewSubLot(decompModal.lotIndex, decompModal.type); }} />
                <Button size="sm" onClick={() => addNewSubLot(decompModal.lotIndex, decompModal.type)} disabled={!newDecomp.trim()}>Ajouter</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
