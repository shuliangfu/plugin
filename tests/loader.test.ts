/**
 * 插件加载器测试
 */

import { makeTempFile, remove, writeTextFile } from "@dreamer/runtime-adapter";
import { describe, expect, it } from "@dreamer/test";
import { loadPluginFromFile } from "../src/loader.ts";

describe("插件加载器", () => {
  describe("loadPluginFromFile", () => {
    it("应该从文件加载插件（default export）", async () => {
      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent = `
        const plugin = {
          name: "test-plugin",
          version: "1.0.0",
        };
        export default plugin;
      `;
      await writeTextFile(tempFile, pluginContent);

      const plugin = await loadPluginFromFile(tempFile);

      expect(plugin.name).toBe("test-plugin");
      expect(plugin.version).toBe("1.0.0");

      await remove(tempFile);
    });

    it("应该从文件加载插件（named export 'plugin'）", async () => {
      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent = `
        export const plugin = {
          name: "test-plugin",
          version: "1.0.0",
        };
      `;
      await writeTextFile(tempFile, pluginContent);

      const plugin = await loadPluginFromFile(tempFile);

      expect(plugin.name).toBe("test-plugin");
      expect(plugin.version).toBe("1.0.0");

      await remove(tempFile);
    });

    it("应该拒绝加载无效的插件文件（缺少 name）", async () => {
      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent = `
        export default {
          version: "1.0.0",
        };
      `;
      await writeTextFile(tempFile, pluginContent);

      try {
        await loadPluginFromFile(tempFile);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        // 错误消息应包含「缺少必需属性」或「缺少必需的属性」或「不是一个有效的插件模块」（含 i18n 或包装后文案）
        expect(
          errorMessage.includes("缺少必需属性") ||
            errorMessage.includes("缺少必需的属性") ||
            errorMessage.includes("不是一个有效的插件模块"),
        ).toBe(true);
      }

      await remove(tempFile);
    });

    it("应该拒绝加载无效的插件文件（缺少 version）", async () => {
      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent = `
        export default {
          name: "test-plugin",
        };
      `;
      await writeTextFile(tempFile, pluginContent);

      try {
        await loadPluginFromFile(tempFile);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        // 错误消息应包含「缺少必需属性」或「缺少必需的属性」或「不是一个有效的插件模块」
        expect(
          errorMessage.includes("缺少必需属性") ||
            errorMessage.includes("缺少必需的属性") ||
            errorMessage.includes("不是一个有效的插件模块"),
        ).toBe(true);
      }

      await remove(tempFile);
    });

    it("应该处理文件加载错误", async () => {
      try {
        await loadPluginFromFile("/non-existent-file.ts");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("加载插件文件失败");
      }
    });
  });
});
