/*!
 * @fileoverview Shared type contract between the parser, cache, and views.
 *   Declares ProjectSummary, MapsetSummary, Region, ProjInfo, raster/vector
 *   metadata shapes, and the GrassParseError class. All types are JSON-safe.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

/**
 * Shared types for the GRASS project parser and views.
 *
 * Terminology mirrors GRASS:
 *   - "project" (formerly "location") = top-level directory; defines a CRS.
 *   - "mapset"                         = sub-directory within a project; a working area.
 *   - PERMANENT                        = mandatory mapset that owns CRS files.
 */

/** Geographic region / window. Same shape as GRASS WIND / cellhd files. */
export interface Region {
  north: number;
  south: number;
  east: number;
  west: number;
  nsres: number;
  ewres: number;
  rows: number;
  cols: number;
  proj?: number;
  zone?: number;
  /** Vertical bounds for 3D regions; undefined for 2D. */
  top?: number;
  bottom?: number;
  tbres?: number;
  depths?: number;
}

/** Parsed projection metadata from PROJ_INFO / PROJ_UNITS / PROJ_EPSG. */
export interface ProjInfo {
  /** Human-readable projection name (PROJ_INFO "name"). */
  name?: string;
  /** PROJ short code (e.g. "lcc", "utm", "longlat"). */
  proj?: string;
  datum?: string;
  ellipsoid?: string;
  /** Linear units name, e.g. "meter", "us-foot". */
  units?: string;
  /** Meters per linear unit. */
  meters?: number;
  /** EPSG code if PROJ_EPSG is present. */
  epsg?: number;
  /** Raw key/value content of PROJ_INFO for advanced users. */
  raw: Record<string, string>;
}

/** Raster type derived from filesystem layout (cell/ vs fcell/). */
export type RasterType = "CELL" | "FCELL" | "DCELL" | "unknown";

/** Header info for a single raster map (from cellhd/<name>). */
export interface RasterInfo {
  name: string;
  mapset: string;
  type: RasterType;
  region: Region;
  format?: number;
  compressed?: boolean;
}

/** Header info for a single vector map (from vector/<name>/head). */
export interface VectorInfo {
  name: string;
  mapset: string;
  organization?: string;
  mapName?: string;
  mapDate?: string;
  mapScale?: number;
  zone?: number;
  /** Whether the binary geometry file (coor) exists. */
  hasGeometry: boolean;
}

/** Summary of one mapset. */
export interface MapsetSummary {
  name: string;
  path: string;
  currentRegion?: Region;
  rasters: string[];
  vectors: string[];
  raster3d: string[];
  groups: string[];
  /** mtime of the mapset directory (best-effort "last touched"). Epoch ms. */
  lastModified?: number;
}

/** Top-level summary of a GRASS project. */
export interface ProjectSummary {
  name: string;
  path: string;
  proj: ProjInfo;
  defaultRegion: Region;
  mapsets: MapsetSummary[];
}

/** Lightweight error class so views can render parser failures cleanly. */
export class GrassParseError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = "GrassParseError";
  }
}
