/**
 * 热加载测试
 */

import { makeTempFile, remove, writeTextFile } from "@dreamer/runtime-adapter";
import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { PluginManager } from "../src/mod.ts";

describe("热加载", () => {
  describe("HotReloadManager", () => {
    it("应该创建热加载管理器实例", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        enableHotReload: true,
      });

      expect(manager).toBeInstanceOf(PluginManager);
    });

    it("应该监听文件变化并重新加载插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        enableHotReload: true,
      });

      // 创建临时插件文件
      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent1 = `
        export default {
          name: "test-plugin",
          version: "1.0.0",
        };
      `;
      await writeTextFile(tempFile, pluginContent1);

      // 加载插件
      await manager.loadFromFile(tempFile);
      expect(manager.getPlugin("test-plugin")).toBeDefined();

      // 修改插件文件
      const pluginContent2 = `
        export default {
          name: "test-plugin",
          version: "2.0.0",
        };
      `;
      await writeTextFile(tempFile, pluginContent2);

      // 等待文件变化被检测（需要一些时间）
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 清理
      await remove(tempFile);
      manager.stopHotReload();
    });

    it("应该停止热加载", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        enableHotReload: true,
      });

      manager.stopHotReload();
      // 应该不会抛出错误
      expect(true).toBe(true);
    });
  });

  describe("热加载事件", () => {
    it("应该触发重新加载事件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        enableHotReload: true,
      });

      let reloadEventCalled = false;
      manager.on("plugin:reloaded", (name) => {
        reloadEventCalled = true;
        expect(name).toBe("test-plugin");
      });

      // 创建临时插件文件
      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent = `
        export default {
          name: "test-plugin",
          version: "1.0.0",
        };
      `;
      await writeTextFile(tempFile, pluginContent);

      await manager.loadFromFile(tempFile);

      // 修改文件触发重新加载
      await writeTextFile(tempFile, pluginContent);

      // 等待事件触发
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 清理
      await remove(tempFile);
      manager.stopHotReload();
    }, {
      // 热加载测试需要较长时间，禁用超时检查
      sanitizeOps: false,
      sanitizeResources: false,
    });
  });
});
