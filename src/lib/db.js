import initialData from "../initialData.json";

// ─── DATA LAYER ──────────────────────────────────────────────────────────────
const DB_KEY = "construction_tracker_v1";

function migrateProject(p) {
  const seed = initialData.projects.find((s) => s.id === p.id);

  if (!p.lots) {
    if (seed && seed.lots) {
      p.lots = JSON.parse(JSON.stringify(seed.lots));
    } else {
      const numeros = new Set();
      [...(p.lotsInt || []), ...(p.lotsExt || [])].forEach((l) => numeros.add(l.numero));
      p.lots = [...numeros].map((num) => {
        const intLots = (p.lotsInt || []).filter((l) => l.numero === num);
        const extLots = (p.lotsExt || []).filter((l) => l.numero === num);
        const nom = (intLots[0] || extLots[0] || {}).nom || "";
        return { numero: num, nom, montantMarche: 0, montantExt: 0, montantInt: 0 };
      });
    }
  }
  if (seed && seed.lots && p.lots.every((l) => !l.montantMarche && !l.montantExt && !l.montantInt)) {
    p.lots = JSON.parse(JSON.stringify(seed.lots));
  }
  if (seed) {
    const needsSync = (arr) => !arr || arr.length === 0 || arr.some((l) => l.montant === undefined);
    if (seed.lotsExt && needsSync(p.lotsExt)) {
      p.lotsExt = JSON.parse(JSON.stringify(seed.lotsExt));
    }
    if (seed.lotsInt && needsSync(p.lotsInt)) {
      p.lotsInt = JSON.parse(JSON.stringify(seed.lotsInt));
    }
  }
  const def = (field, fallback) => {
    if (p[field] === undefined || (p[field] === 0 && seed?.[field])) p[field] = seed?.[field] ?? fallback;
  };
  def("montantTotal", 0); def("dateDebutChantier", ""); def("dureeTotale", 0);
  def("montantExt", 0); def("montantInt", 0);
  def("dureeExt", 0); def("dureeInt", 0);
  def("dateDebutInt", ""); def("dateDebutExt", "");
  def("semainesExclues", 0); def("semainesTravaillees", 0);
  return p;
}

export function loadDB() {
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    if (raw && raw.projects && raw.projects.length > 0) {
      raw.projects = raw.projects.map(migrateProject);
      return raw;
    }
    const data = JSON.parse(JSON.stringify(initialData));
    data.projects = data.projects.map(migrateProject);
    saveDB(data);
    return data;
  } catch {
    const data = JSON.parse(JSON.stringify(initialData));
    data.projects = data.projects.map(migrateProject);
    saveDB(data);
    return data;
  }
}

export function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getLogementNums(bat) {
  if (bat.logements && bat.logements.length > 0) return bat.logements;
  return Array.from({ length: bat.nbLogements || 0 }, (_, i) => i + 1);
}

export { migrateProject };
