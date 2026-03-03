import { describe, it, expect } from 'vitest';
import { computeProjectProgress, computeDetailedProgress, calcEntityProgress, countExceptions, getLogementCounts } from '../computations';
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

describe('exceptions', () => {
  it('excludes exception logements from INT progress', () => {
    // 2 logements: 101 and 102. Mark 102 as exception.
    // Only log 101 is done for all decomps -> should be 100% INT
    const project = makeProject({
      exceptions: { "bat_1_log_102": true },
      tracking: {
        logements: {
          "1-Fondations": {
            "bat_1_log_101": { status: "X" },
            // bat_1_log_102 not done, but it's excluded
          },
          "1-Élévation": {
            "bat_1_log_101": { status: "X" },
          },
        },
        batiments: {
          "1-Fondations": {
            "bat_1": { status: "X" },
          },
        },
      },
    });

    const { lotProgressInt, batimentProgress } = computeDetailedProgress(project);
    // Only 1 active logement (101), all decomps done -> 100%
    expect(lotProgressInt[0].progress).toBe(100);
    // Batiment INT should be 100%
    expect(batimentProgress[0].int).toBe(100);
    // EXT should also be 100% (not affected by logement exceptions)
    expect(batimentProgress[0].ext).toBe(100);
  });

  it('project reaches 100% when all non-exception logements are done', () => {
    const project = makeProject({
      exceptions: { "bat_1_log_102": true },
      tracking: {
        logements: {
          "1-Fondations": {
            "bat_1_log_101": { status: "X" },
          },
          "1-Élévation": {
            "bat_1_log_101": { status: "X" },
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

  it('calculates partial progress correctly with exceptions', () => {
    const project = makeProject({
      exceptions: { "bat_1_log_102": true },
      tracking: {
        logements: {
          "1-Fondations": {
            "bat_1_log_101": { status: "X" },
          },
          "1-Élévation": {
            // log 101 not done for this decomp
          },
        },
        batiments: {},
      },
    });

    const { lotProgressInt } = computeDetailedProgress(project);
    // 1 active logement (101), 1/2 decomps done = 50%
    expect(lotProgressInt[0].progress).toBe(50);
  });

  it('empty exceptions map has no effect', () => {
    const project = makeProject({
      exceptions: {},
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

    const projectWithout = makeProject({
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

    expect(computeProjectProgress(project)).toBe(computeProjectProgress(projectWithout));
  });

  it('countExceptions counts total exceptions', () => {
    const project = makeProject({
      exceptions: {
        "bat_1_log_101": true,
        "bat_1_log_102": true,
      },
    });
    expect(countExceptions(project)).toBe(2);
  });

  it('countExceptions counts by batiment', () => {
    const project = makeProject({
      batiments: [
        { id: "bat_1", name: "Bât 1", nbLogements: 2, logements: [101, 102] },
        { id: "bat_2", name: "Bât 2", nbLogements: 2, logements: [201, 202] },
      ],
      exceptions: {
        "bat_1_log_101": true,
        "bat_2_log_201": true,
        "bat_2_log_202": true,
      },
    });
    expect(countExceptions(project, "bat_1")).toBe(1);
    expect(countExceptions(project, "bat_2")).toBe(2);
  });

  it('getLogementCounts returns correct totals', () => {
    const project = makeProject({
      exceptions: { "bat_1_log_102": true },
    });
    const counts = getLogementCounts(project);
    expect(counts.total).toBe(2);
    expect(counts.active).toBe(1);
    expect(counts.exceptions).toBe(1);
  });
});
