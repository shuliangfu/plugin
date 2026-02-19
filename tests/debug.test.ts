/**
 * 调试工具测试
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { type Plugin, PluginManager } from "../src/mod.ts";

describe("调试工具", () => {
  describe("getDebugInfo", () => {
    it("应该获取单个插件的调试信息", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        dependencies: ["dep-plugin"],
        config: { key: "value" },
      };

      manager.register(plugin);
      const debugInfo = manager.getDebugInfo("test-plugin");

      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      const info = debugInfo as {
        name: string;
        version: string;
        state: string;
        dependencies: string[];
        services: string[];
        config?: Record<string, unknown>;
        error?: Error;
      };
      expect(info.name).toBe("test-plugin");
      expect(info.version).toBe("1.0.0");
      expect(info.state).toBe("registered");
      expect(info.dependencies).toEqual(["dep-plugin"]);
      expect(info.services).toEqual([]);
      expect(info.config).toEqual({ key: "value" });
      expect(info.error).toBeUndefined();
    });

    it("应该在安装后更新状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      const debugInfo = manager.getDebugInfo("test-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      const info = debugInfo as { state: string };
      expect(info.state).toBe("installed");
    });

    it("应该在激活后更新状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.activate("test-plugin");

      const debugInfo = manager.getDebugInfo("test-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      const info = debugInfo as { state: string };
      expect(info.state).toBe("active");
    });

    it("应该包含事件钩子中的错误信息", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("初始化失败");
        },
      };

      await manager.use(plugin);
      await manager.triggerInit();

      const debugInfo = manager.getDebugInfo("test-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      const info = debugInfo as { error?: Error };
      expect(info.error).toBeInstanceOf(Error);
      expect(info.error?.message).toContain("初始化失败");
    });

    it("应该返回所有插件的调试信息", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "2.0.0",
      };

      manager.register(plugin1);
      manager.register(plugin2);

      const allDebugInfo = manager.getDebugInfo();

      expect(Array.isArray(allDebugInfo)).toBe(true);
      expect(allDebugInfo).toBeDefined();
      const infoArray = allDebugInfo as { name: string }[];
      expect(infoArray.length).toBe(2);
      expect(infoArray.map((info) => info.name)).toContain("plugin1");
      expect(infoArray.map((info) => info.name)).toContain("plugin2");
    });

    it("应该拒绝获取未注册插件的调试信息", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        manager.getDebugInfo("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // 实现返回「未找到」，语义与「未注册」一致
        expect((error as Error).message).toMatch(/未找到|未注册/);
      }
    });
  });

  describe("getDependencyGraph", () => {
    it("应该返回依赖关系图", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "2.0.0",
        dependencies: ["plugin1"],
      };

      const plugin3: Plugin = {
        name: "plugin3",
        version: "3.0.0",
        dependencies: ["plugin2"],
      };

      manager.register(plugin1);
      manager.register(plugin2);
      manager.register(plugin3);

      const graph = manager.getDependencyGraph();

      expect(graph).toEqual({
        plugin1: [],
        plugin2: ["plugin1"],
        plugin3: ["plugin2"],
      });
    });

    it("应该返回空依赖数组如果插件没有依赖", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);

      const graph = manager.getDependencyGraph();
      expect(graph["test-plugin"]).toEqual([]);
    });
  });
});
