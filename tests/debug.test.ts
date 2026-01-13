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
      const info = debugInfo as any;
      expect(info.name).toBe("test-plugin");
      expect(info.version).toBe("1.0.0");
      expect(info.state).toBe("registered");
      expect(info.dependencies).toEqual(["dep-plugin"]);
      expect(info.services).toEqual([]);
      expect(info.config).toEqual({ key: "value" });
      expect(info.error).toBeUndefined();
    });

    it("应该包含插件注册的服务", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install(container) {
          container.registerSingleton("service1", () => ({ value: 1 }));
          container.registerSingleton("service2", () => ({ value: 2 }));
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      const debugInfo = manager.getDebugInfo("test-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      const info = debugInfo as any;
      expect(info.services).toContain("service1");
      expect(info.services).toContain("service2");
    });

    it("应该包含插件错误信息", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install() {
          throw new Error("安装失败");
        },
      };

      manager.register(plugin);

      try {
        await manager.install("test-plugin");
      } catch {
        // 忽略错误
      }

      const debugInfo = manager.getDebugInfo("test-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      const info = debugInfo as any;
      expect(info.error).toBeInstanceOf(Error);
      expect(info.error?.message).toContain("安装失败");
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
      const infoArray = allDebugInfo as any[];
      expect(infoArray.length).toBe(2);
      expect(infoArray.map((info: any) => info.name)).toContain("plugin1");
      expect(infoArray.map((info: any) => info.name)).toContain("plugin2");
    });

    it("应该拒绝获取未注册插件的调试信息", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        manager.getDebugInfo("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
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
