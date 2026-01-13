/**
 * 插件管理器测试
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
  });

  describe("插件安装", () => {
    it("应该安装插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let installCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install(container) {
          installCalled = true;
          container.registerSingleton("testService", () => ({ value: "test" }));
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      expect(installCalled).toBe(true);
      expect(manager.getState("test-plugin")).toBe("installed");
      expect(container.has("testService")).toBe(true);
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

    it("应该记录插件注册的服务", async () => {
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

      expect(container.has("service1")).toBe(true);
      expect(container.has("service2")).toBe(true);
    });
  });

  describe("插件激活", () => {
    it("应该激活插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let activateCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async activate(container) {
          activateCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      expect(activateCalled).toBe(true);
      expect(manager.getState("test-plugin")).toBe("active");
    });

    it("应该拒绝在非 installed 状态激活插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);

      try {
        await manager.activate("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("无法激活");
      }
    });

    it("应该检查依赖插件是否已激活", async () => {
      const container = new ServiceContainer();
      // 设置 continueOnError 为 false，确保错误会被抛出
      const manager = new PluginManager(container, {
        continueOnError: false,
      });

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

      // 确认 dep-plugin 的状态是 installed，不是 active
      const depState = manager.getState("dep-plugin");
      expect(depState).toBe("installed");

      // 尝试激活 test-plugin，但 dep-plugin 未激活，应该抛出错误
      // 这是测试的核心：当依赖插件未激活时，激活应该失败
      let activationThrewError = false;
      let errorMessage = "";

      try {
        await manager.activate("test-plugin");
        // 如果到达这里，说明没有抛出错误
        // 检查 dep-plugin 的实际状态
        const currentDepState = manager.getState("dep-plugin");
        // 如果 dep-plugin 仍然是 installed，说明依赖检查没有工作
        if (currentDepState === "installed") {
          throw new Error(
            `激活 test-plugin 应该失败，因为 dep-plugin 状态是 ${currentDepState}，不是 active。但激活成功了，说明依赖检查没有工作。`,
          );
        }
        // 如果 dep-plugin 变成了 active，说明它被自动激活了
        // 这种情况下，我们需要重新测试：先停用 dep-plugin，再尝试激活 test-plugin
        if (currentDepState === "active") {
          // 停用 dep-plugin
          await manager.deactivate("dep-plugin");
          expect(manager.getState("dep-plugin")).toBe("inactive");

          // 再次尝试激活 test-plugin，这次应该失败
          try {
            await manager.activate("test-plugin");
            throw new Error(
              "激活 test-plugin 应该失败，因为 dep-plugin 已停用",
            );
          } catch (error2) {
            activationThrewError = true;
            errorMessage = (error2 as Error).message;
          }
        }
      } catch (error) {
        activationThrewError = true;
        errorMessage = (error as Error).message;
      }

      // 验证确实抛出了错误
      expect(activationThrewError).toBe(true);
      // 验证错误消息包含"未激活"
      if (errorMessage && !errorMessage.includes("未激活")) {
        // 如果错误消息不包含"未激活"，打印出来以便调试
        console.error("实际错误消息:", errorMessage);
      }
      expect(errorMessage.includes("未激活")).toBe(true);

      // 先激活 dep-plugin，再激活 test-plugin
      await manager.activate("dep-plugin");
      await manager.activate("test-plugin");

      expect(manager.getState("test-plugin")).toBe("active");
    });
  });

  describe("插件停用", () => {
    it("应该停用插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let deactivateCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async deactivate() {
          deactivateCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");
      await manager.deactivate("test-plugin");

      expect(deactivateCalled).toBe(true);
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
        await manager.deactivate("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("无法停用");
      }
    });
  });

  describe("插件卸载", () => {
    it("应该卸载插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let uninstallCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install(container) {
          container.registerSingleton("testService", () => ({ value: "test" }));
        },
        async uninstall() {
          uninstallCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      expect(container.has("testService")).toBe(true);

      await manager.uninstall("test-plugin");

      expect(uninstallCalled).toBe(true);
      expect(manager.getState("test-plugin")).toBe("uninstalled");
      expect(container.has("testService")).toBe(false);
    });

    it("应该先停用已激活的插件再卸载", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let deactivateCalled = false;
      let uninstallCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async deactivate() {
          deactivateCalled = true;
        },
        async uninstall() {
          uninstallCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");
      await manager.uninstall("test-plugin");

      expect(deactivateCalled).toBe(true);
      expect(uninstallCalled).toBe(true);
      expect(manager.getState("test-plugin")).toBe("uninstalled");
    });

    it("应该移除插件注册的所有服务", async () => {
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

      expect(container.has("service1")).toBe(true);
      expect(container.has("service2")).toBe(true);

      await manager.uninstall("test-plugin");

      expect(container.has("service1")).toBe(false);
      expect(container.has("service2")).toBe(false);
    });
  });

  describe("依赖管理", () => {
    it("应该按依赖顺序安装插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const installOrder: string[] = [];

      const depPlugin: Plugin = {
        name: "dep-plugin",
        version: "1.0.0",
        async install() {
          installOrder.push("dep-plugin");
        },
      };

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        dependencies: ["dep-plugin"],
        async install() {
          installOrder.push("test-plugin");
        },
      };

      manager.register(depPlugin);
      manager.register(plugin);

      await manager.install("test-plugin");

      expect(installOrder).toEqual(["dep-plugin", "test-plugin"]);
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

      manager.on("plugin:registered", (name) => {
        events.push(`registered:${name}`);
      });

      manager.on("plugin:installed", (name) => {
        events.push(`installed:${name}`);
      });

      manager.on("plugin:activated", (name) => {
        events.push(`activated:${name}`);
      });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      expect(events).toContain("registered:test-plugin");
      expect(events).toContain("installed:test-plugin");
      expect(events).toContain("activated:test-plugin");
    });

    it("应该支持自定义事件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let eventCalled = false;

      manager.on("custom:event", () => {
        eventCalled = true;
      });

      manager.emit("custom:event");
      expect(eventCalled).toBe(true);
    });

    it("应该移除事件监听器", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let callCount = 0;

      const listener = () => {
        callCount++;
      };

      manager.on("custom:event", listener);
      manager.off("custom:event", listener);
      manager.emit("custom:event");

      expect(callCount).toBe(0);
    });
  });

  describe("自动激活", () => {
    it("应该自动激活已安装的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        autoActivate: true,
      });
      let activateCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async activate() {
          activateCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");

      expect(activateCalled).toBe(true);
      expect(manager.getState("test-plugin")).toBe("active");
    });
  });

  describe("错误处理", () => {
    it("应该处理插件安装错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });
      let errorEventCalled = false;

      manager.on("plugin:error", () => {
        errorEventCalled = true;
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
      } catch (error) {
        // continueOnError 为 true 时，错误会被捕获但不会抛出
      }

      expect(errorEventCalled).toBe(true);
    });

    it("应该在 continueOnError 为 false 时抛出错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: false,
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
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("安装失败");
      }
    });
  });
});

describe("依赖解析器", () => {
  describe("detectCircularDependency", () => {
    it("应该检测循环依赖", () => {
      const plugins = new Map<string, Plugin>([
        [
          "plugin1",
          { name: "plugin1", version: "1.0.0", dependencies: ["plugin2"] },
        ],
        [
          "plugin2",
          { name: "plugin2", version: "1.0.0", dependencies: ["plugin1"] },
        ],
      ]);

      const cycle = detectCircularDependency(plugins);
      expect(cycle).not.toBeNull();
      expect(cycle).toContain("plugin1");
      expect(cycle).toContain("plugin2");
    });

    it("应该返回 null 如果没有循环依赖", () => {
      const plugins = new Map<string, Plugin>([
        [
          "plugin1",
          { name: "plugin1", version: "1.0.0", dependencies: ["plugin2"] },
        ],
        ["plugin2", { name: "plugin2", version: "1.0.0" }],
      ]);

      const cycle = detectCircularDependency(plugins);
      expect(cycle).toBeNull();
    });
  });

  describe("detectMissingDependencies", () => {
    it("应该检测缺失的依赖", () => {
      const plugins = new Map<string, Plugin>([
        [
          "plugin1",
          {
            name: "plugin1",
            version: "1.0.0",
            dependencies: ["missing-plugin"],
          },
        ],
      ]);

      const missing = detectMissingDependencies(plugins);
      expect("plugin1" in missing).toBe(true);
      expect(missing.plugin1).toContain("missing-plugin");
    });

    it("应该返回空对象如果没有缺失依赖", () => {
      const plugins = new Map<string, Plugin>([
        [
          "plugin1",
          { name: "plugin1", version: "1.0.0", dependencies: ["plugin2"] },
        ],
        ["plugin2", { name: "plugin2", version: "1.0.0" }],
      ]);

      const missing = detectMissingDependencies(plugins);
      expect(Object.keys(missing).length).toBe(0);
    });
  });

  describe("topologicalSort", () => {
    it("应该按依赖顺序排序插件", () => {
      const plugins = new Map<string, Plugin>([
        ["plugin1", { name: "plugin1", version: "1.0.0" }],
        [
          "plugin2",
          { name: "plugin2", version: "1.0.0", dependencies: ["plugin1"] },
        ],
        [
          "plugin3",
          { name: "plugin3", version: "1.0.0", dependencies: ["plugin2"] },
        ],
      ]);

      const sorted = topologicalSort(plugins);
      expect(sorted.indexOf("plugin1")).toBeLessThan(
        sorted.indexOf("plugin2"),
      );
      expect(sorted.indexOf("plugin2")).toBeLessThan(
        sorted.indexOf("plugin3"),
      );
    });

    it("应该拒绝循环依赖", () => {
      const plugins = new Map<string, Plugin>([
        [
          "plugin1",
          { name: "plugin1", version: "1.0.0", dependencies: ["plugin2"] },
        ],
        [
          "plugin2",
          { name: "plugin2", version: "1.0.0", dependencies: ["plugin1"] },
        ],
      ]);

      try {
        topologicalSort(plugins);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("循环依赖");
      }
    });

    it("应该拒绝缺失依赖", () => {
      const plugins = new Map<string, Plugin>([
        [
          "plugin1",
          {
            name: "plugin1",
            version: "1.0.0",
            dependencies: ["missing-plugin"],
          },
        ],
      ]);

      try {
        topologicalSort(plugins);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("缺失依赖");
      }
    });
  });
});
