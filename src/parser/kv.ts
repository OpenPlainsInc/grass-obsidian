/*!
 * @fileoverview Generic `key: value` parser shared by every GRASS metadata file
 *   (PROJ_INFO, WIND, cellhd, vector head, ...). Handles CRLF, comments, and
 *   numeric coercion so semantic parsers can work over Record<string, string>.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

/**
 * GRASS metadata files (PROJ_INFO, WIND, cellhd, vector head, ...) all use
 * a simple "key: value" line-oriented format. Some files have leading/trailing
 * whitespace and some use CRLF line endings (Windows-created projects).
 *
 * This module isolates the trivial parsing so the rest of the codebase can
 * treat the files as Record<string, string> and worry about semantics.
 */

/** Split a key/value file into a plain object. Later keys overwrite earlier. */
export function parseKeyValue(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Normalize line endings; tolerate CRLF and stray trailing whitespace.
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key.length === 0) continue;
    out[key] = value;
  }
  return out;
}

/** Parse a numeric field; returns undefined if missing or not finite. */
export function num(record: Record<string, string>, key: string): number | undefined {
  const v = record[key];
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse an integer field; returns undefined if missing or NaN. */
export function int(record: Record<string, string>, key: string): number | undefined {
  const v = record[key];
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
