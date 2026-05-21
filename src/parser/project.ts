import { GrassParseError, type ProjectSummary } from "../types";
import {
  isFilesystemAvailable,
  listDir,
  pathBasename,
  pathJoin,
  pathResolve,
  readTextFile,
  statSafe,
} from "../util/platform";
import { parseRegion } from "./region";
import { readProjInfo } from "./proj";
import { scanMapset } from "./mapset";

/**
 * Parse a GRASS project from disk into a ProjectSummary.
 *
 * Validation rules (we want to fail informatively, not crash):
 *   1. The filesystem is available (desktop). Mobile throws a dedicated
 *      `unavailable: ...` error that views translate into a cache lookup.
 *   2. The path exists and is a directory.
 *   3. It contains a PERMANENT mapset directory.
 *   4. PERMANENT contains DEFAULT_WIND. (We use this rather than PROJ_INFO
 *      because abstract/XY projects skip PROJ_INFO but always have DEFAULT_WIND.)
 *
 * Anything beyond that — corrupt cellhd files, oddly-named mapsets, etc. —
 * is tolerated and reflected in the summary rather than thrown.
 */
export function parseProject(projectPath: string): ProjectSummary {
  if (!isFilesystemAvailable()) {
    throw new GrassParseError(
      "filesystem unavailable on this platform (mobile?); will fall back to cached summary if one exists",
      projectPath,
    );
  }

  const stat = statSafe(projectPath);
  if (!stat) {
    throw new GrassParseError(`path does not exist: ${projectPath}`, projectPath);
  }
  if (!stat.isDir) {
    throw new GrassParseError(`path is not a directory: ${projectPath}`, projectPath);
  }

  const permanentPath = pathJoin(projectPath, "PERMANENT");
  if (!statSafe(permanentPath)?.isDir) {
    throw new GrassParseError("not a GRASS project: missing PERMANENT mapset", projectPath);
  }

  const defaultWindRaw = readTextFile(pathJoin(permanentPath, "DEFAULT_WIND"));
  if (defaultWindRaw === undefined) {
    throw new GrassParseError("not a GRASS project: missing PERMANENT/DEFAULT_WIND", projectPath);
  }
  const defaultRegion = parseRegion(defaultWindRaw);

  const proj = readProjInfo(permanentPath);

  // Enumerate mapsets. A subdirectory is a mapset iff it contains a WIND file.
  // PERMANENT always qualifies; sort it first, then the rest alphabetically.
  const mapsetNames = listMapsetDirs(projectPath);
  const mapsets = mapsetNames
    .map((name) => scanMapset(pathJoin(projectPath, name)))
    .sort((a, b) => {
      if (a.name === "PERMANENT") return -1;
      if (b.name === "PERMANENT") return 1;
      return a.name.localeCompare(b.name);
    });

  return {
    name: pathBasename(pathResolve(projectPath)),
    path: projectPath,
    proj,
    defaultRegion,
    mapsets,
  };
}

function listMapsetDirs(projectPath: string): string[] {
  return listDir(projectPath)
    .filter((e) => e.isDir && !e.name.startsWith("."))
    .map((e) => e.name)
    .filter((name) => statSafe(pathJoin(projectPath, name, "WIND"))?.isFile);
}
