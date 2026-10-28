import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMemoCache, memoize } from "./memoCache";

describe("memoize", () => {
  beforeEach(() => clearMemoCache());

  it("runs the loader once within the TTL", async () => {
    const loader = vi.fn(async () => 1);
    let t = 0;
    await memoize("k", 1000, loader, () => t);
    t = 999;
    await memoize("k", 1000, loader, () => t);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads after TTL expiry", async () => {
    const loader = vi.fn(async () => 1);
    let t = 0;
    await memoize("k", 1000, loader, () => t);
    t = 1001;
    await memoize("k", 1000, loader, () => t);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent calls", async () => {
    const loader = vi.fn(async () => 1);
    await Promise.all([memoize("k", 1000, loader), memoize("k", 1000, loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves the stale value if a refresh fails", async () => {
    let t = 0;
    await memoize("k", 10, async () => "ok", () => t);
    t = 100;
    const v = await memoize("k", 10, async () => { throw new Error("db"); }, () => t);
    expect(v).toBe("ok");
  });
});
