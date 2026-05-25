/*!
 * @fileoverview Path helpers built atop the platform wrapper — tilde expansion,
 *   project-path resolution, and absolute-path detection — that degrade gracefully
 *   on mobile where `os` and `path` are unavailable.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import { homedir, pathJoin, pathResolve } from "./platform";

/**
 * Expand a leading ~ (or ~/...) to the user's home directory.
 *
 * On platforms where `os` is unavailable (mobile), tilde-prefixed paths are
 * left as-is. Callers should still be able to use them as cache keys.
 */
export function expandHome(p: string): string {
  if (p === "~") {
    return homedir() ?? p;
  }
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    const home = homedir();
    return home ? pathJoin(home, p.slice(2)) : p;
  }
  return p;
}

/**
 * Resolve a user-supplied project path: expand ~, then normalize. On mobile,
 * normalization is a best-effort POSIX join because `path` may be unavailable.
 */
export function resolveProjectPath(p: string): string {
  return pathResolve(expandHome(p.trim()));
}

/** True for absolute-looking paths (POSIX `/...` or Windows drive letter). */
export function isAbsoluteLike(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p);
}
