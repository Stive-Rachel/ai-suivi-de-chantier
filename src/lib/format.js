export function formatMontant(v) {
  if (!v && v !== 0) return "";
  return Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
