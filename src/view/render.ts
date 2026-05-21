import type { MapsetSummary, ProjectSummary, Region, ProjInfo } from "../types";

/** Optional rendering context that view callers pass in. */
export interface RenderOptions {
  /** True when the summary came from the cache rather than a fresh fs read. */
  cached?: boolean;
  /** Epoch ms when the cache entry was populated. Only meaningful when cached. */
  cachedAt?: number;
  /** Whether fs is available on this platform. Drives the empty-state copy. */
  filesystemAvailable?: boolean;
}

/**
 * Render a full ProjectSummary into a container element.
 *
 * Uses only standard DOM APIs (no Obsidian-specific helpers) so the same
 * function works in both the code-block processor and the right-pane view.
 * Styling is left to styles.css, which leans on Obsidian theme CSS variables.
 */
export function renderSummary(
  container: HTMLElement,
  summary: ProjectSummary,
  opts: RenderOptions = {},
): void {
  container.empty?.();
  container.classList.add("grass");
  if (opts.cached) container.classList.add("grass--cached");

  container.appendChild(renderHeader(summary, opts));
  container.appendChild(renderProjBlock(summary.proj));
  container.appendChild(renderRegionBlock("Default region", summary.defaultRegion));
  container.appendChild(renderMapsetsBlock(summary.mapsets));
}

/** Render an error message in the same container in a consistent style. */
export function renderError(container: HTMLElement, message: string): void {
  container.empty?.();
  container.classList.add("grass", "grass--error");
  const div = document.createElement("div");
  div.className = "grass__error";
  div.textContent = `GRASS project: ${message}`;
  container.appendChild(div);
}

/**
 * Render the "not on disk and not in cache" empty state. We treat this
 * differently from `renderError` because it isn't really an error from the
 * user's perspective — the project just hasn't been seen on this device yet.
 */
export function renderMissing(
  container: HTMLElement,
  args: { projectRef: string; reason: string; filesystemAvailable: boolean },
): void {
  container.empty?.();
  container.classList.add("grass", "grass--missing");

  const wrap = document.createElement("div");
  wrap.className = "grass__missing";

  const title = el("div", "grass__title");
  title.textContent = args.projectRef;
  wrap.appendChild(title);

  const msg = el("div", "grass__muted");
  msg.textContent = args.filesystemAvailable
    ? `Couldn't read this project, and no cached summary is available. ${args.reason}`
    : `This device can't read the project files. Open the same note on a desktop where the project is present to populate the cache; it will then display here.`;
  wrap.appendChild(msg);

  container.appendChild(wrap);
}

// ---------------------------------------------------------------------------

function renderHeader(summary: ProjectSummary, opts: RenderOptions): HTMLElement {
  const wrap = el("div", "grass__header");
  const title = el("div", "grass__title");
  title.textContent = summary.name;
  wrap.appendChild(title);

  const sub = el("div", "grass__subtitle");
  sub.textContent = summary.path;
  wrap.appendChild(sub);

  // Top-of-card "chip" row: cache state / CRS / EPSG / mapset count.
  const chips = el("div", "grass__chips");
  if (opts.cached) {
    const text = opts.cachedAt ? `cached ${formatEpoch(opts.cachedAt)}` : "cached";
    chips.appendChild(chip(text, "grass__chip--cached"));
  }
  if (summary.proj.epsg !== undefined) {
    chips.appendChild(chip(`EPSG:${summary.proj.epsg}`));
  }
  if (summary.proj.name) {
    chips.appendChild(chip(summary.proj.name));
  } else if (summary.proj.proj) {
    chips.appendChild(chip(summary.proj.proj));
  } else {
    chips.appendChild(chip("XY / abstract"));
  }
  chips.appendChild(
    chip(`${summary.mapsets.length} mapset${summary.mapsets.length === 1 ? "" : "s"}`),
  );
  wrap.appendChild(chips);

  return wrap;
}

function renderProjBlock(proj: ProjInfo): HTMLElement {
  const details = el("details", "grass__section") as HTMLDetailsElement;
  const summary = el("summary");
  summary.textContent = "Projection";
  details.appendChild(summary);

  const dl = el("dl", "grass__dl");
  dlRow(dl, "Name", proj.name);
  dlRow(dl, "EPSG", proj.epsg !== undefined ? String(proj.epsg) : undefined);
  dlRow(dl, "Proj", proj.proj);
  dlRow(dl, "Datum", proj.datum);
  dlRow(dl, "Ellipsoid", proj.ellipsoid);
  dlRow(dl, "Units", proj.units);
  dlRow(dl, "Meters/unit", proj.meters !== undefined ? formatNumber(proj.meters) : undefined);
  details.appendChild(dl);

  return details;
}

function renderRegionBlock(label: string, region: Region): HTMLElement {
  const details = el("details", "grass__section") as HTMLDetailsElement;
  details.open = true;
  const summary = el("summary");
  summary.textContent = label;
  details.appendChild(summary);

  const dl = el("dl", "grass__dl");
  dlRow(dl, "North", formatNumber(region.north));
  dlRow(dl, "South", formatNumber(region.south));
  dlRow(dl, "East", formatNumber(region.east));
  dlRow(dl, "West", formatNumber(region.west));
  dlRow(dl, "Resolution", `${formatNumber(region.ewres)} × ${formatNumber(region.nsres)}`);
  dlRow(dl, "Size", `${region.cols} × ${region.rows}`);
  if (region.top !== undefined && region.bottom !== undefined) {
    dlRow(dl, "Top / Bottom", `${formatNumber(region.top)} / ${formatNumber(region.bottom)}`);
  }
  details.appendChild(dl);

  return details;
}

function renderMapsetsBlock(mapsets: MapsetSummary[]): HTMLElement {
  const details = el("details", "grass__section") as HTMLDetailsElement;
  details.open = true;
  const summary = el("summary");
  summary.textContent = `Mapsets (${mapsets.length})`;
  details.appendChild(summary);

  if (mapsets.length === 0) {
    const p = el("div", "grass__muted");
    p.textContent = "No mapsets found.";
    details.appendChild(p);
    return details;
  }

  // Compact table: one row per mapset with counts.
  const table = el("table", "grass__table");
  const thead = el("thead");
  const headRow = el("tr");
  for (const h of ["Mapset", "Rasters", "Vectors", "3D", "Groups", "Modified"]) {
    const th = el("th");
    th.textContent = h;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (const m of mapsets) {
    const tr = el("tr");
    const nameTd = el("td");
    const nameEl = el("span", "grass__mapset-name");
    nameEl.textContent = m.name;
    nameTd.appendChild(nameEl);
    tr.appendChild(nameTd);
    tr.appendChild(numCell(m.rasters.length));
    tr.appendChild(numCell(m.vectors.length));
    tr.appendChild(numCell(m.raster3d.length));
    tr.appendChild(numCell(m.groups.length));
    const dateTd = el("td", "grass__muted");
    dateTd.textContent = m.lastModified ? formatEpoch(m.lastModified) : "—";
    tr.appendChild(dateTd);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  details.appendChild(table);

  // Per-mapset drill-down with map lists.
  for (const m of mapsets) {
    if (
      m.rasters.length === 0 &&
      m.vectors.length === 0 &&
      m.raster3d.length === 0 &&
      m.groups.length === 0
    ) {
      continue;
    }
    details.appendChild(renderMapsetDrill(m));
  }

  return details;
}

function renderMapsetDrill(m: MapsetSummary): HTMLElement {
  const details = el("details", "grass__mapset") as HTMLDetailsElement;
  const summary = el("summary");
  summary.textContent = `${m.name} — ${m.rasters.length}R · ${m.vectors.length}V · ${m.raster3d.length}R3 · ${m.groups.length}G`;
  details.appendChild(summary);

  if (m.rasters.length > 0) details.appendChild(mapList("Rasters", m.rasters));
  if (m.vectors.length > 0) details.appendChild(mapList("Vectors", m.vectors));
  if (m.raster3d.length > 0) details.appendChild(mapList("3D rasters", m.raster3d));
  if (m.groups.length > 0) details.appendChild(mapList("Groups", m.groups));

  return details;
}

function mapList(label: string, names: string[]): HTMLElement {
  const wrap = el("div", "grass__maplist");
  const h = el("div", "grass__maplist-label");
  h.textContent = `${label} (${names.length})`;
  wrap.appendChild(h);
  const ul = el("ul");
  // Cap the visible list at 100 to keep huge mapsets tractable; we surface the
  // overflow rather than truncating silently.
  const limit = 100;
  const shown = names.slice(0, limit);
  for (const n of shown) {
    const li = el("li");
    li.textContent = n;
    ul.appendChild(li);
  }
  wrap.appendChild(ul);
  if (names.length > limit) {
    const more = el("div", "grass__muted");
    more.textContent = `… ${names.length - limit} more`;
    wrap.appendChild(more);
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// tiny DOM helpers

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function chip(text: string, extraClass?: string): HTMLElement {
  const c = el("span", `grass__chip${extraClass ? ` ${extraClass}` : ""}`);
  c.textContent = text;
  return c;
}

function dlRow(dl: HTMLElement, label: string, value?: string): void {
  if (value === undefined || value === "") return;
  const dt = el("dt");
  dt.textContent = label;
  const dd = el("dd");
  dd.textContent = value;
  dl.appendChild(dt);
  dl.appendChild(dd);
}

function numCell(n: number): HTMLElement {
  const td = el("td", "grass__num");
  td.textContent = String(n);
  return td;
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  // Keep small numbers readable; round large ones to a reasonable precision.
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(Number(n.toFixed(6)));
}

function formatEpoch(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
