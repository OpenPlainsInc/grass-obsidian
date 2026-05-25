/*!
 * @fileoverview Parses GRASS region/header blocks (WIND, DEFAULT_WIND, and
 *   per-raster cellhd files), enforcing required spatial keys and surfacing
 *   optional 2D/3D fields as a Region value.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import type { Region } from "../types";
import { num, int, parseKeyValue } from "./kv";

/**
 * Parse a GRASS region/header block.
 *
 * The same line-oriented format is used by:
 *   - <mapset>/WIND           (mapset's current region)
 *   - PERMANENT/DEFAULT_WIND  (project's default region)
 *   - <mapset>/cellhd/<map>   (per-raster header; includes format/compressed)
 *
 * Missing required spatial keys throw; optional fields stay undefined.
 */
export function parseRegion(content: string): Region {
  const r = parseKeyValue(content);

  const north = num(r, "north");
  const south = num(r, "south");
  const east = num(r, "east");
  const west = num(r, "west");
  // GRASS writes resolution as either "n-s resol" / "e-w resol" (no zero
  // padding) or, for 3D, also "t-b resol".
  const nsres = num(r, "n-s resol");
  const ewres = num(r, "e-w resol");
  const rows = int(r, "rows");
  const cols = int(r, "cols");

  const missing: string[] = [];
  if (north === undefined) missing.push("north");
  if (south === undefined) missing.push("south");
  if (east === undefined) missing.push("east");
  if (west === undefined) missing.push("west");
  if (nsres === undefined) missing.push("n-s resol");
  if (ewres === undefined) missing.push("e-w resol");
  if (rows === undefined) missing.push("rows");
  if (cols === undefined) missing.push("cols");
  if (missing.length > 0) {
    throw new Error(`region missing required fields: ${missing.join(", ")}`);
  }

  return {
    north: north!,
    south: south!,
    east: east!,
    west: west!,
    nsres: nsres!,
    ewres: ewres!,
    rows: rows!,
    cols: cols!,
    proj: int(r, "proj"),
    zone: int(r, "zone"),
    top: num(r, "top"),
    bottom: num(r, "bottom"),
    tbres: num(r, "t-b resol"),
    depths: int(r, "depths"),
  };
}
