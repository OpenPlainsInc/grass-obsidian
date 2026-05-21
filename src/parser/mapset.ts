import type { MapsetSummary, RasterInfo, RasterType, Region, VectorInfo } from "../types";
import { listDir, pathBasename, pathJoin, readTextFile, statSafe } from "../util/platform";
import { int, parseKeyValue } from "./kv";
import { parseRegion } from "./region";

/**
 * Scan a single mapset directory and return a summary.
 *
 * Conventions used here come from the on-disk layout documented at
 *   https://grass.osgeo.org/grass-stable/manuals/grass_database.html
 *
 *   <mapset>/WIND               current region for this mapset
 *   <mapset>/cellhd/<name>      raster headers (one file per raster)
 *   <mapset>/cell/<name>        integer raster data (presence => CELL)
 *   <mapset>/fcell/<name>       float/double raster data (presence => F/DCELL)
 *   <mapset>/vector/<name>/     vector maps (directory each, with head + coor)
 *   <mapset>/grid3/<name>       3D raster data
 *   <mapset>/group/<name>/      imagery groups (directory each)
 *
 * Filesystem access goes through util/platform so this works (returning
 * conservative empties) on mobile where fs is unavailable.
 */
export function scanMapset(mapsetPath: string): MapsetSummary {
  const name = pathBasename(mapsetPath);

  let currentRegion: Region | undefined;
  const wind = readTextFile(pathJoin(mapsetPath, "WIND"));
  if (wind !== undefined) {
    try {
      currentRegion = parseRegion(wind);
    } catch {
      currentRegion = undefined;
    }
  }

  const rasters = listFileNames(pathJoin(mapsetPath, "cellhd"));
  const vectors = listDirNames(pathJoin(mapsetPath, "vector"));
  const raster3d = listFileNames(pathJoin(mapsetPath, "grid3"));
  const groups = listDirNames(pathJoin(mapsetPath, "group"));

  const stat = statSafe(mapsetPath);
  const lastModified = stat?.mtime ? stat.mtime.getTime() : undefined;

  return {
    name,
    path: mapsetPath,
    currentRegion,
    rasters: rasters.sort(),
    vectors: vectors.sort(),
    raster3d: raster3d.sort(),
    groups: groups.sort(),
    lastModified,
  };
}

/**
 * Read full details for a single raster map. Returns undefined if no header
 * file exists.
 *
 * Type inference uses on-disk presence:
 *   cell/<name>  exists  => CELL  (integer)
 *   fcell/<name> exists  => FCELL (float; we can't cheaply distinguish DCELL
 *                                   without reading the binary header)
 */
export function readRasterInfo(mapsetPath: string, rasterName: string): RasterInfo | undefined {
  const headerPath = pathJoin(mapsetPath, "cellhd", rasterName);
  const content = readTextFile(headerPath);
  if (content === undefined) return undefined;

  let region: Region;
  try {
    region = parseRegion(content);
  } catch {
    return undefined;
  }

  const kv = parseKeyValue(content);
  const format = int(kv, "format");
  const compressed = kv.compressed === "1" ? true : kv.compressed === "0" ? false : undefined;

  let type: RasterType = "unknown";
  if (statSafe(pathJoin(mapsetPath, "fcell", rasterName))?.isFile) {
    type = "FCELL";
  } else if (statSafe(pathJoin(mapsetPath, "cell", rasterName))?.isFile) {
    type = "CELL";
  }

  return {
    name: rasterName,
    mapset: pathBasename(mapsetPath),
    type,
    region,
    format,
    compressed,
  };
}

/** Read a vector map's head file. Returns undefined if not present. */
export function readVectorInfo(mapsetPath: string, vectorName: string): VectorInfo | undefined {
  const vDir = pathJoin(mapsetPath, "vector", vectorName);
  const content = readTextFile(pathJoin(vDir, "head"));
  if (content === undefined) return undefined;

  const kv = parseKeyValue(content);
  return {
    name: vectorName,
    mapset: pathBasename(mapsetPath),
    organization: kv.ORGANIZATION || undefined,
    mapName: kv["MAP NAME"] || undefined,
    mapDate: kv["MAP DATE"] || undefined,
    mapScale: int(kv, "MAP SCALE"),
    zone: int(kv, "ZONE"),
    hasGeometry: statSafe(pathJoin(vDir, "coor"))?.isFile ?? false,
  };
}

// ---------- filesystem helpers ----------

function listFileNames(dirPath: string): string[] {
  return listDir(dirPath)
    .filter((e) => e.isFile && !e.name.startsWith("."))
    .map((e) => e.name);
}

function listDirNames(dirPath: string): string[] {
  return listDir(dirPath)
    .filter((e) => e.isDir && !e.name.startsWith("."))
    .map((e) => e.name);
}
