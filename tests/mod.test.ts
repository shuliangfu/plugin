/**
 * 插件管理器测试
 *
 * 新设计：Manager 管理生命周期状态，插件只响应事件
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import {
  detectCircularDependency,
  detectMissingDependencies,
  type Plugin,
  PluginManager,
  topologicalSort,
} from "../src/mod.ts";

describe("PluginManager", () => {
  describe("基础功能", () => {
    it("应该创建插件管理器实例", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      expect(manager.getRegisteredPlugins()).toEqual([]);
    });

    it("应该注册插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      expect(manager.getRegisteredPlugins()).toContain("test-plugin");
      expect(manager.getPlugin("test-plugin")).toEqual(plugin);
      expect(manager.getState("test-plugin")).toBe("registered");
    });

    it("应该拒绝重复注册同名插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);

      try {
        manager.register(plugin);
        expect(true).toBe(false); // 不应该执行到这里
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("已注册");
      }
    });

    it("应该允许使用 replace 选项替换已注册的插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      const plugin2: Plugin = {
        name: "test-plugin",
        version: "2.0.0",
      };

      manager.register(plugin1);
      expect(manager.getPlugin("test-plugin")?.version).toBe("1.0.0");

      // 使用 replace 选项替换
      manager.register(plugin2, { replace: true });
      expect(manager.getPlugin("test-plugin")?.version).toBe("2.0.0");
      expect(manager.getState("test-plugin")).toBe("registered");
    });

    it("替换插件时应该触发 plugin:replaced 事件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let replacedEventCalled = false;
      let replacedPluginName: string | undefined;

      manager.on("plugin:replaced", (name) => {
        replacedEventCalled = true;
        replacedPluginName = name as string;
      });

      const plugin1: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      const plugin2: Plugin = {
        name: "test-plugin",
        version: "2.0.0",
      };

      manager.register(plugin1);
      manager.register(plugin2, { replace: true });

      expect(replacedEventCalled).toBe(true);
      expect(replacedPluginName).toBe("test-plugin");
    });

    it("替换插件时应该清理旧插件的状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin1);
      await manager.install("test-plugin");
      manager.activate("test-plugin");
      manager.setConfig("test-plugin", { key: "old-value" });

      expect(manager.getState("test-plugin")).toBe("active");
      expect(manager.getConfig("test-plugin")).toEqual({ key: "old-value" });

      // 替换插件
      const plugin2: Plugin = {
        name: "test-plugin",
        version: "2.0.0",
      };

      manager.register(plugin2, { replace: true });

      // 状态应该重置为 registered
      expect(manager.getState("test-plugin")).toBe("registered");
      // 配置应该被清除
      expect(manager.getConfig("test-plugin")).toBeUndefined();
    });
  });

  describe("插件安装", () => {
    it("应该安装插件并更新状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      expect(manager.getState("test-plugin")).toBe("installed");
    });

    it("应该拒绝在非 registered 状态安装插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      try {
        await manager.install("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("无法安装");
      }
    });
  });

  describe("插件激活", () => {
    it("应该激活插件并更新状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.activate("test-plugin");

      expect(manager.getState("test-plugin")).toBe("active");
    });

    it("应该拒绝在非 installed 状态激活插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);

      try {
        manager.activate("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("无法激活");
      }
    });

    it("应该检查依赖插件是否已激活", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const depPlugin: Plugin = {
        name: "dep-plugin",
        version: "1.0.0",
      };

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        dependencies: ["dep-plugin"],
      };

      manager.register(depPlugin);
      manager.register(plugin);

      await manager.install("dep-plugin");
      await manager.install("test-plugin");

      // dep-plugin 未激活，test-plugin 激活应该失败
      try {
        manager.activate("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未激活");
      }
    });

    it("应该允许从 inactive 状态重新激活插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.activate("test-plugin");
      manager.deactivate("test-plugin");

      expect(manager.getState("test-plugin")).toBe("inactive");

      // 从 inactive 状态重新激活
      manager.activate("test-plugin");
      expect(manager.getState("test-plugin")).toBe("active");
    });
  });

  describe("插件停用", () => {
    it("应该停用插件并更新状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.activate("test-plugin");

      expect(manager.getState("test-plugin")).toBe("active");

      manager.deactivate("test-plugin");
      expect(manager.getState("test-plugin")).toBe("inactive");
    });

    it("应该拒绝在非 active 状态停用插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      try {
        manager.deactivate("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("无法停用");
      }
    });
  });

  describe("插件卸载", () => {
    it("应该卸载插件并更新状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      await manager.uninstall("test-plugin");
      expect(manager.getState("test-plugin")).toBe("uninstalled");
    });

    it("应该先停用已激活的插件再卸载", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.activate("test-plugin");

      expect(manager.getState("test-plugin")).toBe("active");

      await manager.uninstall("test-plugin");
      expect(manager.getState("test-plugin")).toBe("uninstalled");
    });

    it("应该允许重复卸载已卸载的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.uninstall("test-plugin");

      // 重复卸载不应该抛出错误
      await manager.uninstall("test-plugin");
      expect(manager.getState("test-plugin")).toBe("uninstalled");
    });
  });

  describe("便捷方法", () => {
    it("use() 应该自动注册、安装和激活插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      await manager.use(plugin);

      expect(manager.getRegisteredPlugins()).toContain("test-plugin");
      expect(manager.getState("test-plugin")).toBe("active");
    });

    it("bootstrap() 应该批量启动所有插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let initCalled = false;

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onInit() {
          initCalled = true;
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
      };

      manager.register(plugin1);
      manager.register(plugin2);

      await manager.bootstrap();

      expect(manager.getState("plugin1")).toBe("active");
      expect(manager.getState("plugin2")).toBe("active");
      expect(initCalled).toBe(true);
    });

    it("shutdown() 应该优雅关闭所有插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let stopCalled = false;
      let shutdownCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onStop() {
          stopCalled = true;
        },
        async onShutdown() {
          shutdownCalled = true;
        },
      };

      await manager.use(plugin);
      await manager.shutdown();

      expect(stopCalled).toBe(true);
      expect(shutdownCalled).toBe(true);
      expect(manager.getState("test-plugin")).toBe("uninstalled");
    });
  });

  describe("依赖管理", () => {
    it("应该按依赖顺序安装插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const depPlugin: Plugin = {
        name: "dep-plugin",
        version: "1.0.0",
      };

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        dependencies: ["dep-plugin"],
      };

      manager.register(depPlugin);
      manager.register(plugin);

      // 安装 test-plugin 会先安装 dep-plugin
      await manager.install("test-plugin");

      expect(manager.getState("dep-plugin")).toBe("installed");
      expect(manager.getState("test-plugin")).toBe("installed");
    });

    it("应该检测循环依赖", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        dependencies: ["plugin2"],
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        dependencies: ["plugin1"],
      };

      manager.register(plugin1);
      manager.register(plugin2);

      try {
        manager.validateDependencies();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("循环依赖");
      }
    });

    it("应该检测缺失依赖", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        dependencies: ["missing-plugin"],
      };

      manager.register(plugin);

      try {
        manager.validateDependencies();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("缺失依赖");
      }
    });
  });

  describe("事件系统", () => {
    it("应该触发生命周期事件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const events: string[] = [];

      manager.on("plugin:registered", () => events.push("registered"));
      manager.on("plugin:installed", () => events.push("installed"));
      manager.on("plugin:activated", () => events.push("activated"));
      manager.on("plugin:deactivated", () => events.push("deactivated"));
      manager.on("plugin:uninstalled", () => events.push("uninstalled"));

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      manager.activate("test-plugin");
      manager.deactivate("test-plugin");
      await manager.uninstall("test-plugin");

      expect(events).toContain("registered");
      expect(events).toContain("installed");
      expect(events).toContain("activated");
      expect(events).toContain("deactivated");
      expect(events).toContain("uninstalled");
    });

    it("应该支持自定义事件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let eventData: string | null = null;

      manager.on("custom:event", (data) => {
        eventData = data as string;
      });

      manager.emit("custom:event", "test-data");

      expect(eventData).toBe("test-data");
    });

    it("应该移除事件监听器", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let callCount = 0;

      const listener = () => {
        callCount++;
      };

      manager.on("custom:event", listener);
      manager.emit("custom:event");
      expect(callCount).toBe(1);

      manager.off("custom:event", listener);
      manager.emit("custom:event");
      expect(callCount).toBe(1); // 不应该增加
    });
  });

  describe("自动激活", () => {
    it("应该自动激活已安装的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, { autoActivate: true });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      expect(manager.getState("test-plugin")).toBe("active");
    });
  });
});

describe("依赖解析器", () => {
  describe("detectCircularDependency", () => {
    it("应该检测循环依赖", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", { name: "a", version: "1.0.0", dependencies: ["b"] });
      plugins.set("b", { name: "b", version: "1.0.0", dependencies: ["a"] });

      const cycle = detectCircularDependency(plugins);
      expect(cycle).not.toBeNull();
    });

    it("应该返回 null 如果没有循环依赖", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", { name: "a", version: "1.0.0", dependencies: ["b"] });
      plugins.set("b", { name: "b", version: "1.0.0" });

      const cycle = detectCircularDependency(plugins);
      expect(cycle).toBeNull();
    });
  });

  describe("detectMissingDependencies", () => {
    it("应该检测缺失的依赖", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", {
        name: "a",
        version: "1.0.0",
        dependencies: ["missing"],
      });

      const missing = detectMissingDependencies(plugins);
      expect(Object.keys(missing).length).toBeGreaterThan(0);
      expect(missing["a"]).toContain("missing");
    });

    it("应该返回空对象如果没有缺失依赖", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", { name: "a", version: "1.0.0", dependencies: ["b"] });
      plugins.set("b", { name: "b", version: "1.0.0" });

      const missing = detectMissingDependencies(plugins);
      expect(Object.keys(missing).length).toBe(0);
    });
  });

  describe("topologicalSort", () => {
    it("应该按依赖顺序排序插件", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", { name: "a", version: "1.0.0", dependencies: ["b"] });
      plugins.set("b", { name: "b", version: "1.0.0", dependencies: ["c"] });
      plugins.set("c", { name: "c", version: "1.0.0" });

      const sorted = topologicalSort(plugins, ["a", "b", "c"]);

      // c 应该在 b 之前，b 应该在 a 之前
      expect(sorted.indexOf("c")).toBeLessThan(sorted.indexOf("b"));
      expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("a"));
    });

    it("应该拒绝循环依赖", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", { name: "a", version: "1.0.0", dependencies: ["b"] });
      plugins.set("b", { name: "b", version: "1.0.0", dependencies: ["a"] });

      try {
        topologicalSort(plugins, ["a", "b"]);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("循环依赖");
      }
    });

    it("应该拒绝缺失依赖", () => {
      const plugins = new Map<string, Plugin>();
      plugins.set("a", {
        name: "a",
        version: "1.0.0",
        dependencies: ["missing"],
      });

      try {
        topologicalSort(plugins, ["a"]);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("缺失依赖");
      }
    });
  });
});
