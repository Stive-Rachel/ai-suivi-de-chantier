const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('/Users/stive/Downloads/Chantier_V7-BERGEVIN REB (1).xlsx');

// ── 1. PARAMETERS ──
const params = XLSX.utils.sheet_to_json(wb.Sheets['Paramètres'], { header: 1, defval: '' });

const projectName = String(params[4][1]); // BERGEVIN

// Buildings from params: col D(3)=name, E(4)=nbLogements
const batiments = [];
for (let i = 3; i < params.length; i++) {
  const name = params[i][3];
  const nbLog = params[i][4];
  if (name === '' || name === undefined) break;
  batiments.push({
    id: `bat_${String(name).replace(/\s+/g, '')}`,
    name: `Bâtiment ${name}`,
    nbLogements: Number(nbLog) || 0,
  });
}

// ── 2. RECAP SHEET → lots + decomp montants ──
const recapRows = XLSX.utils.sheet_to_json(wb.Sheets['Recap'], { header: 1, defval: '' });
// Headers: [?, NumLot, Lot, Type, NomDecomp, MontantDuLot, %duLot, MontantInt, %Int, MontantExt, %Ext, ...]

const lotsMap = new Map(); // numero -> { nom, montantMarche, montantExt, montantInt }
const recapDecomps = []; // { numLot, type, nomDecomp, montant }

for (let i = 1; i < recapRows.length; i++) {
  const r = recapRows[i];
  const numLot = String(r[1] || '').trim();
  const lotFullName = String(r[2] || '').trim();
  const type = String(r[3] || '').trim().toUpperCase();
  const nomDecomp = String(r[4] || '').trim();
  const montantDuLot = Number(r[5]) || 0;
  const montantInt = Number(r[7]) || 0;
  const montantExt = Number(r[9]) || 0;

  if (!numLot || !lotFullName || lotFullName.includes('Sous-total') || lotFullName.includes('TOTAL') || numLot === 'NumLot') continue;

  // Extract lot name from "1&2 -  GROS ŒUVRE  -  SECURITE ET DIVERS"
  const lotNom = lotFullName.replace(/^[\d&]+\s*-\s*/, '').trim();

  if (!lotsMap.has(numLot)) {
    lotsMap.set(numLot, { numero: numLot, nom: lotNom, montantMarche: montantDuLot, montantExt: 0, montantInt: 0 });
  }

  const decompMontant = type === 'EXT' ? montantExt : montantInt;
  const lot = lotsMap.get(numLot);
  if (type === 'EXT') lot.montantExt += decompMontant;
  else if (type === 'INT') lot.montantInt += decompMontant;

  recapDecomps.push({ numLot, type, nomDecomp, montant: decompMontant });
}

const lots = [...lotsMap.values()];

// ── 3. LOGEMENTS SHEET → INT lots + tracking ──
const logData = XLSX.utils.sheet_to_json(wb.Sheets['Logements'], { header: 1, defval: '' });
const logHeaders = logData[2];

const logementColumns = [];
for (let j = 7; j < logHeaders.length; j++) {
  const h = String(logHeaders[j]).trim();
  if (!h) continue;
  const match = h.match(/LOGEMENT\s+(\d+)\s*-\s*(\d+\w*)/);
  if (match) {
    const logNum = match[1];
    const batNum = match[2];
    const bat = batiments.find(b => b.name === `Bâtiment ${batNum}`);
    if (bat) {
      logementColumns.push({ colIndex: j, logNum, batNum, batId: bat.id, entityId: `${bat.id}_log_${logNum}` });
    }
  }
}

// Add sorted logements to each batiment
const logPerBat = new Map();
for (const col of logementColumns) {
  if (!logPerBat.has(col.batId)) logPerBat.set(col.batId, new Set());
  logPerBat.get(col.batId).add(Number(col.logNum));
}
for (const bat of batiments) {
  const logNums = logPerBat.get(bat.id);
  bat.logements = logNums ? [...logNums].sort((a, b) => a - b) : [];
}

// Parse INT tracking rows
const intDecomps = new Map();
const intLotGroups = new Map(); // lotDecomp string -> group

for (let i = 3; i < logData.length; i++) {
  const row = logData[i];
  const lotDecomp = String(row[4] || '').trim();
  const tache = String(row[5] || '').trim();
  const pond = Number(row[6]) || 1;
  if (!lotDecomp || !tache) continue;

  const lotMatch = lotDecomp.match(/^([\d&]+)\s*-\s*(.+?)\s*\(INT\)$/);
  if (!lotMatch) continue;

  const lotNumero = lotMatch[1];
  const lotNomFull = lotMatch[2].trim();
  const rowKey = `${lotDecomp}___${tache}`;

  const statuses = {};
  for (const col of logementColumns) {
    const val = String(row[col.colIndex] || '').trim().toLowerCase();
    if (val === 'x') statuses[col.entityId] = { status: 'X' };
  }

  intDecomps.set(rowKey, { lotDecomp, tache, pond, statuses });

  if (!intLotGroups.has(lotDecomp)) {
    intLotGroups.set(lotDecomp, { numero: lotNumero, nom: lotNomFull, taches: [] });
  }
  intLotGroups.get(lotDecomp).taches.push({ tache, pond });
}

// Build lotsInt with montant, nomDecomp, and trackPrefix from Recap
const lotsInt = [];
let intDecompIndex = 0;
const intLotDecompToPrefix = new Map(); // lotDecomp string -> trackPrefix

for (const [lotDecomp, group] of intLotGroups) {
  const recapMatch = recapDecomps.find(rd => rd.numLot === group.numero && rd.type === 'INT' &&
    (recapDecomps.filter(r => r.numLot === group.numero && r.type === 'INT').length === 1 ||
     group.nom.toLowerCase().includes(rd.nomDecomp.toLowerCase()) ||
     rd.nomDecomp.toLowerCase().includes(group.nom.split(' - ').pop().trim().toLowerCase())));

  const trackPrefix = `${group.numero}:d${intDecompIndex}`;
  intLotDecompToPrefix.set(lotDecomp, trackPrefix);

  const entry = {
    numero: group.numero,
    nom: group.nom,
    trackPrefix,
    decompositions: group.taches.map(t => t.tache),
  };

  if (recapMatch) {
    entry.montant = recapMatch.montant;
    if (recapMatch.nomDecomp) entry.nomDecomp = recapMatch.nomDecomp;
    recapMatch._used = true;
  }

  lotsInt.push(entry);
  intDecompIndex++;
}

// Build INT tracking (using trackPrefix to avoid key collisions)
const trackingLogements = {};
for (const [rowKey, data] of intDecomps) {
  const prefix = intLotDecompToPrefix.get(data.lotDecomp);
  if (!prefix) continue;
  const trackKey = `${prefix}-${data.tache}`;
  trackingLogements[trackKey] = { ...data.statuses, _tache: data.tache, _ponderation: data.pond };
}

// ── 4. BATIMENTS SHEET → EXT lots + tracking ──
const batData = XLSX.utils.sheet_to_json(wb.Sheets['Batiments'], { header: 1, defval: '' });
const batHeaders = batData[0];

const buildingColumns = [];
for (let j = 7; j < batHeaders.length; j++) {
  const h = String(batHeaders[j]).trim();
  if (!h) continue;
  const bat = batiments.find(b => b.name === `Bâtiment ${h}`);
  if (bat) buildingColumns.push({ colIndex: j, batNum: h, batId: bat.id });
}

const extDecomps = new Map();
const extLotGroups = new Map();

for (let i = 1; i < batData.length; i++) {
  const row = batData[i];
  const lotDecomp = String(row[4] || '').trim();
  const tache = String(row[5] || '').trim();
  const pond = Number(row[6]) || 1;
  if (!lotDecomp || !tache) continue;

  const lotMatch = lotDecomp.match(/^([\d&]+)\s*-\s*(.+?)\s*\(EXT\)$/);
  if (!lotMatch) continue;

  const lotNumero = lotMatch[1];
  const lotNomFull = lotMatch[2].trim();
  const rowKey = `${lotDecomp}___${tache}`;

  const statuses = {};
  for (const col of buildingColumns) {
    const val = String(row[col.colIndex] || '').trim().toLowerCase();
    if (val === 'x') statuses[col.batId] = { status: 'X' };
  }

  extDecomps.set(rowKey, { lotDecomp, tache, pond, statuses });

  if (!extLotGroups.has(lotDecomp)) {
    extLotGroups.set(lotDecomp, { numero: lotNumero, nom: lotNomFull, taches: [] });
  }
  extLotGroups.get(lotDecomp).taches.push({ tache, pond });
}

// Build lotsExt with montant, nomDecomp, and trackPrefix from Recap
const lotsExt = [];
let extDecompIndex = 0;
const extLotDecompToPrefix = new Map(); // lotDecomp string -> trackPrefix

for (const [lotDecomp, group] of extLotGroups) {
  const recapMatch = recapDecomps.find(rd => rd.numLot === group.numero && rd.type === 'EXT' && !rd._used &&
    (recapDecomps.filter(r => r.numLot === group.numero && r.type === 'EXT' && !r._used).length === 1 ||
     group.nom.toLowerCase().includes(rd.nomDecomp.toLowerCase()) ||
     rd.nomDecomp.toLowerCase().includes(group.nom.split(' - ').pop().trim().toLowerCase())));

  const trackPrefix = `${group.numero}:d${extDecompIndex}`;
  extLotDecompToPrefix.set(lotDecomp, trackPrefix);

  const entry = {
    numero: group.numero,
    nom: group.nom,
    trackPrefix,
    decompositions: group.taches.map(t => t.tache),
  };

  if (recapMatch) {
    entry.montant = recapMatch.montant;
    if (recapMatch.nomDecomp) entry.nomDecomp = recapMatch.nomDecomp;
    recapMatch._used = true;
  }

  lotsExt.push(entry);
  extDecompIndex++;
}

// Build EXT tracking (using trackPrefix to avoid key collisions)
const trackingBatiments = {};
for (const [rowKey, data] of extDecomps) {
  const prefix = extLotDecompToPrefix.get(data.lotDecomp);
  if (!prefix) continue;
  const trackKey = `${prefix}-${data.tache}`;
  trackingBatiments[trackKey] = { ...data.statuses, _tache: data.tache, _ponderation: data.pond };
}

// ── 5. Build final project ──
const project = {
  id: 'bergevin_001',
  name: `Chantier ${projectName}`,
  location: 'Guadeloupe',
  client: '',
  createdAt: new Date().toISOString(),
  batiments,
  lots,
  lotsInt,
  lotsExt,
  tracking: {
    logements: trackingLogements,
    batiments: trackingBatiments,
  },
};

const db = { projects: [project], activeProjectId: null };

// Write output
const outputPath = path.join(__dirname, 'src', 'initialData.json');
fs.writeFileSync(outputPath, JSON.stringify(db, null, 2));

console.log('=== SUMMARY ===');
console.log(`Project: ${project.name}`);
console.log(`Batiments: ${batiments.length}`);
console.log(`Total logements: ${batiments.reduce((s, b) => s + (b.logements?.length || 0), 0)}`);
console.log(`Logement columns: ${logementColumns.length}`);
console.log(`Building columns: ${buildingColumns.length}`);
console.log(`Lots (unified): ${lots.length}`);
console.log(`Lots INT: ${lotsInt.length}`);
console.log(`Lots EXT: ${lotsExt.length}`);
console.log(`INT tracking rows: ${Object.keys(trackingLogements).length}`);
console.log(`EXT tracking rows: ${Object.keys(trackingBatiments).length}`);

// Verify montant assignment
console.log('\n=== MONTANT VERIFICATION ===');
for (const l of lotsInt) {
  console.log(`  INT ${l.numero} - ${l.nom}: montant=${l.montant || 'MISSING'}, nomDecomp=${l.nomDecomp || '-'}`);
}
for (const l of lotsExt) {
  console.log(`  EXT ${l.numero} - ${l.nom}: montant=${l.montant || 'MISSING'}, nomDecomp=${l.nomDecomp || '-'}`);
}

// Verify tracking data counts
let intXCount = 0;
for (const val of Object.values(trackingLogements)) {
  for (const [k, v] of Object.entries(val)) {
    if (k.startsWith('bat_') && v?.status === 'X') intXCount++;
  }
}
let extXCount = 0;
for (const val of Object.values(trackingBatiments)) {
  for (const [k, v] of Object.entries(val)) {
    if (k.startsWith('bat_') && v?.status === 'X') extXCount++;
  }
}
console.log(`\nINT 'X' entries: ${intXCount}`);
console.log(`EXT 'X' entries: ${extXCount}`);
console.log(`\nWritten to: ${outputPath}`);
