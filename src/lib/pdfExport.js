import { computeDetailedProgress, computeProjectProgress, getLogementCounts } from "./computations";
import { getLogementNums } from "./db";
import { formatMontant } from "./format";

/**
 * Genere un PDF de synthese du projet — design navy/gold premium.
 * Utilise jspdf en import dynamique pour garder le bundle leger.
 */
export async function generateProjectPDF(project) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Couleurs (navy / gold brand) ──
  const navy = [44, 62, 107];
  const navyDark = [26, 35, 64];
  const gold = [212, 160, 48];
  const goldLight = [244, 226, 177];
  const dark = [26, 35, 64];
  const gray = [100, 107, 120];
  const lightGray = [160, 165, 175];
  const success = [45, 139, 87];
  const warning = [200, 141, 26];
  const danger = [196, 64, 64];
  const white = [255, 255, 255];
  const bgLight = [245, 246, 250];
  const bgRow = [240, 242, 247];
  const borderLight = [220, 223, 230];
  const info = [61, 126, 199];

  // ── Helpers ──
  const rgb = (c) => ({ r: c[0], g: c[1], b: c[2] });
  const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const drawColor = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const fillColor = (c) => doc.setFillColor(c[0], c[1], c[2]);

  const checkPage = (needed) => {
    if (y + needed > 278) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  const progressColor = (v) => v >= 75 ? success : v >= 40 ? warning : danger;

  const drawSectionTitle = (title, icon) => {
    checkPage(16);
    // Gold accent line
    fillColor(gold);
    doc.rect(margin, y, 3, 8, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(dark);
    doc.text(title, margin + 7, y + 6);
    y += 12;
  };

  // ── PAGE 1: HEADER ──
  // Navy gradient header bar
  fillColor(navyDark);
  doc.roundedRect(margin, y, contentW, 32, 3, 3, "F");
  fillColor(navy);
  doc.roundedRect(margin, y, contentW, 30, 3, 3, "F");

  // Gold accent strip at bottom of header
  fillColor(gold);
  doc.rect(margin, y + 28, contentW, 2, "F");

  // Logo
  try {
    const logoImg = new Image();
    logoImg.src = "/logo.jpeg";
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
      setTimeout(resolve, 2000);
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      // White circle behind logo
      doc.setFillColor(255, 255, 255);
      doc.circle(margin + 15, y + 15, 12, "F");
      doc.addImage(logoImg, "JPEG", margin + 4, y + 4, 22, 22);
    }
  } catch { /* logo optional */ }

  // Project name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(project.name || "Projet", margin + 30, y + 12);

  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 230);
  const subtitle = [project.location, project.client].filter(Boolean).join(" \u00b7 ");
  if (subtitle) {
    doc.text(subtitle, margin + 30, y + 20);
  }

  // Date — gold accent
  doc.setFontSize(8);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(
    `Rapport genere le ${new Date().toLocaleDateString("fr-FR")}`,
    margin + 30,
    y + 26
  );

  y += 38;

  // ── KPIs ──
  const progress = computeProjectProgress(project);
  const { lotProgressInt, lotProgressExt, batimentProgress } = computeDetailedProgress(project);
  const logCounts = getLogementCounts(project);

  // Compute INT/EXT weighted averages
  const totalMontantInt = lotProgressInt.reduce((s, lp) => s + lp.montant, 0);
  const avgInt = totalMontantInt > 0
    ? lotProgressInt.reduce((s, lp) => s + (lp.montant / totalMontantInt) * lp.progress, 0)
    : 0;
  const totalMontantExt = lotProgressExt.reduce((s, lp) => s + lp.montant, 0);
  const avgExt = totalMontantExt > 0
    ? lotProgressExt.reduce((s, lp) => s + (lp.montant / totalMontantExt) * lp.progress, 0)
    : 0;

  // Count completed logements
  const exceptions = project.exceptions || {};
  let logementsDone = 0;
  const intLots = project.lotsInt || [];
  const trackingLog = project.tracking?.logements || {};
  if (intLots.length > 0) {
    const taskKeys = [];
    for (const lot of intLots) {
      for (const decomp of lot.decompositions) {
        taskKeys.push(`${lot.trackPrefix || lot.numero}-${decomp}`);
      }
    }
    if (taskKeys.length > 0) {
      for (const bat of project.batiments) {
        for (const num of getLogementNums(bat)) {
          const eId = `${bat.id}_log_${num}`;
          if (exceptions[eId]) continue;
          const allDone = taskKeys.every((key) => {
            const status = trackingLog[key]?.[eId]?.status;
            return status === "X" || status === "N/A";
          });
          if (allDone) logementsDone++;
        }
      }
    }
  }

  drawSectionTitle("Indicateurs cles");

  const kpis = [
    { label: "AVANCEMENT\nGLOBAL", value: `${progress.toFixed(1)}%`, color: progressColor(progress) },
    { label: "INTERIEUR", value: `${avgInt.toFixed(1)}%`, color: progressColor(avgInt) },
    { label: "EXTERIEUR", value: `${avgExt.toFixed(1)}%`, color: progressColor(avgExt) },
    { label: "BATIMENTS", value: `${(project.batiments || []).length}`, color: navy },
    { label: "LOGEMENTS", value: `${logCounts.active}`, color: navy },
    { label: "TERMINES", value: `${logementsDone}`, color: success },
  ];

  const kpiW = (contentW - 10) / 6;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 2);

    // Card background
    fillColor(white);
    drawColor(borderLight);
    doc.roundedRect(x, y, kpiW, 20, 2, 2, "FD");

    // Color accent top
    fillColor(kpi.color);
    doc.roundedRect(x, y, kpiW, 2, 2, 2, "F");
    // Cover bottom corners of accent
    fillColor(white);
    doc.rect(x, y + 1, kpiW, 1.5, "F");

    // Value
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    setColor(kpi.color);
    doc.text(kpi.value, x + kpiW / 2, y + 10, { align: "center" });

    // Label
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    setColor(lightGray);
    const lines = kpi.label.split("\n");
    lines.forEach((line, li) => {
      doc.text(line, x + kpiW / 2, y + 15 + li * 3, { align: "center" });
    });
  });

  y += 26;

  // ── Global progress bar with label ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(dark);
  doc.text("Avancement global", margin, y + 3);
  setColor(progressColor(progress));
  doc.text(`${progress.toFixed(2)}%`, margin + contentW, y + 3, { align: "right" });
  y += 6;

  drawColor(borderLight);
  fillColor(bgLight);
  doc.roundedRect(margin, y, contentW, 6, 3, 3, "FD");
  if (progress > 0) {
    fillColor(progressColor(progress));
    const barW = Math.max((progress / 100) * contentW, 3);
    doc.roundedRect(margin, y, barW, 6, 3, 3, "F");
  }
  y += 12;

  // ── AVANCEMENT PAR LOT — TABLE FORMAT ──
  const drawLotsTable = (title, lotsProgress, accentColor) => {
    if (lotsProgress.length === 0) return;

    const totalMontant = lotsProgress.reduce((s, l) => s + (l.montant || 0), 0);
    const avgProg = totalMontant > 0
      ? lotsProgress.reduce((s, l) => s + (l.montant / totalMontant) * l.progress, 0)
      : lotsProgress.reduce((s, l) => s + l.progress, 0) / lotsProgress.length;

    drawSectionTitle(title);

    // Table header
    const colLot = margin;           // Lot name
    const colMontant = margin + 90;  // Montant
    const colBar = margin + 118;     // Progress bar
    const colPct = margin + contentW - 1; // Percentage

    checkPage(12);
    fillColor(navyDark);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("LOT", colLot + 3, y + 5);
    doc.text("MONTANT", colMontant, y + 5, { align: "right" });
    doc.text("AVANCEMENT", colBar + (colPct - colBar - 18) / 2, y + 5, { align: "center" });
    doc.text("%", colPct, y + 5, { align: "right" });
    y += 9;

    // Table rows
    lotsProgress.forEach((lp, idx) => {
      checkPage(10);

      // Alternate row background
      if (idx % 2 === 0) {
        fillColor(bgRow);
        doc.rect(margin, y - 1, contentW, 9, "F");
      }

      // Lot name
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      setColor(dark);
      const label = lp.shortLot || lp.lot;
      const displayLabel = label.length > 50 ? label.slice(0, 48) + "..." : label;
      doc.text(displayLabel, colLot + 3, y + 4);

      // Montant
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      setColor(gray);
      if (lp.montant > 0) {
        doc.text(formatMontant(lp.montant, true), colMontant, y + 4, { align: "right" });
      }

      // Progress bar
      const barX = colBar;
      const barEndX = colPct - 18;
      const barW = barEndX - barX;
      fillColor(bgLight);
      doc.roundedRect(barX, y + 1.5, barW, 3, 1, 1, "F");
      if (lp.progress > 0) {
        fillColor(progressColor(lp.progress));
        doc.roundedRect(barX, y + 1.5, Math.max((lp.progress / 100) * barW, 1), 3, 1, 1, "F");
      }

      // Percentage
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      setColor(progressColor(lp.progress));
      doc.text(`${lp.progress.toFixed(2)}%`, colPct, y + 4, { align: "right" });

      y += 9;
    });

    // Total row
    checkPage(10);
    fillColor(navy);
    doc.roundedRect(margin, y - 1, contentW, 8, 1, 1, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL", colLot + 3, y + 4);
    if (totalMontant > 0) {
      doc.text(formatMontant(totalMontant, true), colMontant, y + 4, { align: "right" });
    }

    // Total bar
    const tBarX = colBar;
    const tBarEndX = colPct - 18;
    const tBarW = tBarEndX - tBarX;
    doc.setFillColor(255, 255, 255, 50);
    fillColor([70, 88, 130]);
    doc.roundedRect(tBarX, y + 1.5, tBarW, 3, 1, 1, "F");
    fillColor(goldLight);
    doc.roundedRect(tBarX, y + 1.5, Math.max((avgProg / 100) * tBarW, 1), 3, 1, 1, "F");

    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.text(`${avgProg.toFixed(2)}%`, colPct, y + 4, { align: "right" });

    y += 12;
  };

  drawLotsTable("Avancement par lot — Exterieur", lotProgressExt, info);
  drawLotsTable("Avancement par lot — Interieur", lotProgressInt, gold);

  // ── BATIMENTS ──
  if (batimentProgress.length > 0) {
    drawSectionTitle("Avancement par batiment");

    // Table header
    checkPage(12);
    fillColor(navyDark);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("BATIMENT", margin + 3, y + 5);
    doc.text("INT.", margin + 80, y + 5, { align: "center" });
    doc.text("EXT.", margin + 105, y + 5, { align: "center" });
    doc.text("TOTAL", margin + 130, y + 5, { align: "center" });
    doc.text("BARRE", margin + 158, y + 5, { align: "center" });
    y += 9;

    batimentProgress.forEach((bp, idx) => {
      checkPage(10);

      if (idx % 2 === 0) {
        fillColor(bgRow);
        doc.rect(margin, y - 1, contentW, 9, "F");
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      setColor(dark);
      doc.text(bp.name, margin + 3, y + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor(progressColor(bp.int));
      doc.text(`${bp.int.toFixed(1)}%`, margin + 80, y + 4, { align: "center" });

      setColor(progressColor(bp.ext));
      doc.text(`${bp.ext.toFixed(1)}%`, margin + 105, y + 4, { align: "center" });

      setColor(progressColor(bp.total));
      doc.text(`${bp.total.toFixed(1)}%`, margin + 130, y + 4, { align: "center" });

      // Mini bar
      const miniBarX = margin + 142;
      const miniBarW = contentW - 142 + margin - 3;
      fillColor(bgLight);
      doc.roundedRect(miniBarX, y + 1.5, miniBarW, 3, 1, 1, "F");
      if (bp.total > 0) {
        fillColor(progressColor(bp.total));
        doc.roundedRect(miniBarX, y + 1.5, Math.max((bp.total / 100) * miniBarW, 1), 3, 1, 1, "F");
      }

      y += 9;
    });

    y += 6;
  }

  // ── RECAP FINANCIER ──
  drawSectionTitle("Recapitulatif financier");

  const financials = [
    { label: "Montant total marche", value: formatMontant(project.montantTotal) },
    { label: "Montant exterieur", value: formatMontant(project.montantExt) },
    { label: "Montant interieur", value: formatMontant(project.montantInt) },
  ];

  // Financial card
  fillColor(white);
  drawColor(borderLight);
  const finH = financials.length * 10 + 6;
  checkPage(finH + 4);
  doc.roundedRect(margin, y, contentW, finH, 2, 2, "FD");

  financials.forEach((f, i) => {
    const fy = y + 5 + i * 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(gray);
    doc.text(f.label, margin + 8, fy + 4);
    doc.setFont("helvetica", "bold");
    setColor(dark);
    doc.text(f.value, margin + contentW - 8, fy + 4, { align: "right" });

    if (i < financials.length - 1) {
      drawColor(borderLight);
      doc.line(margin + 5, fy + 8, margin + contentW - 5, fy + 8);
    }
  });

  y += finH + 8;

  // ── LOGEMENTS SUMMARY ──
  if (logCounts.total > 0) {
    drawSectionTitle("Synthese logements");
    checkPage(20);

    const logPct = logCounts.active > 0 ? (logementsDone / logCounts.active) * 100 : 0;

    fillColor(white);
    drawColor(borderLight);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    setColor(gray);
    doc.text("Logements actifs", margin + 8, y + 6);
    doc.text("Logements termines", margin + 8, y + 13);

    doc.setFont("helvetica", "bold");
    setColor(dark);
    doc.text(`${logCounts.active} / ${logCounts.total}${logCounts.exceptions > 0 ? ` (${logCounts.exceptions} exc.)` : ""}`, margin + 60, y + 6);

    setColor(success);
    doc.text(`${logementsDone} / ${logCounts.active}  (${logPct.toFixed(1)}%)`, margin + 60, y + 13);

    // Mini bar
    const lBarX = margin + 110;
    const lBarW = contentW - 110 + margin - 8;
    fillColor(bgLight);
    doc.roundedRect(lBarX, y + 10.5, lBarW, 3, 1, 1, "F");
    if (logPct > 0) {
      fillColor(success);
      doc.roundedRect(lBarX, y + 10.5, Math.max((logPct / 100) * lBarW, 1), 3, 1, 1, "F");
    }

    y += 24;
  }

  // ── FOOTER on each page ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Gold line above footer
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.rect(margin, 285, contentW, 0.5, "F");

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(lightGray);
    doc.text(
      `${project.name} \u2014 Rapport de suivi`,
      margin,
      289
    );
    doc.text(
      `Page ${i}/${pageCount}`,
      margin + contentW,
      289,
      { align: "right" }
    );
  }

  // ── SAVE ──
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_rapport_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
