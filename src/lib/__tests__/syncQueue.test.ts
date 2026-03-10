import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueue, flush, getPendingCount, useSyncStatus, useAutoFlush } from "../syncQueue";

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

describe("syncQueue", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("enqueue()", () => {
    it("adds an operation to the queue", () => {
      enqueue({ type: "setTrackingCell", args: ["p1", "logements", "row1", "e1", "X"] });

      const queue = JSON.parse(localStorageMock.getItem("_syncQueue")!);
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe("setTrackingCell");
      expect(queue[0].args).toEqual(["p1", "logements", "row1", "e1", "X"]);
      expect(queue[0].timestamp).toBeDefined();
    });

    it("appends multiple operations to the queue", () => {
      enqueue({ type: "op1", args: [1] });
      enqueue({ type: "op2", args: [2] });
      enqueue({ type: "op3", args: [3] });

      const queue = JSON.parse(localStorageMock.getItem("_syncQueue")!);
      expect(queue).toHaveLength(3);
      expect(queue[0].type).toBe("op1");
      expect(queue[1].type).toBe("op2");
      expect(queue[2].type).toBe("op3");
    });
  });

  describe("flush()", () => {
    it("replays and clears all queued operations", async () => {
      enqueue({ type: "op1", args: ["a"] });
      enqueue({ type: "op2", args: ["b"] });

      const replayFn = vi.fn().mockResolvedValue(undefined);
      const replayed = await flush(replayFn);

      expect(replayed).toBe(2);
      expect(replayFn).toHaveBeenCalledTimes(2);
      expect(replayFn).toHaveBeenCalledWith("op1", ["a"]);
      expect(replayFn).toHaveBeenCalledWith("op2", ["b"]);

      const queue = JSON.parse(localStorageMock.getItem("_syncQueue")!);
      expect(queue).toHaveLength(0);
    });

    it("returns 0 when queue is empty", async () => {
      const replayFn = vi.fn();
      const replayed = await flush(replayFn);
      expect(replayed).toBe(0);
      expect(replayFn).not.toHaveBeenCalled();
    });

    it("keeps failed operations in the queue", async () => {
      enqueue({ type: "op1", args: ["a"] });
      enqueue({ type: "op2", args: ["b"] });
      enqueue({ type: "op3", args: ["c"] });

      const replayFn = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(undefined);

      vi.spyOn(console, "error").mockImplementation(() => {});
      const replayed = await flush(replayFn);

      expect(replayed).toBe(2);
      const queue = JSON.parse(localStorageMock.getItem("_syncQueue")!);
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe("op2");
    });
  });

  describe("getPendingCount()", () => {
    it("returns 0 when queue is empty", () => {
      expect(getPendingCount()).toBe(0);
    });

    it("returns the correct count after enqueuing", () => {
      enqueue({ type: "op1", args: [] });
      enqueue({ type: "op2", args: [] });
      expect(getPendingCount()).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles corrupted queue data gracefully", () => {
      localStorageMock.setItem("_syncQueue", "not json");
      // getPendingCount should return 0 for corrupted data
      expect(getPendingCount()).toBe(0);
    });

    it("enqueue adds timestamp to each operation", () => {
      const before = Date.now();
      enqueue({ type: "test", args: ["x"] });
      const after = Date.now();

      const queue = JSON.parse(localStorageMock.getItem("_syncQueue")!);
      expect(queue[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(queue[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("flush processes operations in order", async () => {
      const order: string[] = [];
      enqueue({ type: "first", args: [] });
      enqueue({ type: "second", args: [] });
      enqueue({ type: "third", args: [] });

      const replayFn = vi.fn(async (type: string) => { order.push(type); });
      await flush(replayFn);

      expect(order).toEqual(["first", "second", "third"]);
    });
  });

  describe("useSyncStatus()", () => {
    it("returns online status and pending count", () => {
      // We need to render it as a hook
      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useSyncStatus());

      expect(typeof result.current.isOnline).toBe("boolean");
      expect(typeof result.current.pendingCount).toBe("number");
    });

    it("reflects pending count from queue", () => {
      enqueue({ type: "op1", args: [] });
      enqueue({ type: "op2", args: [] });

      const { renderHook } = require("@testing-library/react");
      const { result } = renderHook(() => useSyncStatus());

      expect(result.current.pendingCount).toBe(2);
    });
  });

  describe("useAutoFlush()", () => {
    it("sets up and tears down event listener", () => {
      const { renderHook } = require("@testing-library/react");
      const replayFn = vi.fn().mockResolvedValue(undefined);

      const addSpy = vi.spyOn(window, "addEventListener");
      const removeSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useAutoFlush(replayFn));

      expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));

      unmount();

      expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });
});
