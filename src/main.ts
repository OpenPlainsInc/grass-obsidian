/*!
 * @fileoverview Obsidian plugin entry point. Registers the `grass` code-block
 *   processor, the right-pane GRASS view, ribbon icon, commands, and settings tab,
 *   and owns the in-memory cache + settings persisted through Plugin.saveData().
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import { Plugin } from "obsidian";
import { emptyCache, loadCache, type ProjectCacheState } from "./cache";
import { DEFAULT_SETTINGS, GrassProjectSettingTab, type GrassProjectSettings } from "./settings";
import { isFilesystemAvailable } from "./util/platform";
import { makeCodeBlockProcessor } from "./view/code-block";
import { GrassProjectView, VIEW_TYPE_GRASS, activateGrassView } from "./view/pane";

/**
 * Persisted-state shape stored in `.obsidian/plugins/grass/data.json`.
 *
 * Two top-level slots:
 *   - settings: user-facing options.
 *   - cache:    project summaries previously rendered on a desktop, keyed by
 *               the verbatim path string from the directive. Survives reloads
 *               and (via Obsidian Sync of plugin data) propagates to mobile
 *               devices where the underlying project tree isn't present.
 */
interface PersistedData {
  settings: GrassProjectSettings;
  cache: ProjectCacheState;
}

export default class GrassProjectPlugin extends Plugin {
  settings: GrassProjectSettings = { ...DEFAULT_SETTINGS };
  cache: ProjectCacheState = emptyCache();

  async onload(): Promise<void> {
    await this.loadPersisted();

    this.registerMarkdownCodeBlockProcessor(
      "grass",
      makeCodeBlockProcessor({
        getDefaultGrassdata: () => this.settings.grassdataRoot,
        getCache: () => this.cache,
        saveCache: () => {
          // Fire-and-forget; failures are logged but shouldn't disrupt rendering.
          void this.savePersisted().catch((e) => console.error("[grass] failed to save cache:", e));
        },
        isFilesystemAvailable,
      }),
    );

    this.registerView(
      VIEW_TYPE_GRASS,
      (leaf) =>
        new GrassProjectView(leaf, {
          getDefaultGrassdata: () => this.settings.grassdataRoot,
          getCache: () => this.cache,
          saveCache: () => {
            void this.savePersisted().catch((e) =>
              console.error("[grass] failed to save cache:", e),
            );
          },
        }),
    );

    this.addRibbonIcon("globe", "Open GRASS view", () => {
      void activateGrassView(this.app);
    });

    this.addCommand({
      id: "open-view",
      name: "Open GRASS view",
      callback: () => void activateGrassView(this.app),
    });

    this.addCommand({
      id: "refresh-view",
      name: "Refresh GRASS view",
      callback: () => {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_GRASS)) {
          const view = leaf.view;
          if (view instanceof GrassProjectView) view.refresh();
        }
      },
    });

    this.addSettingTab(new GrassProjectSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    // Obsidian detaches registered views automatically on unload.
  }

  // ---- persistence ----

  private async loadPersisted(): Promise<void> {
    const raw = (await this.loadData()) as Partial<PersistedData> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw?.settings ?? {});
    this.cache = loadCache(raw?.cache);
  }

  async savePersisted(): Promise<void> {
    const blob: PersistedData = {
      settings: this.settings,
      cache: this.cache,
    };
    await this.saveData(blob);
  }

  /** Back-compat alias used by the settings tab. */
  async saveSettings(): Promise<void> {
    await this.savePersisted();
  }
}
