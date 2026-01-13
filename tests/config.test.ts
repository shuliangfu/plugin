/**
 * 配置管理测试
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { type Plugin, PluginManager } from "../src/mod.ts";

describe("配置管理", () => {
  describe("getConfig", () => {
    it("应该获取插件的初始配置", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        config: {
          key1: "value1",
          key2: 123,
        },
      };

      manager.register(plugin);
      const config = manager.getConfig("test-plugin");

      expect(config).toEqual({
        key1: "value1",
        key2: 123,
      });
    });

    it("应该返回 undefined 如果插件没有配置", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      const config = manager.getConfig("test-plugin");

      expect(config).toBeUndefined();
    });

    it("应该优先返回运行时配置", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        config: {
          key1: "initial",
        },
      };

      manager.register(plugin);
      manager.setConfig("test-plugin", { key1: "runtime" });

      const config = manager.getConfig("test-plugin");
      expect(config).toEqual({ key1: "runtime" });
    });
  });

  describe("setConfig", () => {
    it("应该设置插件配置", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      manager.setConfig("test-plugin", { key: "value" });

      const config = manager.getConfig("test-plugin");
      expect(config).toEqual({ key: "value" });
    });

    it("应该触发配置更新事件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let eventCalled = false;
      let eventConfig: Record<string, unknown> | undefined;

      manager.on("plugin:config:updated", (name, config) => {
        eventCalled = true;
        eventConfig = config as Record<string, unknown>;
      });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      manager.setConfig("test-plugin", { key: "value" });

      expect(eventCalled).toBe(true);
      expect(eventConfig).toEqual({ key: "value" });
    });

    it("应该调用插件的配置更新钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let hookCalled = false;
      let hookConfig: Record<string, unknown> | undefined;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onConfigUpdate(newConfig) {
          hookCalled = true;
          hookConfig = newConfig;
        },
      };

      manager.register(plugin);
      manager.setConfig("test-plugin", { key: "value" });

      // 等待异步钩子执行
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hookCalled).toBe(true);
      expect(hookConfig).toEqual({ key: "value" });
    });

    it("应该验证配置如果插件有验证函数", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        validateConfig(config) {
          return typeof config.key === "string";
        },
      };

      manager.register(plugin);

      // 有效配置
      manager.setConfig("test-plugin", { key: "value" });
      expect(manager.getConfig("test-plugin")).toEqual({ key: "value" });

      // 无效配置
      try {
        manager.setConfig("test-plugin", { key: 123 });
        expect(true).toBe(false); // 不应该执行到这里
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("配置验证失败");
      }
    });

    it("应该拒绝设置未注册插件的配置", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        manager.setConfig("non-existent", { key: "value" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
      }
    });
  });

  describe("updateConfig", () => {
    it("应该合并现有配置", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        config: {
          key1: "value1",
          key2: "value2",
        },
      };

      manager.register(plugin);
      manager.updateConfig("test-plugin", { key2: "updated", key3: "value3" });

      const config = manager.getConfig("test-plugin");
      expect(config).toEqual({
        key1: "value1",
        key2: "updated",
        key3: "value3",
      });
    });

    it("应该从空配置开始合并", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      manager.updateConfig("test-plugin", { key: "value" });

      const config = manager.getConfig("test-plugin");
      expect(config).toEqual({ key: "value" });
    });
  });
});
