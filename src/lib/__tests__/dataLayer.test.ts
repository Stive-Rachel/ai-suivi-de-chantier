import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseClient before importing dataLayer
vi.mock("../supabaseClient", () => ({
  isSupabaseConfigured: vi.fn(() => false),
  supabase: null,
}));

// Mock syncQueue
vi.mock("../syncQueue", () => ({
  enqueue: vi.fn(),
}));

import {
  withRetry,
  loadAllProjects,
  createProjectInDB,
  deleteProjectFromDB,
  updateProjectFields,
  syncBatiments,
  syncLots,
  syncLotsDecomp,
  setTrackingCell,
  setTrackingMeta,
  fullProjectSync,
  replayOperation,
} from "../dataLayer";
import { isSupabaseConfigured } from "../supabaseClient";
import { enqueue } from "../syncQueue";

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

describe("dataLayer", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("withRetry()", () => {
    it("succeeds on first try", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const result = await withRetry(fn);

      expect(result).toEqual({ ok: true });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("succeeds on retry after first failure", async () => {
      vi.useFakeTimers();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("first fail"))
        .mockResolvedValueOnce(undefined);

      vi.spyOn(console, "warn").mockImplementation(() => {});
      const promise = withRetry(fn);
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result).toEqual({ ok: true });
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it("fails after both attempts fail", async () => {
      vi.useFakeTimers();
      const error = new Error("persistent error");
      const fn = vi.fn().mockRejectedValue(error);

      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      const promise = withRetry(fn);
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe("loadAllProjects()", () => {
    it("returns localStorage data when Supabase is not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const projects = await loadAllProjects();
      expect(Array.isArray(projects)).toBe(true);
      // Should load from localStorage / initialData
      expect(projects.length).toBeGreaterThan(0);
    });
  });

  describe("createProjectInDB() - local mode", () => {
    it("adds project to localStorage when Supabase is not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const project = {
        id: "new_project",
        name: "New Project",
        batiments: [],
        lots: [],
        lotsInt: [],
        lotsExt: [],
        tracking: { logements: {}, batiments: {} },
      };

      await createProjectInDB(project, "user1");

      const stored = JSON.parse(localStorageMock.getItem("construction_tracker_v1")!);
      const found = stored.projects.find((p: any) => p.id === "new_project");
      expect(found).toBeDefined();
      expect(found.name).toBe("New Project");
    });
  });

  describe("deleteProjectFromDB() - local mode", () => {
    it("removes project from localStorage when Supabase is not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const project = {
        id: "to_delete",
        name: "To Delete",
        batiments: [],
        lots: [],
        lotsInt: [],
        lotsExt: [],
        tracking: { logements: {}, batiments: {} },
      };

      await createProjectInDB(project, "user1");
      let stored = JSON.parse(localStorageMock.getItem("construction_tracker_v1")!);
      expect(stored.projects.some((p: any) => p.id === "to_delete")).toBe(true);

      await deleteProjectFromDB("to_delete");
      stored = JSON.parse(localStorageMock.getItem("construction_tracker_v1")!);
      expect(stored.projects.some((p: any) => p.id === "to_delete")).toBe(false);
    });
  });

  describe("local mode - early returns", () => {
    it("updateProjectFields returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await updateProjectFields("proj_1", { name: "Updated" });
    });

    it("syncBatiments returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await syncBatiments("proj_1", []);
    });

    it("syncLots returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await syncLots("proj_1", []);
    });

    it("syncLotsDecomp returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await syncLotsDecomp("proj_1", [], []);
    });

    it("setTrackingCell returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await setTrackingCell("proj_1", "logements", "row1", "e1", "X");
    });

    it("setTrackingMeta returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await setTrackingMeta("proj_1", "logements", "row1", { ponderation: 2 });
    });

    it("fullProjectSync returns immediately when not configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      await fullProjectSync({ id: "p1" }, "user1");
    });
  });

  describe("offline enqueue behavior", () => {
    it("deleteProjectFromDB enqueues when offline and Supabase configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await deleteProjectFromDB("proj_offline");
      expect(enqueue).toHaveBeenCalledWith({ type: "deleteProjectFromDB", args: ["proj_offline"] });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });

    it("updateProjectFields enqueues when offline and Supabase configured", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await updateProjectFields("proj_offline", { name: "Test" });
      expect(enqueue).toHaveBeenCalledWith({ type: "updateProjectFields", args: ["proj_offline", { name: "Test" }] });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });

    it("syncBatiments enqueues when offline", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await syncBatiments("proj_offline", []);
      expect(enqueue).toHaveBeenCalledWith({ type: "syncBatiments", args: ["proj_offline", []] });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });

    it("syncLots enqueues when offline", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await syncLots("proj_offline", []);
      expect(enqueue).toHaveBeenCalledWith({ type: "syncLots", args: ["proj_offline", []] });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });

    it("syncLotsDecomp enqueues when offline", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await syncLotsDecomp("proj_offline", [], []);
      expect(enqueue).toHaveBeenCalledWith({ type: "syncLotsDecomp", args: ["proj_offline", [], []] });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });

    it("setTrackingCell enqueues when offline", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await setTrackingCell("p1", "logements", "r1", "e1", "X");
      expect(enqueue).toHaveBeenCalledWith({
        type: "setTrackingCell",
        args: ["p1", "logements", "r1", "e1", "X"],
      });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });

    it("setTrackingMeta enqueues when offline", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      await setTrackingMeta("p1", "logements", "r1", { ponderation: 2 });
      expect(enqueue).toHaveBeenCalledWith({
        type: "setTrackingMeta",
        args: ["p1", "logements", "r1", { ponderation: 2 }],
      });

      if (originalOnLine) {
        Object.defineProperty(navigator, "onLine", originalOnLine);
      } else {
        Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      }
    });
  });

  describe("replayOperation()", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    });

    it("handles unknown operation type gracefully", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await replayOperation("unknownOp", []);
    });

    it("delegates setTrackingCell", async () => {
      await replayOperation("setTrackingCell", ["p1", "logements", "row1", "e1", "X"]);
    });

    it("delegates updateProjectFields", async () => {
      await replayOperation("updateProjectFields", ["p1", { name: "Updated" }]);
    });

    it("delegates deleteProjectFromDB", async () => {
      await replayOperation("deleteProjectFromDB", ["p1"]);
    });

    it("delegates syncBatiments", async () => {
      await replayOperation("syncBatiments", ["p1", []]);
    });

    it("delegates syncLots", async () => {
      await replayOperation("syncLots", ["p1", []]);
    });

    it("delegates syncLotsDecomp", async () => {
      await replayOperation("syncLotsDecomp", ["p1", [], []]);
    });

    it("delegates setTrackingMeta", async () => {
      await replayOperation("setTrackingMeta", ["p1", "logements", "row1", { ponderation: 1 }]);
    });
  });
});
