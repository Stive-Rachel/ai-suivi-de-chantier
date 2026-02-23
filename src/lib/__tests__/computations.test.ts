import { describe, it, expect } from 'vitest';
import { computeProjectProgress, computeDetailedProgress, calcEntityProgress } from '../computations';
import type { Project, LotDecomp } from '../../types';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "test_001",
    name: "Test Project",
    location: "Test",
    client: "",
    createdAt: "2026-01-01T00:00:00Z",
    montantTotal: 100000,
    montantExt: 40000,
    montantInt: 60000,
    dateDebutChantier: "2026-01-01",
    dureeTotale: 10,
    dureeExt: 10,
    dureeInt: 10,
    dateDebutInt: "2026-01-01",
    dateDebutExt: "2026-01-01",
    semainesExclues: 0,
    semainesTravaillees: 0,
    batiments: [
      { id: "bat_1", name: "Bâtiment 1", nbLogements: 2, logements: [101, 102] },
    ],
    lots: [
      { numero: "1", nom: "GROS OEUVRE", montantMarche: 100000, montantExt: 40000, montantInt: 60000 },
    ],
    lotsInt: [
      { numero: "1", nom: "GROS OEUVRE", decompositions: ["Fondations", "Élévation"], montant: 60000 },
    ],
    lotsExt: [
      { numero: "1", nom: "GROS OEUVRE", decompositions: ["Fondations"], montant: 40000 },
    ],
    tracking: { logements: {}, batiments: {} },
    ...overrides,
  };
}

describe('computeProjectProgress', () => {
  it('returns 0 for empty project with no tracking', () => {
    const project = makeProject();
    expect(computeProjectProgress(project)).toBe(0);
  });

  it('returns 0 when no lots have montantMarche', () => {
    const project = makeProject({
      lots: [{ numero: "1", nom: "GO", montantMarche: 0, montantExt: 0, montantInt: 0 }],
    });
    expect(computeProjectProgress(project)).toBe(0);
  });

  it('calculates progress correctly when all cells done', () => {
    const project = makeProject({
      tracking: {
        logements: {
          "1-Fondations": {
            "bat_1_log_101": { status: "X" },
            "bat_1_log_102": { status: "X" },
          },
          "1-Élévation": {
            "bat_1_log_101": { status: "X" },
            "bat_1_log_102": { status: "X" },
          },
        },
        batiments: {
          "1-Fondations": {
            "bat_1": { status: "X" },
          },
        },
      },
    });
    const progress = computeProjectProgress(project);
    expect(progress).toBe(100);
  });

  it('calculates partial progress', () => {
    const project = makeProject({
      tracking: {
        logements: {
          "1-Fondations": {
            "bat_1_log_101": { status: "X" },
            "bat_1_log_102": { status: "" },
          },
          "1-Élévation": {},
        },
        batiments: {},
      },
    });
    const progress = computeProjectProgress(project);
    // INT: 1 done out of 4 cells (2 decomps x 2 logements) = 25% * (60000/100000) = 15
    // EXT: 0 done out of 1 cell = 0%
    expect(progress).toBeCloseTo(15, 0);
  });
});

describe('computeDetailedProgress', () => {
  it('returns empty arrays for project with no batiments', () => {
    const project = makeProject({ batiments: [] });
    const result = computeDetailedProgress(project);
    expect(result.lotProgressInt).toEqual([]);
    expect(result.lotProgressExt).toEqual([]);
    expect(result.batimentProgress).toEqual([]);
  });

  it('computes batiment progress', () => {
    const project = makeProject({
      tracking: {
        logements: {
          "1-Fondations": {
            "bat_1_log_101": { status: "X" },
            "bat_1_log_102": { status: "X" },
          },
          "1-Élévation": {
            "bat_1_log_101": { status: "X" },
            "bat_1_log_102": { status: "X" },
          },
        },
        batiments: {
          "1-Fondations": {
            "bat_1": { status: "X" },
          },
        },
      },
    });
    const result = computeDetailedProgress(project);
    expect(result.batimentProgress).toHaveLength(1);
    expect(result.batimentProgress[0].name).toBe("Bâtiment 1");
    expect(result.batimentProgress[0].int).toBe(100);
    expect(result.batimentProgress[0].ext).toBe(100);
  });

  it('respects ponderation weights', () => {
    const project = makeProject({
      tracking: {
        logements: {
          "1-Fondations": {
            _ponderation: 3,
            "bat_1_log_101": { status: "X" },
            "bat_1_log_102": { status: "X" },
          },
          "1-Élévation": {
            _ponderation: 1,
          },
        },
        batiments: {},
      },
    });
    const result = computeDetailedProgress(project);
    // Fondations: pond=3, 2/2 done = 100% weighted by 3
    // Élévation: pond=1, 0/2 done = 0% weighted by 1
    // Total: (3*2 + 0) / (3*2 + 1*2) = 6/8 = 75%
    expect(result.lotProgressInt[0].progress).toBe(75);
  });
});

describe('calcEntityProgress', () => {
  it('returns 0 for empty entities', () => {
    const lots: LotDecomp[] = [{ numero: "1", nom: "GO", decompositions: ["A"], montant: 100 }];
    expect(calcEntityProgress(lots, "logements", [], undefined)).toBe(0);
  });

  it('calculates single entity progress', () => {
    const lots: LotDecomp[] = [
      { numero: "1", nom: "GO", decompositions: ["A", "B"], montant: 100 },
    ];
    const tracking = {
      logements: {
        "1-A": { "e1": { status: "X" } },
        "1-B": {},
      },
      batiments: {},
    };
    const progress = calcEntityProgress(lots, "logements", ["e1"], tracking as any);
    // 1 done out of 2 decomps = 50%
    expect(progress).toBe(50);
  });
});
