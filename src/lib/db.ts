import initialData from "../initialData.json";
import type { Project, DB, Batiment } from "../types";

// ─── DATA LAYER ──────────────────────────────────────────────────────────────
const DB_KEY = "construction_tracker_v1";
const BACKUP_KEY = "construction_tracker_backup";

function migrateProject(p: any): Project {
  const seed = initialData.projects.find((s) => s.id === p.id);

  // Only create lots array if it doesn't exist at all
  if (!p.lots) {
    if (seed && seed.lots) {
      p.lots = JSON.parse(JSON.stringify(seed.lots));
    } else {
      const numeros = new Set<string>();
      [...(p.lotsInt || []), ...(p.lotsExt || [])].forEach((l: any) => numeros.add(l.numero));
      p.lots = [...numeros].map((num) => {
        const intLots = (p.lotsInt || []).filter((l: any) => l.numero === num);
        const extLots = (p.lotsExt || []).filter((l: any) => l.numero === num);
        const nom = (intLots[0] || extLots[0] || {}).nom || "";
        return { numero: num, nom, montantMarche: 0, montantExt: 0, montantInt: 0 };
      });
    }
  }

  // Only seed lotsExt/lotsInt if completely missing
  if (seed) {
    if (!p.lotsExt && seed.lotsExt) {
      p.lotsExt = JSON.parse(JSON.stringify(seed.lotsExt));
    }
    if (!p.lotsInt && seed.lotsInt) {
      p.lotsInt = JSON.parse(JSON.stringify(seed.lotsInt));
    }
  }

  const def = (field: string, fallback: any) => {
    if (p[field] === undefined) p[field] = (seed as any)?.[field] ?? fallback;
  };
  def("montantTotal", 0); def("dateDebutChantier", ""); def("dureeTotale", 0);
  def("montantExt", 0); def("montantInt", 0);
  def("dureeExt", 0); def("dureeInt", 0);
  def("dateDebutInt", ""); def("dateDebutExt", "");
  def("semainesExclues", 0); def("semainesTravaillees", 0);
  return p as Project;
}

export function loadDB(): DB {
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    if (raw && raw.projects) {
      // Accept empty projects array — user may have deleted all projects
      raw.projects = raw.projects.map(migrateProject);
      return raw;
    }
    // No data in localStorage — try backup before falling back to initialData
    const backup = tryRestoreBackup();
    if (backup) return backup;
    const data = JSON.parse(JSON.stringify(initialData));
    data.projects = data.projects.map(migrateProject);
    saveDB(data);
    return data;
  } catch (err) {
    console.error("[DB] localStorage parse failed, trying backup:", err);
    // Corrupted JSON — try backup before falling back to initialData
    const backup = tryRestoreBackup();
    if (backup) return backup;
    const data = JSON.parse(JSON.stringify(initialData));
    data.projects = data.projects.map(migrateProject);
    saveDB(data);
    return data;
  }
}

function tryRestoreBackup(): DB | null {
  try {
    const backupRaw = localStorage.getItem(BACKUP_KEY);
    if (!backupRaw) return null;
    const backup = JSON.parse(backupRaw);
    if (backup?.projects) {
      console.warn("[DB] Restored from backup");
      backup.projects = backup.projects.map(migrateProject);
      saveDB(backup); // Write restored data back to main key
      return backup;
    }
  } catch {}
  return null;
}

export function saveDB(db: DB): void {
  const withTimestamp = { ...db, _lastModified: Date.now() };
  localStorage.setItem(DB_KEY, JSON.stringify(withTimestamp));
}

export function getLocalTimestamp(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
    return raw._lastModified || 0;
  } catch {
    return 0;
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getLogementNums(bat: Batiment): number[] {
  if (bat.logements && bat.logements.length > 0) return bat.logements;
  return Array.from({ length: bat.nbLogements || 0 }, (_, i) => i + 1);
}

export { migrateProject };
