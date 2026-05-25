/*!
 * @fileoverview Central live/cache/missing decision for project references.
 *   Attempts a fresh on-disk parse when fs is available (updating the cache on
 *   success), otherwise falls back to a cache lookup keyed by the verbatim input.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import { parseProject } from "../parser";
import { getCached, setCached, type CachedProject, type ProjectCacheState } from "../cache";
import { GrassParseError, type ProjectSummary } from "../types";
import { isFilesystemAvailable } from "../util/platform";

/** Outcome of resolving a project reference. Exactly one of these fields will be set. */
export interface ResolveOk {
  kind: "live" | "cache";
  summary: ProjectSummary;
  cachedAt?: number;
}

export interface ResolveFail {
  kind: "missing";
  /** What went wrong with the fresh read (or why we couldn't try). */
  reason: string;
  /** Whether the failure was due to fs being unavailable (mobile). */
  filesystemUnavailable: boolean;
}

export type ResolveResult = ResolveOk | ResolveFail;

/**
 * Resolve a project reference for display.
 *
 * Algorithm:
 *   1. If the filesystem is available, attempt a fresh parse. On success,
 *      update the cache (so mobile gets the result next sync) and return
 *      kind:"live". Carry the error otherwise.
 *   2. Look up the cache by the user's *input path* (NOT the resolved one).
 *      On hit, return kind:"cache" with cachedAt.
 *   3. On a complete miss, return kind:"missing" with the underlying reason.
 *
 * `onCacheUpdated` is called only when step 1 succeeded; the plugin uses it
 * to persist the cache to data.json.
 */
export function resolveProject(args: {
  cacheKey: string;
  resolvedPath: string;
  cache: ProjectCacheState;
  onCacheUpdated: () => void;
}): ResolveResult {
  const { cacheKey, resolvedPath, cache, onCacheUpdated } = args;
  const fsAvailable = isFilesystemAvailable();

  let freshError: string | undefined;
  if (fsAvailable) {
    try {
      const summary = parseProject(resolvedPath);
      const cachedAt = Date.now();
      const entry: CachedProject = { summary, cachedAt, resolvedPath };
      setCached(cache, cacheKey, entry);
      onCacheUpdated();
      return { kind: "live", summary, cachedAt };
    } catch (err) {
      if (err instanceof GrassParseError) {
        freshError = `${err.message} (${err.path})`;
      } else {
        freshError = (err as Error).message;
      }
    }
  }

  const hit = getCached(cache, cacheKey);
  if (hit) {
    return { kind: "cache", summary: hit.summary, cachedAt: hit.cachedAt };
  }

  return {
    kind: "missing",
    reason: freshError ?? "filesystem is unavailable on this device",
    filesystemUnavailable: !fsAvailable,
  };
}
