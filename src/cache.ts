import type { ProjectSummary } from "./types";

/**
 * One cache entry. `cachedAt` is epoch ms — we render it as "cached on date X"
 * so users can tell when the fallback is stale.
 */
export interface CachedProject {
  summary: ProjectSummary;
  cachedAt: number;
  /** Absolute path that was scanned when the cache was populated. Diagnostic only. */
  resolvedPath?: string;
}

/**
 * Serialized cache state. Stored in the plugin's data.json blob so Obsidian
 * Sync (or any vault-level sync that includes `.obsidian/plugins/...`) carries
 * it to mobile devices where the underlying project tree isn't present.
 *
 * Keyed by the verbatim path string from the directive — NOT the resolved
 * absolute path — so the same `path: ~/grassdata/foo` in a note hits the same
 * cache entry on every device, regardless of where home actually is.
 */
export interface ProjectCacheState {
  entries: Record<string, CachedProject>;
}

/** Soft cap on cache size; oldest entries are evicted on set. */
export const MAX_CACHE_ENTRIES = 100;

/** Empty cache value used at first plugin load. */
export function emptyCache(): ProjectCacheState {
  return { entries: {} };
}

/** Normalize the cache key so superficial whitespace doesn't fork entries. */
export function cacheKey(input: string): string {
  return input.trim();
}

export function getCached(state: ProjectCacheState, rawKey: string): CachedProject | undefined {
  return state.entries[cacheKey(rawKey)];
}

/**
 * Insert (or update) a cache entry. Re-inserts the key at the "end" of the
 * object's key order so that older keys are evicted first when we exceed the
 * cap. JavaScript objects preserve string-key insertion order, which is what
 * makes this LRU-by-insertion-order work in practice.
 */
export function setCached(state: ProjectCacheState, rawKey: string, value: CachedProject): void {
  const key = cacheKey(rawKey);
  if (key in state.entries) delete state.entries[key];
  state.entries[key] = value;
  const keys = Object.keys(state.entries);
  if (keys.length > MAX_CACHE_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_CACHE_ENTRIES)) {
      delete state.entries[k];
    }
  }
}

/** Remove a single entry; no-op if it doesn't exist. */
export function deleteCached(state: ProjectCacheState, rawKey: string): void {
  delete state.entries[cacheKey(rawKey)];
}

/** Remove all entries. */
export function clearCache(state: ProjectCacheState): void {
  state.entries = {};
}

/** Defensive load from arbitrary stored JSON; returns an empty cache on bad data. */
export function loadCache(raw: unknown): ProjectCacheState {
  if (
    raw &&
    typeof raw === "object" &&
    "entries" in raw &&
    typeof (raw as { entries: unknown }).entries === "object" &&
    (raw as { entries: unknown }).entries !== null
  ) {
    return { entries: { ...(raw as ProjectCacheState).entries } };
  }
  return emptyCache();
}
