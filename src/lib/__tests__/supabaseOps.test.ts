import { describe, it, expect } from "vitest";
import {
  projectToRow,
  rowToProject,
  batimentToRow,
  lotToRow,
  lotDecompToRow,
  trackingToRows,
  rowsToTracking,
} from "../supabaseOps";

describe("supabaseOps", () => {
  describe("projectToRow() / rowToProject() round-trip", () => {
    it("converts project to row with correct field mapping", () => {
      const project = {
        id: "p1",
        name: "Test Project",
        location: "Paris",
        client: "Client A",
        createdAt: "2026-01-01T00:00:00Z",
        montantTotal: 100000,
        montantExt: 40000,
        montantInt: 60000,
        dateDebutChantier: "2026-02-01",
        dureeTotale: 12,
        dureeExt: 6,
        dureeInt: 8,
        dateDebutInt: "2026-03-01",
        dateDebutExt: "2026-04-01",
        semainesExclues: 2,
        semainesTravaillees: 10,
        exceptions: {},
        planningLogements: [],
      };

      const row = projectToRow(project, "user123");

      expect(row.id).toBe("p1");
      expect(row.name).toBe("Test Project");
      expect(row.location).toBe("Paris");
      expect(row.client).toBe("Client A");
      expect(row.created_at).toBe("2026-01-01T00:00:00Z");
      expect(row.montant_total).toBe(100000);
      expect(row.montant_ext).toBe(40000);
      expect(row.montant_int).toBe(60000);
      expect(row.date_debut_chantier).toBe("2026-02-01");
      expect(row.duree_totale).toBe(12);
      expect(row.duree_ext).toBe(6);
      expect(row.duree_int).toBe(8);
      expect(row.date_debut_int).toBe("2026-03-01");
      expect(row.date_debut_ext).toBe("2026-04-01");
      expect(row.semaines_exclues).toBe(2);
      expect(row.semaines_travaillees).toBe(10);
      expect(row.user_id).toBe("user123");
    });

    it("round-trips project through row and back", () => {
      const original = {
        id: "p1",
        name: "Round Trip",
        location: "Lyon",
        client: "Client B",
        createdAt: "2026-01-15T10:00:00Z",
        montantTotal: 50000,
        montantExt: 20000,
        montantInt: 30000,
        dateDebutChantier: "2026-03-01",
        dureeTotale: 8,
        dureeExt: 4,
        dureeInt: 6,
        dateDebutInt: "2026-04-01",
        dateDebutExt: "2026-05-01",
        semainesExclues: 1,
        semainesTravaillees: 7,
        exceptions: {},
        planningLogements: [],
      };

      const row = projectToRow(original, "u1");
      const restored = rowToProject(row, [], [], [], { logements: {}, batiments: {} });

      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.location).toBe(original.location);
      expect(restored.montantTotal).toBe(original.montantTotal);
      expect(restored.montantExt).toBe(original.montantExt);
      expect(restored.montantInt).toBe(original.montantInt);
      expect(restored.dureeTotale).toBe(original.dureeTotale);
    });
  });

  describe("batimentToRow()", () => {
    it("maps batiment fields correctly", () => {
      const bat = { id: "bat_1", name: "Building A", nbLogements: 10, logements: [1, 2, 3] };
      const row = batimentToRow(bat, "proj_1", 0);

      expect(row.id).toBe("bat_1");
      expect(row.project_id).toBe("proj_1");
      expect(row.name).toBe("Building A");
      expect(row.nb_logements).toBe(10);
      expect(row.logements).toEqual([1, 2, 3]);
      expect(row.sort_order).toBe(0);
    });

    it("defaults missing fields", () => {
      const bat = { id: "bat_2", name: "B2" };
      const row = batimentToRow(bat, "proj_1", 3);

      expect(row.nb_logements).toBe(0);
      expect(row.logements).toEqual([]);
      expect(row.sort_order).toBe(3);
    });
  });

  describe("lotToRow()", () => {
    it("maps lot fields correctly", () => {
      const lot = { numero: "1", nom: "GROS OEUVRE", montantMarche: 50000, montantExt: 20000, montantInt: 30000 };
      const row = lotToRow(lot, "proj_1", 0);

      expect(row.project_id).toBe("proj_1");
      expect(row.numero).toBe("1");
      expect(row.nom).toBe("GROS OEUVRE");
      expect(row.montant_marche).toBe(50000);
      expect(row.montant_ext).toBe(20000);
      expect(row.montant_int).toBe(30000);
      expect(row.sort_order).toBe(0);
    });

    it("defaults missing amounts to 0", () => {
      const lot = { numero: "2", nom: "Lot 2" };
      const row = lotToRow(lot, "proj_1", 1);

      expect(row.montant_marche).toBe(0);
      expect(row.montant_ext).toBe(0);
      expect(row.montant_int).toBe(0);
    });
  });

  describe("lotDecompToRow()", () => {
    it("maps lotDecomp fields correctly", () => {
      const lot = {
        numero: "1",
        nom: "GROS OEUVRE",
        nomDecomp: "Fondations",
        trackPrefix: "1_fondations",
        decompositions: ["A", "B"],
        montant: 10000,
      };
      const row = lotDecompToRow(lot, "int", "proj_1", 0);

      expect(row.project_id).toBe("proj_1");
      expect(row.type).toBe("int");
      expect(row.numero).toBe("1");
      expect(row.nom).toBe("GROS OEUVRE");
      expect(row.nom_decomp).toBe("Fondations");
      expect(row.track_prefix).toBe("1_fondations");
      expect(row.decompositions).toEqual(["A", "B"]);
      expect(row.montant).toBe(10000);
      expect(row.sort_order).toBe(0);
    });

    it("falls back to numero for track_prefix when not set", () => {
      const lot = { numero: "3", nom: "Test" };
      const row = lotDecompToRow(lot, "ext", "proj_1", 2);

      expect(row.track_prefix).toBe("3");
    });
  });

  describe("trackingToRows() / rowsToTracking()", () => {
    it("converts tracking data to rows and back", () => {
      const tracking = {
        logements: {
          "row_1": {
            _ponderation: 2,
            _tache: "Task A",
            "entity_1": { status: "X" },
            "entity_2": { status: "!" },
          },
        },
        batiments: {
          "row_2": {
            _ponderation: 1,
            "entity_3": { status: "NOK" },
          },
        },
      };

      const { cells, meta } = trackingToRows("proj_1", tracking);

      // Check cells
      expect(cells).toHaveLength(3);
      const cell1 = cells.find((c) => c.entity_id === "entity_1");
      expect(cell1).toBeDefined();
      expect(cell1!.status).toBe("X");
      expect(cell1!.track_type).toBe("logements");
      expect(cell1!.row_key).toBe("row_1");

      // Check meta
      expect(meta).toHaveLength(2);
      const meta1 = meta.find((m) => m.row_key === "row_1");
      expect(meta1).toBeDefined();
      expect(meta1!.ponderation).toBe(2);
      expect(meta1!.tache).toBe("Task A");

      // Round-trip
      const restored = rowsToTracking(cells, meta);
      expect(restored.logements.row_1.entity_1).toEqual({ status: "X" });
      expect(restored.logements.row_1.entity_2).toEqual({ status: "!" });
      expect(restored.logements.row_1._ponderation).toBe(2);
      expect(restored.logements.row_1._tache).toBe("Task A");
      expect(restored.batiments.row_2.entity_3).toEqual({ status: "NOK" });
    });

    it("handles empty tracking data", () => {
      const { cells, meta } = trackingToRows("proj_1", {});
      expect(cells).toHaveLength(0);
      expect(meta).toHaveLength(0);
    });

    it("handles null tracking data", () => {
      const { cells, meta } = trackingToRows("proj_1", null);
      expect(cells).toHaveLength(0);
      expect(meta).toHaveLength(0);
    });

    it("rowsToTracking initializes default structure", () => {
      const result = rowsToTracking([], []);
      expect(result).toEqual({ logements: {}, batiments: {} });
    });
  });
});
