/*!
 * @fileoverview Tests for resolveProject's live/cache/missing decision tree
 *   against the real fixture and a fake nonexistent path. Verifies live reads
 *   overwrite the cache and that cache reads never write back.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import * as path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyCache, setCached } from "../src/cache";
import type { ProjectSummary } from "../src/types";
import { resolveProject } from "../src/view/resolve";

const FIXTURE = path.join(__dirname, "fixtures", "sample_project");

function bogusSummary(name: string): ProjectSummary {
  return {
    name,
    path: `/stale/${name}`,
    proj: { raw: {} },
    defaultRegion: {
      north: 1,
      south: 0,
      east: 1,
      west: 0,
      nsres: 1,
      ewres: 1,
      rows: 1,
      cols: 1,
    },
    mapsets: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveProject", () => {
  it("returns kind:live and populates the cache on a successful fresh parse", () => {
    const cache = emptyCache();
    const saveSpy = vi.fn();

    const result = resolveProject({
      cacheKey: "~/grassdata/sample",
      resolvedPath: FIXTURE,
      cache,
      onCacheUpdated: saveSpy,
    });

    expect(result.kind).toBe("live");
    if (result.kind !== "live") return;
    expect(result.summary.name).toBe("sample_project");
    expect(result.cachedAt).toBeDefined();
    expect(saveSpy).toHaveBeenCalledOnce();
    expect(cache.entries["~/grassdata/sample"]).toBeDefined();
  });

  it("falls back to the cache when the project path is missing", () => {
    const cache = emptyCache();
    setCached(cache, "~/grassdata/sample", {
      summary: bogusSummary("from-cache"),
      cachedAt: 12345,
    });
    const saveSpy = vi.fn();

    const result = resolveProject({
      cacheKey: "~/grassdata/sample",
      resolvedPath: "/nonexistent/path/xyz123",
      cache,
      onCacheUpdated: saveSpy,
    });

    expect(result.kind).toBe("cache");
    if (result.kind !== "cache") return;
    expect(result.summary.name).toBe("from-cache");
    expect(result.cachedAt).toBe(12345);
    // We must NOT overwrite the cache when the fresh read failed.
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("returns kind:missing when both fresh read and cache fail", () => {
    const cache = emptyCache();
    const saveSpy = vi.fn();

    const result = resolveProject({
      cacheKey: "~/grassdata/never_seen",
      resolvedPath: "/nonexistent/path/xyz123",
      cache,
      onCacheUpdated: saveSpy,
    });

    expect(result.kind).toBe("missing");
    if (result.kind !== "missing") return;
    expect(result.reason).toMatch(/does not exist/);
    expect(result.filesystemUnavailable).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("prefers the live read over a stale cache when both succeed", () => {
    const cache = emptyCache();
    setCached(cache, "~/grassdata/sample", {
      summary: bogusSummary("stale"),
      cachedAt: 1,
    });
    const saveSpy = vi.fn();

    const result = resolveProject({
      cacheKey: "~/grassdata/sample",
      resolvedPath: FIXTURE,
      cache,
      onCacheUpdated: saveSpy,
    });

    expect(result.kind).toBe("live");
    if (result.kind !== "live") return;
    expect(result.summary.name).toBe("sample_project");
    // The live read should have refreshed the cache entry.
    expect(cache.entries["~/grassdata/sample"].summary.name).toBe("sample_project");
    expect(saveSpy).toHaveBeenCalledOnce();
  });
});
