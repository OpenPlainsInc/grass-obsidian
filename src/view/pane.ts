import { ItemView, type TFile, type WorkspaceLeaf, type App } from "obsidian";
import type { ProjectCacheState } from "../cache";
import { isAbsoluteLike, resolveProjectPath } from "../util/path";
import { isFilesystemAvailable, pathJoin } from "../util/platform";
import { renderError, renderMissing, renderSummary } from "./render";
import { resolveProject } from "./resolve";

export const VIEW_TYPE_GRASS = "grass-view";

/** Context the view receives from the plugin. */
export interface PaneContext {
  getDefaultGrassdata: () => string;
  getCache: () => ProjectCacheState;
  saveCache: () => void;
}

/**
 * Side-pane view that auto-summarizes the GRASS project linked from the
 * currently active markdown file's frontmatter:
 *
 *   ---
 *   grass: ~/grassdata/nc_spm_08
 *   ---
 *
 * Re-renders on file-open / metadata-change so editing the frontmatter updates
 * the pane immediately. On mobile (no fs) the pane shows the cached summary
 * if one exists, otherwise an empty-state message.
 */
export class GrassProjectView extends ItemView {
  private ctx: PaneContext;

  constructor(leaf: WorkspaceLeaf, ctx: PaneContext) {
    super(leaf);
    this.ctx = ctx;
  }

  getViewType(): string {
    return VIEW_TYPE_GRASS;
  }

  getDisplayText(): string {
    return "GRASS";
  }

  getIcon(): string {
    return "globe";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const active = this.app.workspace.getActiveFile();
        if (active && file.path === active.path) this.refresh();
      }),
    );
    this.refresh();
  }

  async onClose(): Promise<void> {
    // No cleanup beyond automatic event unregistration.
  }

  /** Public so command-palette / ribbon can force a re-read after edits. */
  refresh(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    const file = this.app.workspace.getActiveFile();
    const pathStr = this.readProjectPath(file);

    if (!pathStr) {
      const wrap = document.createElement("div");
      wrap.className = "grass grass--empty";
      wrap.textContent =
        "No GRASS project linked from this note. Add a `grass:` field to the frontmatter, or open a note with one.";
      container.appendChild(wrap);
      return;
    }

    let resolved = resolveProjectPath(pathStr);
    if (!isAbsoluteLike(resolved)) {
      const root = this.ctx.getDefaultGrassdata();
      if (root) resolved = resolveProjectPath(pathJoin(root, pathStr));
    }

    const result = resolveProject({
      cacheKey: pathStr,
      resolvedPath: resolved,
      cache: this.ctx.getCache(),
      onCacheUpdated: this.ctx.saveCache,
    });

    if (result.kind === "missing") {
      renderMissing(container, {
        projectRef: pathStr,
        reason: result.reason,
        filesystemAvailable: !result.filesystemUnavailable,
      });
      return;
    }

    renderSummary(container, result.summary, {
      cached: result.kind === "cache",
      cachedAt: result.cachedAt,
      filesystemAvailable: isFilesystemAvailable(),
    });
  }

  /**
   * Pull a project path from frontmatter. Accepts these keys (first match wins):
   *   grass, grass_project, grassProject
   */
  private readProjectPath(file: TFile | null): string | undefined {
    if (!file) return undefined;
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm) return undefined;
    const v = fm.grass ?? fm.grass_project ?? fm.grassProject;
    return typeof v === "string" && v.length > 0 ? v : undefined;
  }
}

/** Convenience for plugins to open or focus the view. */
export async function activateGrassView(app: App): Promise<void> {
  const { workspace } = app;
  let leaf: WorkspaceLeaf | null = null;
  const existing = workspace.getLeavesOfType(VIEW_TYPE_GRASS);
  if (existing.length > 0) {
    leaf = existing[0] ?? null;
  } else {
    leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_GRASS,
        active: true,
      });
    }
  }
  if (leaf) workspace.revealLeaf(leaf);
}
