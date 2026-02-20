// ─── DEFAULT LOTS ────────────────────────────────────────────────────────────
export const DEFAULT_LOTS_INT = [
  { numero: "1", nom: "GROS OEUVRE", decompositions: ["Fondations", "Élévation", "Planchers", "Escaliers"] },
  { numero: "2", nom: "CHARPENTE COUVERTURE", decompositions: ["Charpente", "Couverture", "Zinguerie"] },
  { numero: "3", nom: "ÉTANCHÉITÉ", decompositions: ["Étanchéité toiture", "Étanchéité terrasse"] },
  { numero: "4", nom: "MENUISERIES INTÉRIEURES", decompositions: ["Portes", "Placards", "Habillages"] },
  { numero: "5", nom: "MENUISERIES EXTÉRIEURES", decompositions: ["Fenêtres", "Volets", "Portes ext."] },
  { numero: "6", nom: "REVÊTEMENTS SOLS", decompositions: ["Carrelage", "Parquet", "Chape"] },
  { numero: "7", nom: "REVÊTEMENTS MURAUX", decompositions: ["Enduits", "Peinture", "Faïence"] },
  { numero: "8", nom: "PLÂTRERIE FAUX PLAFONDS", decompositions: ["Cloisons", "Doublages", "Faux plafonds"] },
  { numero: "9", nom: "PLOMBERIE SANITAIRES", decompositions: ["Alimentation", "Évacuation", "Appareils sanitaires"] },
  { numero: "10", nom: "ÉLECTRICITÉ", decompositions: ["Courants forts", "Courants faibles", "Appareillage"] },
];

export const DEFAULT_LOTS_EXT = [
  { numero: "1", nom: "GROS OEUVRE", decompositions: ["Fondations", "Élévation", "Planchers"] },
  { numero: "2", nom: "CHARPENTE COUVERTURE", decompositions: ["Charpente", "Couverture"] },
  { numero: "3", nom: "ÉTANCHÉITÉ", decompositions: ["Étanchéité"] },
  { numero: "4", nom: "RAVALEMENT", decompositions: ["Enduit extérieur", "Peinture extérieure"] },
  { numero: "5", nom: "MENUISERIES EXTÉRIEURES", decompositions: ["Fenêtres", "Portes", "Volets"] },
  { numero: "6", nom: "VRD", decompositions: ["Voirie", "Réseaux", "Aménagements ext."] },
];

export const DEFAULT_LOTS = [
  { numero: "1", nom: "GROS OEUVRE", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "2", nom: "CHARPENTE COUVERTURE", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "3", nom: "ÉTANCHÉITÉ", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "4", nom: "RAVALEMENT", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "5", nom: "MENUISERIES EXTÉRIEURES", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "6", nom: "MENUISERIES INTÉRIEURES", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "7", nom: "PLÂTRERIE FAUX PLAFONDS", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "8", nom: "PLOMBERIE SANITAIRES", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "9", nom: "ÉLECTRICITÉ", montantMarche: 0, montantExt: 0, montantInt: 0 },
  { numero: "10", nom: "VRD", montantMarche: 0, montantExt: 0, montantInt: 0 },
];

export const STATUS_CONFIG = {
  "": { label: "—", cls: "status-empty" },
  X: { label: "X", cls: "status-ok" },
  "!": { label: "!", cls: "status-alert" },
  NOK: { label: "NOK", cls: "status-nok" },
  i: { label: "i", cls: "status-info" },
};

export const STATUS_BADGE_STYLES = {
  X: { background: "var(--success)", color: "#fff" },
  "!": { background: "var(--warning)", color: "#fff" },
  NOK: { background: "var(--danger)", color: "#fff" },
  i: { background: "var(--info)", color: "#fff" },
};
