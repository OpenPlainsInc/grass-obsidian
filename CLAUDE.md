# CLAUDE.md

Context for Claude Code working in this repo. Read this first.

---

## What this is

An Obsidian plugin (id: `grass`, repo dir: `grass-obsidian`) that displays and summarizes
[GRASS](https://grass.osgeo.org) projects inside Obsidian notes. It works
in two modes:

- **Desktop (Electron, has Node `fs`)**: parses the project directory directly
  off disk and renders a live summary.
- **Mobile (iOS/Android, no Node `fs`)**: renders a previously-cached summary
  for the same project reference, persisted in plugin `data.json` and synced
  to the device via Obsidian Sync (or any vault sync that includes
  `.obsidian/plugins/grass/`).

The plugin owner (Corey White) is a GRASS core contributor at NC State.
Assume domain literacy on the user side — don't over-explain GRASS concepts in
code comments, but DO keep links to upstream docs when introducing on-disk
formats that aren't obvious.

---

## Three architectural invariants — DO NOT BREAK

These are load-bearing. If you change them, change them deliberately and
update this file.

### 1. All Node built-ins go through `src/util/platform.ts`

A top-level `import * as fs from "fs"` (or `path`, or `os`) anywhere in the
plugin source will **crash the plugin at load time on Obsidian mobile**, where
those modules don't exist. The lazy wrapper in `src/util/platform.ts` catches
the require failure and exposes safe helpers (`readTextFile`, `statSafe`,
`listDir`, `pathJoin`, etc.) that return sensible empties on mobile.

When adding a parser file or any module that needs fs:

- ✅ `import { readTextFile, pathJoin } from "../util/platform";`
- ❌ `import * as fs from "fs";`
- ❌ `const fs = require("fs");`  (the wrapper does this internally with try/catch)

Test files (`tests/*.ts`) run in Node and CAN import `fs`/`path`/`os` directly.

### 2. Cache keys are the verbatim input path string

In `src/cache.ts`, entries are keyed by **what the user typed in the
directive** (e.g. `~/grassdata/nc_spm_08`), not by the resolved absolute path.
This is so the same key works on every device — `~` resolves differently on
desktop vs. mobile, but the literal string in the markdown is identical.

When working on cache-related code:

- The cache key is always the raw string from `path:` (or frontmatter), trimmed.
- The *resolved* path is for filesystem access only and lives in the entry's
  `resolvedPath` field as a diagnostic — never as a lookup key.
- `cacheKey(input)` normalizes (currently just `.trim()`). Use it when in doubt.

### 3. `ProjectSummary` must be JSON-safe

Cache entries round-trip through `JSON.stringify` → `data.json` → `JSON.parse`.
This means **no `Date`, no `RegExp`, no `Map`, no class instances** in any
field of `ProjectSummary` or its nested types. The one timestamp we have
(`MapsetSummary.lastModified`) is `number` (epoch ms); render layers convert
to `Date` only at display time.

If you add a field that isn't a primitive / plain array / plain object, you
need a custom (de)serializer — and a regression test in `tests/cache.test.ts`
that round-trips through `JSON.stringify`/`JSON.parse`.

---

## Code map

```
src/
  main.ts            Plugin entry. Registers code-block processor, view, ribbon, commands, settings tab. Owns the cache + settings, persists them via Plugin.saveData().
  settings.ts        Settings interface, defaults, settings tab UI.
  types.ts           Shared types (ProjectSummary, MapsetSummary, Region, ProjInfo, GrassParseError). The contract between parser and views.
  cache.ts           Pure cache logic: emptyCache, getCached, setCached, loadCache (defensive deserialize), LRU eviction at MAX_CACHE_ENTRIES (100).
  parser/
    kv.ts            Generic GRASS key:value text-file parser. Handles CRLF, comments, numeric coercion (num/int helpers).
    region.ts        WIND / DEFAULT_WIND / cellhd parser. Throws on missing required fields.
    proj.ts          PROJ_INFO + PROJ_UNITS + PROJ_EPSG reader. Returns empty ProjInfo for XY/abstract projects.
    mapset.ts        Mapset scanner. scanMapset (counts/lists), readRasterInfo (with CELL/FCELL type detection), readVectorInfo.
    project.ts       Top-level orchestrator. Validates layout (PERMANENT/DEFAULT_WIND), enumerates mapsets, sorts PERMANENT first.
    index.ts         Barrel export.
  util/
    platform.ts      Lazy fs/path/os wrapper (see invariant #1).
    path.ts          expandHome, resolveProjectPath, isAbsoluteLike. All built on top of platform.ts.
  view/
    render.ts        Pure DOM. renderSummary(summary, opts) for live/cached, renderError, renderMissing. Uses Obsidian theme CSS variables.
    resolve.ts       The cache-fallback decision. resolveProject() returns {kind:"live"} | {kind:"cache", cachedAt} | {kind:"missing", reason, filesystemUnavailable}. See invariant logic below.
    code-block.ts    Markdown code-block processor for ```grass blocks. Wraps resolve.
    pane.ts          Right-pane ItemView bound to active note's frontmatter (grass / grass_project / grassProject). Wraps resolve. Has a refresh() method exposed for the command palette.

tests/
  parser.test.ts     25 tests over the synthetic fixture.
  cache.test.ts      13 tests for the cache module.
  resolve.test.ts    4 tests for the live/cache/missing decision tree using the real fixture and a fake nonexistent path.
  mobile.test.ts     3 tests that hoist vi.mock("../src/util/platform") to simulate "no fs" and verify cache fallback works without it.
  fixtures/
    sample_project/  Synthetic NC State Plane (EPSG:3358) project: PERMANENT (rasters elevation/slope, vector streets, raster3d elev3d) + user1 mapset (raster derived_slope).
```

The `resolveProject` decision tree (since it's the central control flow):

```
isFilesystemAvailable()?
├── yes → parseProject(resolvedPath)
│         ├── ok → setCached, save, return {kind:"live"}
│         └── throw → capture error, fall through
└── no  → fall through (record reason "fs unavailable")

cache hit?
├── yes → return {kind:"cache", cachedAt}
└── no  → return {kind:"missing", reason, filesystemUnavailable}
```

Live reads always overwrite cache. Cache reads NEVER write to cache.

---

## Commands

From the project root:

```bash
npm install
npm run typecheck       # tsc --noEmit --skipLibCheck
npm run test            # vitest run
npm run build           # typecheck + esbuild production → main.js
npm run dev             # esbuild watch mode (for live development)
```

After any change, before declaring done: **`npm run typecheck && npm run test
&& npm run build`** must all pass. The current baseline is **45/45 tests
passing, clean typecheck, ~15K production bundle**.

To install into an Obsidian vault for manual testing, copy/symlink three files
into `<vault>/.obsidian/plugins/grass/`:

```
manifest.json
main.js
styles.css
```

Then enable from *Settings → Community plugins*. There is no published release
yet — install is dev/manual only.

---

## Conventions

- **TypeScript strictness**: `strictNullChecks` is on. `noImplicitAny` is on.
  Don't sprinkle `any` to dodge errors — type the boundary properly.
- **Comments**: JSDoc on exported symbols. Inline comments explain *why*, not
  *what*. ⚠️ JSDoc gotcha: `*/` inside the comment body (e.g.
  `vector/*/head`) closes the comment early. Use `<name>` placeholder style
  (`vector/<name>/head`) instead.
- **CSS**: All styling goes in `styles.css` and uses Obsidian theme CSS
  variables (`--text-normal`, `--background-secondary`,
  `--background-modifier-border`, etc.) so light/dark mode work without
  per-mode rules. Class names follow BEM-ish `.grass__<element>` /
  `.grass--<modifier>`.
- **DOM**: Render helpers use standard `document.createElement` (not
  Obsidian's `createEl` / `createDiv`) so they're portable and testable.
  `container.empty?.()` is the one Obsidian extension we use (with optional
  chaining for safety).
- **Errors**: `GrassParseError` for any "this isn't a valid GRASS project"
  failure. Other errors bubble up unwrapped. Views catch both and render via
  `renderError` / `renderMissing`.
- **Test discipline**: Corey strongly prefers analytical/closed-form ground
  truth over recorded baselines. When adding a new parser, write fixture
  files with known-correct values and assert exact equality — not snapshots.

---

## How to add common things

### A new parsed field on `ProjectSummary` or `MapsetSummary`

1. Add to `src/types.ts`. Pick a JSON-safe representation (see invariant #3).
2. Extend the parser file that produces it.
3. Add a render branch in `src/view/render.ts` (usually in
   `renderProjBlock` / `renderRegionBlock` / `renderMapsetsBlock`).
4. Add a parser test in `tests/parser.test.ts` — use the existing fixture or
   extend it. If you extend the fixture, update other tests that count
   rasters/vectors/etc.
5. **Cache compatibility**: if the field is optional, existing cached
   summaries still load fine. If it's required, you've broken old caches —
   bump a schema version in `src/cache.ts` and have `loadCache` discard
   entries without it.

### A new GRASS file type to read (e.g. `hist/`, `cats/`, `colr/`)

1. Add the reader in `src/parser/mapset.ts` (or a new file under `src/parser/`).
   Use `readTextFile` / `statSafe` from `util/platform`, not direct fs.
2. Extend the synthetic fixture under `tests/fixtures/sample_project/`.
3. Decide whether it loads eagerly (in `scanMapset`) or lazily (a separate
   `readXyz` function called from views on click). Default to lazy for
   anything that's per-map and potentially numerous.

### A new view surface (e.g. a status-bar item)

1. Wire it in `src/main.ts:onload()`.
2. Build it on top of `resolveProject` from `src/view/resolve.ts` — never
   bypass the live/cache/missing decision. If you do, mobile breaks.

### A "refresh the cache" command

`addCommand` in `main.ts` with a callback that calls `deleteCached(cache,
key)` + `savePersisted()`, then triggers a re-render. The pane already has a
`refresh()` method exposed for this.

---

## What's NOT done yet

In rough priority order:

1. **Per-map drilldown on click**. The data is already cached
   (`readRasterInfo` / `readVectorInfo` exist) but views only show name lists.
2. **Stale-cache warning**. When `cachedAt` is more than N days old, show a
   warning chip. Easy in `render.ts`.
3. **Manual cache management UI**. A list view of cached projects with
   per-entry "forget" buttons in the settings tab.
4. **Thumbnails** via `grass` shell-out. Strictly desktop. Would shell out to
   `grass <project>/PERMANENT --exec d.rast map=...` and base64 the PNG into
   the cache so mobile shows it too. Probably the highest-value next feature.
5. **History / cats / colr readers**. Trivial extension of the existing
   parser pattern.

---

## Domain notes (GRASS-specific)

You can mostly stay focused on the parser and trust the existing data shapes,
but in case you need to extend it:

- **Project** (formerly "location") = top-level directory; defines CRS.
- **Mapset** = subdirectory; identified by presence of a `WIND` file.
  PERMANENT is mandatory and owns the project's CRS files.
- **PROJ_INFO / PROJ_UNITS** are colon-separated key/value text. **PROJ_EPSG**
  is just `epsg: NNNN` on one line (newer GRASS). **PROJ_WKT** also exists in
  newer GRASS and we don't parse it yet — adding it would let us drop the
  EPSG-only fallback for unprojected lookups.
- **`WIND` / `DEFAULT_WIND` / `cellhd/<name>`** use the same key/value schema
  (proj, zone, north/south/east/west, n-s resol, e-w resol, rows, cols, plus
  optional 3D fields top/bottom/t-b resol/depths).
- **Rasters**: header is `cellhd/<name>` (text). Binary data is `cell/<name>`
  for integer (CELL) or `fcell/<name>` for floating (FCELL/DCELL — we can't
  cheaply distinguish without reading the binary header).
- **Vectors**: `vector/<name>/` is a directory with a text `head` file and a
  binary `coor` (geometry). Topology/category index live in sibling files.
- **3D rasters**: live in `grid3/<name>`.
- **Groups**: imagery groups; `group/<name>/` is a directory.

Official reference:
<https://grass.osgeo.org/grass-stable/manuals/grass_database.html>

---

## Pitfalls that already bit us once

- **JSDoc `*/` inside a comment closes it early.** A docstring containing
  `vector/*/head` killed typecheck with a cascade of nonsense errors. Use
  `<name>` placeholders.
- **`vi.doMock` doesn't intercept already-imported modules.** For
  mobile-simulation tests, use top-of-file `vi.mock(...)` (hoisted) — see
  `tests/mobile.test.ts` for the pattern.
- **`isDesktopOnly: false` only works if every module on the import graph is
  mobile-safe.** Auditing `grep -r 'from "fs"' src/` is a good sanity check
  before declaring mobile support done.

---

## When in doubt

- Prefer making the change in `src/util/platform.ts` over scattering platform
  conditionals.
- Prefer extending the synthetic fixture over mocking parser internals.
- Prefer rendering a polite empty state (`renderMissing`) over throwing.
- Don't introduce a dependency without checking it works under esbuild's
  bundling + Obsidian's Electron environment + mobile.
