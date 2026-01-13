/**
 * 资源清理测试
 */

import { describe, expect, it } from "@dreamer/test";
import { ServiceContainer } from "@dreamer/service";
import { PluginManager, type Plugin } from "../src/mod.ts";

describe("资源清理", () => {
  describe("dispose", () => {
    it("应该清理所有资源", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install(container) {
          container.registerSingleton("testService", () => ({ value: "test" }));
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.setConfig("test-plugin", { key: "value" });

      expect(manager.getRegisteredPlugins().length).toBe(1);
      expect(manager.getConfig("test-plugin")).toBeDefined();

      manager.dispose();

      expect(manager.getRegisteredPlugins().length).toBe(0);
      expect(manager.getConfig("test-plugin")).toBeUndefined();
    });

    it("应该停止热加载", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        enableHotReload: true,
      });

      manager.dispose();
      // 应该不会抛出错误
      expect(true).toBe(true);
    });

    it("应该移除所有事件监听器", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      let callCount = 0;
      manager.on("plugin:registered", () => {
        callCount++;
      });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      expect(callCount).toBe(1);

      manager.dispose();

      // 清理后注册新插件，事件监听器应该已被移除
      manager.register({
        name: "plugin2",
        version: "1.0.0",
      });

      // 由于事件监听器已被移除，callCount 不应该增加
      expect(callCount).toBe(1);
    });
  });

  describe("stopHotReload", () => {
    it("应该停止热加载", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        enableHotReload: true,
      });

      manager.stopHotReload();
      // 应该不会抛出错误
      expect(true).toBe(true);
    });

    it("应该在没有启用热加载时正常工作", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      manager.stopHotReload();
      // 应该不会抛出错误
      expect(true).toBe(true);
    });
  });
});
