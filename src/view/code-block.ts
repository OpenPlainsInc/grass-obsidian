/*!
 * @fileoverview Markdown code-block processor for ` ```grass ` blocks. Parses
 *   either a YAML `path:` field or a bare path body, resolves it against the
 *   configured grassdata root, and dispatches to the live/cache/missing renderer.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import { parseYaml } from "obsidian";
import type { ProjectCacheState } from "../cache";
import { isAbsoluteLike, resolveProjectPath } from "../util/path";
import { pathJoin } from "../util/platform";
import { renderError, renderMissing, renderSummary } from "./render";
import { resolveProject } from "./resolve";

/**
 * Configuration the code-block processor needs from the plugin instance.
 * Passed as a getter object so the processor always sees current values when
 * settings or cache are mutated elsewhere.
 */
export interface CodeBlockContext {
  getDefaultGrassdata: () => string;
  getCache: () => ProjectCacheState;
  saveCache: () => void;
  isFilesystemAvailable: () => boolean;
}

/**
 * Handler for ` ```grass-project ``` ` code blocks.
 *
 * Accepted source bodies:
 *
 *   ```grass-project
 *   path: ~/grassdata/nc_spm_08
 *   ```
 *
 * or a bare path string:
 *
 *   ```grass-project
 *   ~/grassdata/nc_spm_08
 *   ```
 *
 * Resolution order on render:
 *   1. Fresh parse from disk (if filesystem is available). Updates the cache.
 *   2. Cache lookup keyed by the *verbatim* input path string.
 *   3. "Missing" empty state.
 */
export function makeCodeBlockProcessor(ctx: CodeBlockContext) {
  return (source: string, el: HTMLElement, _ctxArg: unknown): void => {
    const pathStr = extractPath(source, el);
    if (pathStr === undefined) return; // error already rendered

    let resolved = resolveProjectPath(pathStr);
    if (!isAbsoluteLike(resolved)) {
      const root = ctx.getDefaultGrassdata();
      if (root) resolved = resolveProjectPath(pathJoin(root, pathStr));
    }

    const result = resolveProject({
      cacheKey: pathStr,
      resolvedPath: resolved,
      cache: ctx.getCache(),
      onCacheUpdated: ctx.saveCache,
    });

    if (result.kind === "missing") {
      renderMissing(el, {
        projectRef: pathStr,
        reason: result.reason,
        filesystemAvailable: !result.filesystemUnavailable,
      });
      return;
    }

    renderSummary(el, result.summary, {
      cached: result.kind === "cache",
      cachedAt: result.cachedAt,
      filesystemAvailable: ctx.isFilesystemAvailable(),
    });
  };
}

/**
 * Parse the directive body and return the user's path string, or render an
 * error into `el` and return undefined.
 */
function extractPath(source: string, el: HTMLElement): string | undefined {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    renderError(el, "code block is empty — expected `path: ...`");
    return undefined;
  }

  // If the block has no colon/newline, treat it as a bare path. Otherwise YAML.
  if (!/[:\n]/.test(trimmed)) return trimmed;

  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch (err) {
    renderError(el, `could not parse YAML: ${(err as Error).message}`);
    return undefined;
  }

  if (typeof parsed === "string") return parsed.trim();
  if (parsed && typeof parsed === "object" && "path" in parsed) {
    const v = (parsed as Record<string, unknown>).path;
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }

  renderError(el, "missing `path:` field");
  return undefined;
}
