/**
 * 错误隔离测试
 *
 * 测试事件钩子中的错误隔离
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { type Plugin, PluginManager } from "../src/mod.ts";

describe("错误隔离", () => {
  describe("事件钩子错误隔离", () => {
    it("应该隔离插件错误，不影响其他插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });
      let normalPluginCalled = false;

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("初始化失败");
        },
      };

      const normalPlugin: Plugin = {
        name: "normal-plugin",
        version: "1.0.0",
        async onInit() {
          normalPluginCalled = true;
        },
      };

      manager.register(errorPlugin);
      manager.register(normalPlugin);
      await manager.install("error-plugin");
      await manager.install("normal-plugin");
      manager.activate("error-plugin");
      manager.activate("normal-plugin");

      // 触发初始化（错误插件会失败，但不影响正常插件）
      await manager.triggerInit();

      expect(normalPluginCalled).toBe(true);
    });

    it("应该在 triggerInit 中捕获错误并记录", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("插件初始化错误");
        },
      };

      await manager.use(errorPlugin);

      // 触发初始化
      await manager.triggerInit();

      // 检查错误是否被记录
      const debugInfo = manager.getDebugInfo("error-plugin");
      expect(debugInfo).toBeDefined();
      expect(Array.isArray(debugInfo)).toBe(false);
      // 错误应该被记录在 pluginErrors 中
    });

    it("应该在 triggerRequest 中捕获错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });
      let secondPluginCalled = false;

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onRequest() {
          throw new Error("请求处理错误");
        },
      };

      const normalPlugin: Plugin = {
        name: "normal-plugin",
        version: "1.0.0",
        async onRequest() {
          secondPluginCalled = true;
        },
      };

      await manager.use(errorPlugin);
      await manager.use(normalPlugin);

      // 模拟请求
      const ctx = {
        request: new Request("http://localhost/test"),
        path: "/test",
        method: "GET",
        url: new URL("http://localhost/test"),
        headers: new Headers(),
      };

      await manager.triggerRequest(ctx);

      // 第二个插件应该仍然被调用
      expect(secondPluginCalled).toBe(true);
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
        async onInit() {
          throw new Error("测试错误");
        },
      };

      await manager.use(plugin);
      await manager.triggerInit();

      expect(errorEventCalled).toBe(true);
      expect(errorEventName).toBe("test-plugin");
      expect(errorEventError).toBeInstanceOf(Error);
      expect(errorEventError?.message).toContain("测试错误");
    });
  });

  describe("continueOnError 选项", () => {
    it("continueOnError: true 时应该继续执行", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });
      let secondPluginCalled = false;

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onStart() {
          throw new Error("启动失败");
        },
      };

      const normalPlugin: Plugin = {
        name: "normal-plugin",
        version: "1.0.0",
        async onStart() {
          secondPluginCalled = true;
        },
      };

      await manager.use(errorPlugin);
      await manager.use(normalPlugin);

      // 不应该抛出错误
      await manager.triggerStart();

      expect(secondPluginCalled).toBe(true);
    });

    it("continueOnError: false 时应该抛出错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: false,
      });

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("初始化失败");
        },
      };

      await manager.use(errorPlugin);

      let errorThrown = false;
      try {
        await manager.triggerInit();
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("初始化失败");
      }

      expect(errorThrown).toBe(true);
    });
  });
});
