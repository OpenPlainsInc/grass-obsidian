/*!
 * @fileoverview Barrel export for the GRASS parser module. Re-exports the
 *   public surface (parseProject, parseRegion, readProjInfo, scanMapset,
 *   readRasterInfo, readVectorInfo, parseKeyValue) so callers import from one place.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

export { parseProject } from "./project";
export { parseRegion } from "./region";
export { readProjInfo } from "./proj";
export { scanMapset, readRasterInfo, readVectorInfo } from "./mapset";
export { parseKeyValue } from "./kv";
