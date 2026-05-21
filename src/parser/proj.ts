import type { ProjInfo } from "../types";
import { pathJoin, readTextFile } from "../util/platform";
import { num, parseKeyValue } from "./kv";

/**
 * Read and merge the projection-defining files in a project's PERMANENT mapset:
 *
 *   PROJ_INFO   - projection name, proj4 short name, datum, ellipsoid, ...
 *   PROJ_UNITS  - linear unit name + meters/unit conversion
 *   PROJ_EPSG   - EPSG code (newer GRASS); a single "epsg: NNNN" line
 *
 * For an XY (unprojected/abstract) project none of these may exist; we return
 * an empty ProjInfo rather than throwing. On mobile (no fs), the same empty
 * info is returned and the caller is expected to fall back to the cache.
 */
export function readProjInfo(permanentDir: string): ProjInfo {
  const raw: Record<string, string> = {};

  const projInfo = readTextFile(pathJoin(permanentDir, "PROJ_INFO"));
  if (projInfo !== undefined) {
    Object.assign(raw, parseKeyValue(projInfo));
  }

  let units: string | undefined;
  let meters: number | undefined;
  const projUnits = readTextFile(pathJoin(permanentDir, "PROJ_UNITS"));
  if (projUnits !== undefined) {
    const u = parseKeyValue(projUnits);
    units = u.unit ?? u.units;
    meters = num(u, "meters");
  }

  let epsg: number | undefined;
  const projEpsg = readTextFile(pathJoin(permanentDir, "PROJ_EPSG"));
  if (projEpsg !== undefined) {
    const e = parseKeyValue(projEpsg);
    const code = num(e, "epsg");
    if (code !== undefined) epsg = code;
  }

  return {
    name: raw.name,
    proj: raw.proj,
    datum: raw.datum,
    ellipsoid: raw.ellps ?? raw.ellipsoid,
    units,
    meters,
    epsg,
    raw,
  };
}
