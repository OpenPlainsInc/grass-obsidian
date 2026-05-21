import { describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

import { parseKeyValue } from "../src/parser/kv";
import { parseRegion } from "../src/parser/region";
import { readProjInfo } from "../src/parser/proj";
import { scanMapset, readRasterInfo, readVectorInfo } from "../src/parser/mapset";
import { parseProject } from "../src/parser/project";
import { GrassParseError } from "../src/types";

const FIXTURE = path.join(__dirname, "fixtures", "sample_project");

// ---------------------------------------------------------------------------
// parseKeyValue
// ---------------------------------------------------------------------------

describe("parseKeyValue", () => {
  it("splits simple key/value lines", () => {
    expect(parseKeyValue("a: 1\nb: hello\n")).toEqual({ a: "1", b: "hello" });
  });

  it("tolerates CRLF line endings", () => {
    expect(parseKeyValue("a: 1\r\nb: 2\r\n")).toEqual({ a: "1", b: "2" });
  });

  it("ignores blank lines and #-comments", () => {
    expect(parseKeyValue("# header\n\na: 1\n# trailing\n")).toEqual({ a: "1" });
  });

  it("preserves colons in values", () => {
    expect(parseKeyValue("date: 2024-01-02T03:04:05")).toEqual({
      date: "2024-01-02T03:04:05",
    });
  });

  it("trims whitespace around keys and values", () => {
    expect(parseKeyValue("  key  :   value  ")).toEqual({ key: "value" });
  });

  it("returns empty object for empty input", () => {
    expect(parseKeyValue("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseRegion
// ---------------------------------------------------------------------------

describe("parseRegion", () => {
  const validRegion = `
proj:       99
zone:       0
north:      100
south:      0
east:       50
west:       0
cols:       50
rows:       100
e-w resol:  1
n-s resol:  1
`.trim();

  it("parses required fields", () => {
    const r = parseRegion(validRegion);
    expect(r.north).toBe(100);
    expect(r.south).toBe(0);
    expect(r.east).toBe(50);
    expect(r.west).toBe(0);
    expect(r.rows).toBe(100);
    expect(r.cols).toBe(50);
    expect(r.nsres).toBe(1);
    expect(r.ewres).toBe(1);
    expect(r.proj).toBe(99);
    expect(r.zone).toBe(0);
  });

  it("parses optional 3D fields when present", () => {
    const r3d = `${validRegion}\ntop:        10\nbottom:     0\nt-b resol:  1\ndepths:     5\n`;
    const r = parseRegion(r3d);
    expect(r.top).toBe(10);
    expect(r.bottom).toBe(0);
    expect(r.tbres).toBe(1);
    expect(r.depths).toBe(5);
  });

  it("throws when required fields are missing", () => {
    expect(() => parseRegion("proj: 99\nzone: 0\n")).toThrow(/missing required fields/);
  });
});

// ---------------------------------------------------------------------------
// readProjInfo
// ---------------------------------------------------------------------------

describe("readProjInfo", () => {
  it("merges PROJ_INFO, PROJ_UNITS, and PROJ_EPSG", () => {
    const proj = readProjInfo(path.join(FIXTURE, "PERMANENT"));
    expect(proj.name).toBe("Lambert Conformal Conic");
    expect(proj.proj).toBe("lcc");
    expect(proj.datum).toBe("nad83");
    expect(proj.ellipsoid).toBe("GRS80");
    expect(proj.units).toBe("meter");
    expect(proj.meters).toBe(1);
    expect(proj.epsg).toBe(3358);
  });

  it("returns an empty info for a directory with no PROJ_ files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "grass-proj-test-"));
    try {
      const proj = readProjInfo(tmp);
      expect(proj.name).toBeUndefined();
      expect(proj.epsg).toBeUndefined();
      expect(proj.raw).toEqual({});
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// scanMapset, readRasterInfo, readVectorInfo
// ---------------------------------------------------------------------------

describe("scanMapset", () => {
  const permanent = path.join(FIXTURE, "PERMANENT");

  it("enumerates rasters, vectors, 3d rasters", () => {
    const m = scanMapset(permanent);
    expect(m.name).toBe("PERMANENT");
    expect(m.rasters).toEqual(["elevation", "slope"]);
    expect(m.vectors).toEqual(["streets"]);
    expect(m.raster3d).toEqual(["elev3d"]);
    expect(m.groups).toEqual([]);
  });

  it("parses current region from WIND when present", () => {
    const m = scanMapset(permanent);
    expect(m.currentRegion).toBeDefined();
    expect(m.currentRegion?.cols).toBe(1500);
  });

  it("returns empty arrays for a fresh empty mapset", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "grass-empty-"));
    try {
      const m = scanMapset(tmp);
      expect(m.rasters).toEqual([]);
      expect(m.vectors).toEqual([]);
      expect(m.raster3d).toEqual([]);
      expect(m.currentRegion).toBeUndefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("readRasterInfo", () => {
  const permanent = path.join(FIXTURE, "PERMANENT");

  it("returns CELL type when only cell/<name> exists", () => {
    const info = readRasterInfo(permanent, "elevation");
    expect(info).toBeDefined();
    expect(info!.type).toBe("CELL");
    expect(info!.region.cols).toBe(1500);
    expect(info!.compressed).toBe(true);
  });

  it("returns FCELL type when fcell/<name> exists", () => {
    const info = readRasterInfo(permanent, "slope");
    expect(info!.type).toBe("FCELL");
  });

  it("returns undefined for missing rasters", () => {
    expect(readRasterInfo(permanent, "does_not_exist")).toBeUndefined();
  });
});

describe("readVectorInfo", () => {
  const permanent = path.join(FIXTURE, "PERMANENT");

  it("parses head fields", () => {
    const info = readVectorInfo(permanent, "streets");
    expect(info).toBeDefined();
    expect(info!.organization).toBe("NCSU");
    expect(info!.mapName).toBe("streets");
    expect(info!.mapScale).toBe(1);
    expect(info!.zone).toBe(0);
    expect(info!.hasGeometry).toBe(true);
  });

  it("returns undefined for missing vectors", () => {
    expect(readVectorInfo(permanent, "does_not_exist")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseProject (top-level)
// ---------------------------------------------------------------------------

describe("parseProject", () => {
  it("parses the full sample fixture", () => {
    const summary = parseProject(FIXTURE);
    expect(summary.name).toBe("sample_project");
    expect(summary.defaultRegion.cols).toBe(1500);
    expect(summary.proj.epsg).toBe(3358);

    // PERMANENT must come first regardless of alphabetic order.
    expect(summary.mapsets.map((m) => m.name)).toEqual(["PERMANENT", "user1"]);

    const perm = summary.mapsets[0];
    expect(perm.rasters).toEqual(["elevation", "slope"]);
    expect(perm.vectors).toEqual(["streets"]);

    const user = summary.mapsets[1];
    expect(user.rasters).toEqual(["derived_slope"]);
  });

  it("ignores directories without a WIND file", () => {
    // The fixture includes .tmp_should_be_ignored; verify it doesn't appear.
    const summary = parseProject(FIXTURE);
    expect(summary.mapsets.map((m) => m.name)).not.toContain(".tmp_should_be_ignored");
  });

  it("throws GrassParseError for a non-directory path", () => {
    expect(() => parseProject(path.join(FIXTURE, "PERMANENT", "WIND"))).toThrow(GrassParseError);
  });

  it("throws GrassParseError for a path that doesn't exist", () => {
    expect(() => parseProject("/nonexistent/grass/project/xyz123")).toThrow(GrassParseError);
  });

  it("throws GrassParseError for a directory missing PERMANENT", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "grass-bad-"));
    try {
      expect(() => parseProject(tmp)).toThrow(/missing PERMANENT/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("throws GrassParseError when PERMANENT lacks DEFAULT_WIND", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "grass-bad-"));
    try {
      fs.mkdirSync(path.join(tmp, "PERMANENT"));
      expect(() => parseProject(tmp)).toThrow(/missing PERMANENT\/DEFAULT_WIND/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
