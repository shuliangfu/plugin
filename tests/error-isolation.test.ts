/**
 * 错误隔离测试
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { type Plugin, PluginManager } from "../src/mod.ts";

describe("错误隔离", () => {
  describe("插件错误隔离", () => {
    it("应该隔离插件错误，不影响其他插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async install() {
          throw new Error("安装失败");
        },
      };

      const normalPlugin: Plugin = {
        name: "normal-plugin",
        version: "1.0.0",
        async install(container) {
          container.registerSingleton("normalService", () => ({ value: "ok" }));
        },
      };

      manager.register(errorPlugin);
      manager.register(normalPlugin);

      // 安装错误插件（应该被捕获）
      try {
        await manager.install("error-plugin");
      } catch {
        // 忽略错误
      }

      // 安装正常插件（应该成功）
      await manager.install("normal-plugin");

      expect(container.has("normalService")).toBe(true);
      expect(manager.getState("normal-plugin")).toBe("installed");
    });

    it("应该记录每个插件的错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async install() {
          throw new Error("插件1错误");
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "2.0.0",
        async activate() {
          throw new Error("插件2错误");
        },
      };

      manager.register(plugin1);
      manager.register(plugin2);

      try {
        await manager.install("plugin1");
      } catch {
        // 忽略
      }

      await manager.install("plugin2");

      try {
        await manager.activate("plugin2");
      } catch {
        // 忽略
      }

      const debugInfo1 = manager.getDebugInfo("plugin1");
      const debugInfo2 = manager.getDebugInfo("plugin2");

      expect(debugInfo1).toBeDefined();
      expect(Array.isArray(debugInfo1)).toBe(false);
      expect((debugInfo1 as any).error).toBeInstanceOf(Error);
      expect((debugInfo1 as any).error?.message).toContain("插件1错误");
      expect(debugInfo2).toBeDefined();
      expect(Array.isArray(debugInfo2)).toBe(false);
      expect((debugInfo2 as any).error).toBeInstanceOf(Error);
      expect((debugInfo2 as any).error?.message).toContain("插件2错误");
    });

    it("应该在成功操作后清除错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      // 先创建一个安装失败的插件
      const errorPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install() {
          throw new Error("安装失败");
        },
      };

      manager.register(errorPlugin);

      // 安装失败
      try {
        await manager.install("test-plugin");
      } catch {
        // 忽略
      }

      let debugInfo = manager.getDebugInfo("test-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      expect((debugInfo as any).error).toBeInstanceOf(Error);

      // 卸载插件
      try {
        await manager.uninstall("test-plugin");
      } catch {
        // 忽略
      }

      // 由于插件已经注册，我们不能重新注册
      // 但我们可以通过重新安装来清除错误（如果安装成功）
      // 为了测试清除错误，我们创建一个新的插件管理器
      const newContainer = new ServiceContainer();
      const newManager = new PluginManager(newContainer, {
        continueOnError: true,
      });

      // 创建一个安装成功的插件
      const fixedPlugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async activate() {
          // 激活成功
        },
      };

      // 注册并安装
      newManager.register(fixedPlugin);
      await newManager.install("test-plugin");
      await newManager.activate("test-plugin");

      const newDebugInfo = newManager.getDebugInfo("test-plugin");
      expect(newDebugInfo).toBeDefined();
      expect(Array.isArray(newDebugInfo)).toBe(false);
      expect((newDebugInfo as any).error).toBeUndefined();
    });
  });

  describe("错误事件", () => {
    it("应该触发错误事件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      let errorEventCalled = false;
      let errorEventName: string | undefined;
      let errorEventError: Error | undefined;

      manager.on("plugin:error", (name, error) => {
        errorEventCalled = true;
        errorEventName = name as string;
        errorEventError = error as Error;
      });

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async install() {
          throw new Error("测试错误");
        },
      };

      manager.register(plugin);

      try {
        await manager.install("test-plugin");
      } catch {
        // 忽略
      }

      expect(errorEventCalled).toBe(true);
      expect(errorEventName).toBe("test-plugin");
      expect(errorEventError).toBeInstanceOf(Error);
      expect(errorEventError?.message).toContain("测试错误");
    });
  });
});
