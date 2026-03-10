import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDB, saveDB, getLocalTimestamp, generateId, getLogementNums, migrateProject } from "../db";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("db module", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("loadDB()", () => {
    it("returns initial data when localStorage is empty", () => {
      const db = loadDB();
      expect(db).toBeDefined();
      expect(db.projects).toBeDefined();
      expect(Array.isArray(db.projects)).toBe(true);
      expect(db.projects.length).toBeGreaterThan(0);
    });

    it("returns saved data from localStorage when available", () => {
      const testData = {
        projects: [
          {
            id: "test_1",
            name: "Test Project",
            montantTotal: 100,
            dateDebutChantier: "",
            dureeTotale: 0,
            montantExt: 0,
            montantInt: 0,
            dureeExt: 0,
            dureeInt: 0,
            dateDebutInt: "",
            dateDebutExt: "",
            semainesExclues: 0,
            semainesTravaillees: 0,
            batiments: [],
            lots: [],
            lotsInt: [],
            lotsExt: [],
            tracking: { logements: {}, batiments: {} },
          },
        ],
      };
      localStorageMock.setItem("construction_tracker_v1", JSON.stringify(testData));

      const db = loadDB();
      expect(db.projects).toHaveLength(1);
      expect(db.projects[0].name).toBe("Test Project");
    });

    it("falls back to initialData when localStorage has corrupted JSON", () => {
      localStorageMock.setItem("construction_tracker_v1", "not valid json{{{");

      const db = loadDB();
      expect(db).toBeDefined();
      expect(Array.isArray(db.projects)).toBe(true);
    });
  });

  describe("saveDB()", () => {
    it("saves data with timestamp to localStorage", () => {
      const db = { projects: [] };
      saveDB(db);

      const saved = JSON.parse(localStorageMock.getItem("construction_tracker_v1")!);
      expect(saved.projects).toEqual([]);
      expect(saved._lastModified).toBeDefined();
      expect(typeof saved._lastModified).toBe("number");
    });

    it("refuses to save invalid data", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      saveDB(null as any);
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        "construction_tracker_v1",
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });

    it("refuses to save data without projects array", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      saveDB({ projects: "not an array" } as any);
      consoleSpy.mockRestore();
    });
  });

  describe("getLocalTimestamp()", () => {
    it("returns 0 when no data exists", () => {
      expect(getLocalTimestamp()).toBe(0);
    });

    it("returns the timestamp from saved data", () => {
      const now = Date.now();
      localStorageMock.setItem(
        "construction_tracker_v1",
        JSON.stringify({ projects: [], _lastModified: now })
      );
      expect(getLocalTimestamp()).toBe(now);
    });

    it("returns 0 when localStorage has corrupted data", () => {
      localStorageMock.setItem("construction_tracker_v1", "invalid");
      expect(getLocalTimestamp()).toBe(0);
    });
  });

  describe("generateId()", () => {
    it("returns a string", () => {
      const id = generateId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("returns unique IDs on successive calls", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("getLogementNums()", () => {
    it("returns logements array when available", () => {
      const bat = { id: "b1", name: "B1", nbLogements: 3, logements: [101, 102, 103] };
      expect(getLogementNums(bat)).toEqual([101, 102, 103]);
    });

    it("generates sequence from nbLogements when logements is empty", () => {
      const bat = { id: "b1", name: "B1", nbLogements: 3, logements: [] };
      expect(getLogementNums(bat)).toEqual([1, 2, 3]);
    });

    it("generates sequence from nbLogements when logements is undefined", () => {
      const bat = { id: "b1", name: "B1", nbLogements: 4 } as any;
      expect(getLogementNums(bat)).toEqual([1, 2, 3, 4]);
    });

    it("returns empty array when nbLogements is 0 and no logements", () => {
      const bat = { id: "b1", name: "B1", nbLogements: 0 } as any;
      expect(getLogementNums(bat)).toEqual([]);
    });
  });

  describe("migrateProject()", () => {
    it("fills missing fields with defaults", () => {
      const project = { id: "unknown_id", name: "New", lots: [] };
      const migrated = migrateProject(project);

      expect(migrated.montantTotal).toBe(0);
      expect(migrated.dateDebutChantier).toBe("");
      expect(migrated.dureeTotale).toBe(0);
      expect(migrated.montantExt).toBe(0);
      expect(migrated.montantInt).toBe(0);
      expect(migrated.dureeExt).toBe(0);
      expect(migrated.dureeInt).toBe(0);
      expect(migrated.dateDebutInt).toBe("");
      expect(migrated.dateDebutExt).toBe("");
      expect(migrated.semainesExclues).toBe(0);
      expect(migrated.semainesTravaillees).toBe(0);
    });

    it("preserves existing fields", () => {
      const project = {
        id: "unknown_id",
        name: "Existing",
        montantTotal: 5000,
        lots: [{ numero: "1", nom: "Test" }],
      };
      const migrated = migrateProject(project);
      expect(migrated.montantTotal).toBe(5000);
      expect(migrated.lots).toHaveLength(1);
    });

    it("creates lots from lotsInt and lotsExt when lots is missing", () => {
      const project = {
        id: "unknown_id",
        name: "No lots",
        lotsInt: [{ numero: "1", nom: "Interior" }],
        lotsExt: [{ numero: "2", nom: "Exterior" }],
      };
      const migrated = migrateProject(project);
      expect(migrated.lots).toBeDefined();
      expect(migrated.lots.length).toBeGreaterThanOrEqual(2);
    });
  });
});
