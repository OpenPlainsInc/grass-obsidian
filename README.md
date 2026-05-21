# GRASS

An Obsidian plugin that displays and summarizes [GRASS GIS](https://grass.osgeo.org) projects directly inside your notes.

It reads a GRASS project from disk (no GRASS install required), parses the on-disk metadata (`PROJ_INFO`, `PROJ_UNITS`, `PROJ_EPSG`, `WIND`, `DEFAULT_WIND`, `cellhd/*`, `vector/*/head`, …) and renders a clean, theme-aware summary.

## Features

- **Inline code block** — embed a project summary anywhere in a note:

  ````markdown
  ```grass
  path: ~/grassdata/nc_spm_08
  ```
  ````

- **Right-pane view** — auto-summarizes the project linked from the active note's frontmatter:

  ```markdown
  ---
  grass: ~/grassdata/nc_spm_08
  ---
  ```

- **What you get** — project name, CRS (with EPSG when present), default region, mapsets table (raster / vector / 3D raster / group counts), and per-mapset drill-downs of the actual map names.

- **Mobile-aware** — if the project files aren't on the current device (e.g. on Obsidian mobile), the plugin shows the most recent summary cached when the same note was opened on a desktop. A subtle "cached" chip marks offline data.

- **Pure filesystem** — no Python, no GRASS binary, no shell-out. Works on any desktop that can see the project directory; mobile devices read from the cache.

## Install

### From the Obsidian community catalog

*(Not yet listed — see "Beta install via BRAT" below until the first community release.)*

Once published: *Settings → Community plugins → Browse*, search for "GRASS", install, and enable.

### Beta install via BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin from the community catalog.
2. *Settings → BRAT → Add Beta plugin* → paste this repo URL.
3. Enable **GRASS** under *Settings → Community plugins*.

### Manual / development install

```bash
git clone https://github.com/<you>/grass
cd grass
npm install
npm run build
```

Copy or symlink the build output (`manifest.json`, `main.js`, `styles.css`) into your vault under `.obsidian/plugins/grass/`, then enable the plugin from *Settings → Community plugins*.

## Use

After enabling, you have three entry points:

1. **A code block.** Either YAML-style or a bare path:

   ````markdown
   ```grass
   path: ~/grassdata/nc_spm_08
   ```
   ````

   ````markdown
   ```grass
   ~/grassdata/nc_spm_08
   ```
   ````

2. **The right-pane view.** Click the globe ribbon icon (or run *Open GRASS view* from the command palette). The pane summarizes whichever project is referenced by the active note's frontmatter (`grass`, `grass_project`, or `grassProject`).

3. **Bare project names.** If you configure *Settings → GRASS → Default grassdata directory*, you can reference projects by name only (e.g. `nc_spm_08`) and they'll be resolved against that root.

## How the cache works

Every successful render on desktop writes the parsed `ProjectSummary` to the plugin's `data.json` under the **verbatim path string** the directive used as its key. So this:

````markdown
```grass
path: ~/grassdata/nc_spm_08
```
````

and a note with `grass: ~/grassdata/nc_spm_08` in its frontmatter share one cache entry, keyed by the literal string `~/grassdata/nc_spm_08`. When you open the same note on a mobile device, the plugin looks up that same string, finds the cached summary, and renders it identically — with a subtle "cached" chip in the header so you can tell it's offline data.

For this to reach mobile, your `data.json` needs to sync to the device. The two reliable options are:

- **Obsidian Sync** with *Plugin settings* turned on; or
- a vault sync that includes `.obsidian/plugins/grass/data.json` (iCloud, Syncthing, Git, etc.).

Cache eviction is LRU with a 100-entry cap. Re-rendering on desktop refreshes the entry; on mobile the cache is never written to.

## Project layout it understands

The plugin treats a directory as a GRASS project when it contains a `PERMANENT/` mapset with a `DEFAULT_WIND` file. Within each mapset it scans:

| File / directory      | Used for                                        |
|-----------------------|-------------------------------------------------|
| `WIND`                | Current region for the mapset                   |
| `cellhd/*`            | Raster map list and per-raster headers          |
| `cell/*`              | Detecting `CELL` (integer) raster type          |
| `fcell/*`             | Detecting `FCELL`/`DCELL` (floating) type       |
| `vector/<name>/head`  | Vector map list and metadata                    |
| `vector/<name>/coor`  | "Has geometry" indicator                        |
| `grid3/*`             | 3D raster list                                  |
| `group/*`             | Imagery group list                              |

## Development

```bash
npm run dev        # esbuild in watch mode
npm run typecheck  # tsc -noEmit
npm run test       # vitest run
npm run lint       # biome check
```

Tests use a synthetic GRASS project fixture under `tests/fixtures/sample_project`. Parsers are pure functions over filesystem paths and content strings, so the suite runs without any Obsidian or GRASS runtime.

## Releasing

Tags trigger `.github/workflows/release.yml`, which builds and attaches `main.js`, `manifest.json`, and `styles.css` to a **draft** GitHub release. To cut a release:

```bash
npm version patch   # syncs manifest.json + versions.json via version-bump.mjs
git push --follow-tags
```

Then go to the GitHub draft release, add notes, and publish.

## Not (yet) included

- Thumbnails / map rendering (would shell out to a `grass` binary).
- Editing / writing back to GRASS.
- Reading map history (`hist/<name>`), category labels (`cats/<name>`), or color tables (`colr/<name>`).
- A manual cache eviction UI (right now: edit `data.json` or use the settings tab — TBD).

These are intentional v0.1 omissions; the parser and cache are structured so they can slot in.

## License

MIT
