import { computeDetailedProgress, computeProjectProgress } from "./computations";
import { formatMontant } from "./format";

/**
 * Genere un PDF de synthese du projet.
 * Utilise jspdf en import dynamique pour garder le bundle leger.
 */
export async function generateProjectPDF(project) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Couleurs ──
  const terracotta = [194, 97, 58];
  const dark = [28, 25, 23];
  const gray = [107, 101, 96];
  const lightGray = [168, 162, 158];
  const success = [45, 139, 87];
  const warning = [200, 141, 26];
  const danger = [196, 64, 64];
  const bgRaised = [250, 250, 247];

  // ── Helpers ──
  const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const drawColor = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const fillColor = (c) => doc.setFillColor(c[0], c[1], c[2]);

  const checkPage = (needed) => {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ── HEADER ──
  fillColor(terracotta);
  doc.roundedRect(margin, y, contentW, 28, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(project.name || "Projet", margin + 8, y + 11);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const subtitle = [
    project.location,
    project.client,
  ].filter(Boolean).join(" \u00b7 ");
  if (subtitle) {
    doc.text(subtitle, margin + 8, y + 19);
  }

  // Date
  doc.setFontSize(8);
  doc.text(
    `Genere le ${new Date().toLocaleDateString("fr-FR")}`,
    margin + 8,
    y + 25
  );

  y += 34;

  // ── KPIs ──
  const progress = computeProjectProgress(project);
  const { lotProgressInt, lotProgressExt, batimentProgress } = computeDetailedProgress(project);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setColor(dark);
  doc.text("Indicateurs cles", margin, y + 5);
  y += 10;

  // KPI boxes
  const kpis = [
    { label: "Avancement global", value: `${progress.toFixed(2)}%` },
    { label: "Montant total", value: formatMontant(project.montantTotal) },
    { label: "Batiments", value: `${(project.batiments || []).length}` },
    { label: "Duree (sem.)", value: `${project.dureeTotale || 0}` },
  ];

  const kpiW = (contentW - 6) / 4;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 2);
    fillColor(bgRaised);
    drawColor([230, 230, 225]);
    doc.roundedRect(x, y, kpiW, 16, 2, 2, "FD");

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(terracotta);
    doc.text(kpi.value, x + kpiW / 2, y + 7, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(lightGray);
    doc.text(kpi.label.toUpperCase(), x + kpiW / 2, y + 13, { align: "center" });
  });

  y += 22;

  // ── Progress bar global ──
  drawColor([230, 230, 225]);
  fillColor([240, 237, 232]);
  doc.roundedRect(margin, y, contentW, 5, 2, 2, "FD");
  if (progress > 0) {
    const progressColor = progress >= 80 ? success : progress >= 40 ? warning : terracotta;
    fillColor(progressColor);
    doc.roundedRect(margin, y, Math.max((progress / 100) * contentW, 2), 5, 2, 2, "F");
  }
  y += 10;

  // ── LOTS EXTERIEURS ──
  const drawLotsSection = (title, lotsProgress, color) => {
    checkPage(20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(dark);
    doc.text(title, margin, y + 5);

    // Total progress for this type
    const totalMontant = lotsProgress.reduce((s, l) => s + (l.montant || 0), 0);
    const avgProgress =
      totalMontant > 0
        ? lotsProgress.reduce((s, l) => s + (l.montant / totalMontant) * l.progress, 0)
        : lotsProgress.length > 0
          ? lotsProgress.reduce((s, l) => s + l.progress, 0) / lotsProgress.length
          : 0;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(gray);
    doc.text(`${avgProgress.toFixed(2)}%`, margin + contentW, y + 5, { align: "right" });
    y += 10;

    lotsProgress.forEach((lp) => {
      checkPage(10);

      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      setColor(dark);
      const label = lp.shortLot || lp.lot;
      doc.text(label.length > 40 ? label.slice(0, 38) + "..." : label, margin, y + 4);

      // Value
      doc.setFont("helvetica", "bold");
      setColor(lp.progress >= 80 ? success : lp.progress >= 40 ? warning : danger);
      doc.text(`${lp.progress.toFixed(2)}%`, margin + contentW, y + 4, { align: "right" });

      // Bar track
      const barX = margin + 80;
      const barW = contentW - 80 - 25;
      fillColor([240, 237, 232]);
      doc.roundedRect(barX, y + 1, barW, 3, 1, 1, "F");

      // Bar fill
      if (lp.progress > 0) {
        const pColor = lp.progress >= 80 ? success : lp.progress >= 40 ? warning : terracotta;
        fillColor(pColor);
        doc.roundedRect(barX, y + 1, Math.max((lp.progress / 100) * barW, 1), 3, 1, 1, "F");
      }

      y += 8;
    });

    y += 4;
  };

  drawLotsSection("Avancement Exterieur", lotProgressExt, terracotta);
  drawLotsSection("Avancement Interieur", lotProgressInt, [61, 126, 199]);

  // ── BATIMENTS ──
  checkPage(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  setColor(dark);
  doc.text("Avancement par batiment", margin, y + 5);
  y += 10;

  // Table header
  fillColor(bgRaised);
  drawColor([230, 230, 225]);
  doc.roundedRect(margin, y, contentW, 7, 1, 1, "FD");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(gray);
  doc.text("BATIMENT", margin + 3, y + 5);
  doc.text("INT.", margin + 85, y + 5, { align: "center" });
  doc.text("EXT.", margin + 115, y + 5, { align: "center" });
  doc.text("TOTAL", margin + 145, y + 5, { align: "center" });
  y += 9;

  batimentProgress.forEach((bp) => {
    checkPage(8);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setColor(dark);
    doc.text(bp.name, margin + 3, y + 4);

    doc.setFont("helvetica", "bold");
    setColor(bp.int >= 80 ? success : bp.int >= 40 ? warning : danger);
    doc.text(`${bp.int.toFixed(2)}%`, margin + 85, y + 4, { align: "center" });

    setColor(bp.ext >= 80 ? success : bp.ext >= 40 ? warning : danger);
    doc.text(`${bp.ext.toFixed(2)}%`, margin + 115, y + 4, { align: "center" });

    setColor(bp.total >= 80 ? success : bp.total >= 40 ? warning : danger);
    doc.text(`${bp.total.toFixed(2)}%`, margin + 145, y + 4, { align: "center" });

    // separator
    drawColor([240, 237, 232]);
    doc.line(margin, y + 6, margin + contentW, y + 6);
    y += 8;
  });

  y += 6;

  // ── RECAP FINANCIER ──
  checkPage(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  setColor(dark);
  doc.text("Recapitulatif financier", margin, y + 5);
  y += 10;

  const financials = [
    { label: "Montant total marche", value: formatMontant(project.montantTotal) },
    { label: "Montant exterieur", value: formatMontant(project.montantExt) },
    { label: "Montant interieur", value: formatMontant(project.montantInt) },
  ];

  financials.forEach((f) => {
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(gray);
    doc.text(f.label, margin + 3, y + 4);
    doc.setFont("helvetica", "bold");
    setColor(dark);
    doc.text(f.value, margin + contentW - 3, y + 4, { align: "right" });
    drawColor([240, 237, 232]);
    doc.line(margin, y + 6, margin + contentW, y + 6);
    y += 8;
  });

  // ── FOOTER ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(lightGray);
    doc.text(
      `${project.name} \u2014 Page ${i}/${pageCount}`,
      pageW / 2,
      290,
      { align: "center" }
    );
  }

  // ── SAVE ──
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_rapport_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
