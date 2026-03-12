export function formatMontant(v: number | null | undefined, compact?: boolean): string {
  if (!v && v !== 0) return "";
  const n = Number(v);
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) {
      return (n / 1_000_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " Md€";
    }
    if (Math.abs(n) >= 1_000_000) {
      return (n / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " M€";
    }
    if (Math.abs(n) >= 1_000) {
      return (n / 1_000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " k€";
    }
  }
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
