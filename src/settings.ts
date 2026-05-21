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
