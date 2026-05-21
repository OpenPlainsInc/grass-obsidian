/**
 * Platform abstraction for Node built-ins.
 *
 * Obsidian desktop runs in Electron and has full Node access. Obsidian mobile
 * (iOS/Android) does not — a top-level `import * as fs from "fs"` will throw
 * at module-load time on mobile and crash the plugin.
 *
 * This module lazy-loads `fs`, `path`, and `os` via dynamic `require` and
 * exposes only the operations the parser needs, with graceful fallbacks. The
 * rest of the codebase should never touch Node built-ins directly.
 */

type FsModule = typeof import("fs");
type PathModule = typeof import("path");
type OsModule = typeof import("os");

// `undefined` = not attempted yet; `null` = attempted and unavailable.
let _fs: FsModule | null | undefined = undefined;
let _path: PathModule | null | undefined = undefined;
let _os: OsModule | null | undefined = undefined;

function tryRequire<T>(name: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name) as T;
  } catch {
    return null;
  }
}

function getFs(): FsModule | null {
  if (_fs === undefined) _fs = tryRequire<FsModule>("fs");
  return _fs;
}

function getPath(): PathModule | null {
  if (_path === undefined) _path = tryRequire<PathModule>("path");
  return _path;
}

function getOs(): OsModule | null {
  if (_os === undefined) _os = tryRequire<OsModule>("os");
  return _os;
}

/** True only on platforms where `fs` is available (desktop). */
export function isFilesystemAvailable(): boolean {
  return getFs() !== null;
}

/** Read a UTF-8 text file. Returns undefined when the file is missing or fs is unavailable. */
export function readTextFile(p: string): string | undefined {
  const fs = getFs();
  if (!fs) return undefined;
  try {
    return fs.readFileSync(p, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR") {
      return undefined;
    }
    throw err;
  }
}

export interface StatResult {
  isDir: boolean;
  isFile: boolean;
  mtime?: Date;
}

/** Stat a path; undefined for missing entries or when fs is unavailable. */
export function statSafe(p: string): StatResult | undefined {
  const fs = getFs();
  if (!fs) return undefined;
  try {
    const s = fs.statSync(p);
    return { isDir: s.isDirectory(), isFile: s.isFile(), mtime: s.mtime };
  } catch {
    return undefined;
  }
}

export interface DirEntry {
  name: string;
  isFile: boolean;
  isDir: boolean;
}

/** List a directory; empty array on error or when fs is unavailable. */
export function listDir(p: string): DirEntry[] {
  const fs = getFs();
  if (!fs) return [];
  try {
    return fs.readdirSync(p, { withFileTypes: true }).map((d) => ({
      name: d.name,
      isFile: d.isFile(),
      isDir: d.isDirectory(),
    }));
  } catch {
    return [];
  }
}

// ---------- path / os helpers (POSIX fallbacks when not on Node) ----------

export function homedir(): string | undefined {
  const os = getOs();
  if (!os) return undefined;
  try {
    return os.homedir();
  } catch {
    return undefined;
  }
}

export function pathJoin(...parts: string[]): string {
  const p = getPath();
  if (p) return p.join(...parts);
  return parts
    .filter((s) => s !== "")
    .join("/")
    .replace(/\/+/g, "/");
}

export function pathResolve(...parts: string[]): string {
  const p = getPath();
  if (p) return p.resolve(...parts);
  return pathJoin(...parts);
}

export function pathBasename(p: string): string {
  const pp = getPath();
  if (pp) return pp.basename(p);
  const parts = p.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
