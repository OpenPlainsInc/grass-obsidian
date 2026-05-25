/*!
 * @fileoverview User-facing settings — interface, defaults, and Obsidian
 *   PluginSettingTab UI for configuring the default grassdata root used to
 *   resolve bare project names from code blocks and frontmatter.
 * @author OpenPlains Inc.
 *
 * Copyright (c) 2026 OpenPlains Inc.
 * Licensed under the MIT license.
 */

import { PluginSettingTab, Setting, type App } from "obsidian";
import type GrassProjectPlugin from "./main";

export interface GrassProjectSettings {
  /**
   * Default directory containing GRASS projects. If set, bare project names in
   * code blocks or frontmatter are resolved against this directory.
   */
  grassdataRoot: string;
}

export const DEFAULT_SETTINGS: GrassProjectSettings = {
  grassdataRoot: "",
};

export class GrassProjectSettingTab extends PluginSettingTab {
  plugin: GrassProjectPlugin;

  constructor(app: App, plugin: GrassProjectPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Default grassdata directory")
      .setDesc(
        "Root directory containing your GRASS projects (e.g. ~/grassdata). " +
          "Bare project names in code blocks and frontmatter are resolved here.",
      )
      .addText((text) =>
        text
          .setPlaceholder("~/grassdata")
          .setValue(this.plugin.settings.grassdataRoot)
          .onChange(async (value) => {
            this.plugin.settings.grassdataRoot = value.trim();
            await this.plugin.saveSettings();
          }),
      );
  }
}
