/*!
 * @fileoverview Unit tests for the project cache: insertion ordering, LRU
 *   eviction at MAX_CACHE_ENTRIES, key normalization, defensive deserialization,
 *   and JSON round-trip safety.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_CACHE_ENTRIES,
  cacheKey,
  deleteCached,
  emptyCache,
  getCached,
  loadCache,
  setCached,
  type CachedProject,
  type ProjectCacheState,
} from "../src/cache";
import type { ProjectSummary } from "../src/types";

function makeSummary(name: string): ProjectSummary {
  return {
    name,
    path: `/tmp/${name}`,
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

function makeEntry(name: string, cachedAt = 0): CachedProject {
  return { summary: makeSummary(name), cachedAt };
}

describe("cacheKey", () => {
  it("trims surrounding whitespace", () => {
    expect(cacheKey("  ~/grassdata/foo  ")).toBe("~/grassdata/foo");
  });
});

describe("cache get/set", () => {
  it("returns undefined for a miss on an empty cache", () => {
    const c = emptyCache();
    expect(getCached(c, "anything")).toBeUndefined();
  });

  it("stores and retrieves an entry", () => {
    const c = emptyCache();
    setCached(c, "a", makeEntry("a"));
    expect(getCached(c, "a")?.summary.name).toBe("a");
  });

  it("treats whitespace-equivalent keys identically", () => {
    const c = emptyCache();
    setCached(c, "  a  ", makeEntry("a"));
    expect(getCached(c, "a")?.summary.name).toBe("a");
  });

  it("overwrites on set with the same key", () => {
    const c = emptyCache();
    setCached(c, "a", makeEntry("a", 1));
    setCached(c, "a", makeEntry("a", 2));
    expect(getCached(c, "a")?.cachedAt).toBe(2);
  });

  it("delete removes an entry", () => {
    const c = emptyCache();
    setCached(c, "a", makeEntry("a"));
    deleteCached(c, "a");
    expect(getCached(c, "a")).toBeUndefined();
  });
});

describe("cache LRU eviction", () => {
  it("evicts the oldest entries past MAX_CACHE_ENTRIES", () => {
    const c = emptyCache();
    for (let i = 0; i < MAX_CACHE_ENTRIES + 5; i++) {
      setCached(c, `k${i}`, makeEntry(`k${i}`));
    }
    // The first 5 keys should be gone.
    for (let i = 0; i < 5; i++) {
      expect(getCached(c, `k${i}`)).toBeUndefined();
    }
    // The last MAX_CACHE_ENTRIES keys should still be there.
    for (let i = 5; i < MAX_CACHE_ENTRIES + 5; i++) {
      expect(getCached(c, `k${i}`)).toBeDefined();
    }
  });

  it("re-setting an existing key bumps it to most-recent", () => {
    const c = emptyCache();
    setCached(c, "old", makeEntry("old"));
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
      setCached(c, `k${i}`, makeEntry(`k${i}`));
    }
    // "old" is now at position 0 of MAX_CACHE_ENTRIES+1 entries; the next set
    // pushes it out unless we bump it first.
    setCached(c, "old", makeEntry("old", 999));
    setCached(c, "filler", makeEntry("filler"));
    // "old" should still be there because the re-set bumped it.
    expect(getCached(c, "old")?.cachedAt).toBe(999);
  });
});

describe("loadCache", () => {
  it("returns an empty cache for null / undefined / non-object input", () => {
    expect(loadCache(null).entries).toEqual({});
    expect(loadCache(undefined).entries).toEqual({});
    expect(loadCache("not an object").entries).toEqual({});
    expect(loadCache(42).entries).toEqual({});
  });

  it("returns an empty cache for objects missing `entries`", () => {
    expect(loadCache({}).entries).toEqual({});
  });

  it("round-trips through JSON.stringify/parse", () => {
    const c = emptyCache();
    setCached(c, "a", makeEntry("a", 1));
    setCached(c, "b", makeEntry("b", 2));
    const serialized = JSON.stringify({ cache: c });
    const parsed = JSON.parse(serialized) as { cache: unknown };
    const restored = loadCache(parsed.cache);
    expect(getCached(restored, "a")?.summary.name).toBe("a");
    expect(getCached(restored, "b")?.cachedAt).toBe(2);
  });

  it("ignores stored data whose `entries` is not an object", () => {
    const c: unknown = { entries: "wat" };
    expect(loadCache(c).entries).toEqual({});
  });

  it("preserves entry order through JSON round-trip (LRU intact)", () => {
    const c = emptyCache();
    setCached(c, "first", makeEntry("first"));
    setCached(c, "second", makeEntry("second"));
    setCached(c, "third", makeEntry("third"));
    const restored = loadCache(JSON.parse(JSON.stringify(c)));
    expect(Object.keys(restored.entries)).toEqual(["first", "second", "third"]);
  });
});
