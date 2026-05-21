import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Simulate Obsidian mobile by mocking the platform module so
 * `isFilesystemAvailable()` returns false and all filesystem helpers act as
 * if fs failed to load. `vi.mock` is hoisted by the Vitest transform, so the
 * parser modules see the mock at first import.
 */
vi.mock("../src/util/platform", () => {
  return {
    isFilesystemAvailable: () => false,
    readTextFile: () => undefined,
    statSafe: () => undefined,
    listDir: () => [],
    homedir: () => undefined,
    pathJoin: (...parts: string[]) =>
      parts
        .filter((s) => s !== "")
        .join("/")
        .replace(/\/+/g, "/"),
    pathResolve: (...parts: string[]) =>
      parts
        .filter((s) => s !== "")
        .join("/")
        .replace(/\/+/g, "/"),
    pathBasename: (p: string) => p.split(/[/\\]/).filter(Boolean).pop() ?? p,
  };
});

import { emptyCache, setCached } from "../src/cache";
import type { ProjectSummary } from "../src/types";
import { parseProject } from "../src/parser";
import { GrassParseError } from "../src/types";
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

describe("mobile (filesystem unavailable)", () => {
  it("parseProject throws a dedicated 'unavailable' error", () => {
    expect(() => parseProject(FIXTURE)).toThrow(GrassParseError);
    try {
      parseProject(FIXTURE);
    } catch (err) {
      expect((err as Error).message).toMatch(/filesystem unavailable/);
    }
  });

  it("resolveProject returns kind:cache when a cached entry exists", () => {
    const cache = emptyCache();
    setCached(cache, "~/grassdata/sample", {
      summary: bogusSummary("from-mobile-cache"),
      cachedAt: 7777,
    });
    const saveSpy = vi.fn();

    const result = resolveProject({
      cacheKey: "~/grassdata/sample",
      resolvedPath: FIXTURE,
      cache,
      onCacheUpdated: saveSpy,
    });

    expect(result.kind).toBe("cache");
    if (result.kind !== "cache") return;
    expect(result.summary.name).toBe("from-mobile-cache");
    expect(result.cachedAt).toBe(7777);
    // Cache must NOT be overwritten on mobile — the desktop's data is the source of truth.
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("resolveProject returns kind:missing with filesystemUnavailable=true when there is no cache", () => {
    const result = resolveProject({
      cacheKey: "~/grassdata/cold_start",
      resolvedPath: FIXTURE,
      cache: emptyCache(),
      onCacheUpdated: vi.fn(),
    });

    expect(result.kind).toBe("missing");
    if (result.kind !== "missing") return;
    expect(result.filesystemUnavailable).toBe(true);
  });
});
