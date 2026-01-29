/**
 * 综合测试 - 覆盖更多边界情况和场景
 */

import { makeTempFile, remove, writeTextFile } from "@dreamer/runtime-adapter";
import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import {
  type Plugin,
  PluginManager,
  type RouteDefinition,
} from "../src/mod.ts";

describe("综合测试", () => {
  describe("use() 便捷方法", () => {
    it("应该跳过已注册的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      // 先注册
      manager.register(plugin);
      expect(manager.getState("test-plugin")).toBe("registered");

      // 使用 use() 不应该抛出错误
      await manager.use(plugin);
      expect(manager.getState("test-plugin")).toBe("active");
    });

    it("应该跳过已安装的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      expect(manager.getState("test-plugin")).toBe("installed");

      // 使用 use() 应该直接激活
      await manager.use(plugin);
      expect(manager.getState("test-plugin")).toBe("active");
    });

    it("应该跳过已激活的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      await manager.use(plugin);
      expect(manager.getState("test-plugin")).toBe("active");

      // 重复调用 use() 不应该出错
      await manager.use(plugin);
      expect(manager.getState("test-plugin")).toBe("active");
    });

    it("应该重新激活 inactive 状态的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      await manager.use(plugin);
      manager.deactivate("test-plugin");
      expect(manager.getState("test-plugin")).toBe("inactive");

      // 使用 use() 应该重新激活
      await manager.use(plugin);
      expect(manager.getState("test-plugin")).toBe("active");
    });
  });

  describe("bootstrap() 边界情况", () => {
    it("应该处理空插件列表", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      // 不注册任何插件，直接 bootstrap 不应该报错
      await manager.bootstrap();

      expect(manager.getRegisteredPlugins().length).toBe(0);
    });

    it("应该跳过已安装/已激活的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let initCount = 0;

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onInit() {
          initCount++;
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        async onInit() {
          initCount++;
        },
      };

      // plugin1 已经激活
      await manager.use(plugin1);
      expect(initCount).toBe(0); // onInit 还没触发

      // 注册 plugin2
      manager.register(plugin2);

      // bootstrap 应该只安装激活 plugin2
      await manager.bootstrap();

      expect(manager.getState("plugin1")).toBe("active");
      expect(manager.getState("plugin2")).toBe("active");
      // onInit 对两个插件都调用一次
      expect(initCount).toBe(2);
    });
  });

  describe("shutdown() 边界情况", () => {
    it("应该处理空插件列表", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      // 不注册任何插件，直接 shutdown 不应该报错
      await manager.shutdown();
    });

    it("应该处理部分插件已卸载的情况", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      // 先卸载 plugin1
      await manager.uninstall("plugin1");

      // shutdown 不应该报错
      await manager.shutdown();

      expect(manager.getState("plugin1")).toBe("uninstalled");
      expect(manager.getState("plugin2")).toBe("uninstalled");
    });

    it("应该逆序停用插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const stopOrder: string[] = [];

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onStop() {
          stopOrder.push("plugin1");
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        async onStop() {
          stopOrder.push("plugin2");
        },
      };

      const plugin3: Plugin = {
        name: "plugin3",
        version: "1.0.0",
        async onStop() {
          stopOrder.push("plugin3");
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);
      await manager.use(plugin3);

      await manager.shutdown();

      // 应该逆序停用（后注册的先停用）
      expect(stopOrder[0]).toBe("plugin3");
      expect(stopOrder[1]).toBe("plugin2");
      expect(stopOrder[2]).toBe("plugin1");
    });
  });

  describe("validateDependencies() 单个插件验证", () => {
    it("应该验证单个插件的依赖", () => {
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

      // 应该不报错
      manager.validateDependencies("test-plugin");
    });

    it("应该拒绝验证未注册的插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        manager.validateDependencies("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
      }
    });

    it("应该检测单个插件的循环依赖", () => {
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
        manager.validateDependencies("plugin1");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("循环依赖");
      }
    });

    it("应该检测单个插件的缺失依赖", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        dependencies: ["missing-plugin"],
      };

      manager.register(plugin);

      try {
        manager.validateDependencies("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("缺失依赖");
      }
    });
  });

  describe("loadFromFile() 通过 Manager 加载", () => {
    it("应该从文件加载并注册插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const tempFile = await makeTempFile({ suffix: ".ts" });
      const pluginContent = `
        export default {
          name: "file-plugin",
          version: "1.0.0",
        };
      `;
      await writeTextFile(tempFile, pluginContent);

      await manager.loadFromFile(tempFile);

      expect(manager.getRegisteredPlugins()).toContain("file-plugin");
      expect(manager.getState("file-plugin")).toBe("registered");

      await remove(tempFile);
    });

    it("应该处理加载失败", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: false,
      });

      try {
        await manager.loadFromFile("/non-existent-file.ts");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("replace 选项与已激活插件", () => {
    it("替换已激活的插件时应该重置状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      await manager.use(plugin1);
      expect(manager.getState("test-plugin")).toBe("active");

      const plugin2: Plugin = {
        name: "test-plugin",
        version: "2.0.0",
      };

      // 替换已激活的插件
      manager.register(plugin2, { replace: true });

      // 状态应该重置为 registered
      expect(manager.getState("test-plugin")).toBe("registered");
      expect(manager.getPlugin("test-plugin")?.version).toBe("2.0.0");
    });
  });

  describe("事件触发边界情况", () => {
    it("应该处理没有任何插件的 triggerInit", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      // 不应该报错
      await manager.triggerInit();
    });

    it("应该处理没有 onInit 钩子的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        // 没有 onInit
      };

      await manager.use(plugin);
      await manager.triggerInit();
      // 不应该报错
    });

    it("应该处理所有插件都没有 onRequest 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        // 没有 onRequest
      };

      await manager.use(plugin);

      const ctx = {
        request: new Request("http://localhost/test"),
        path: "/test",
        method: "GET",
        url: new URL("http://localhost/test"),
        headers: new Headers(),
      };

      const response = await manager.triggerRequest(ctx);
      expect(response).toBeUndefined();
    });

    it("应该按注册顺序触发 onRequest", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const callOrder: string[] = [];

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onRequest() {
          callOrder.push("plugin1");
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        async onRequest() {
          callOrder.push("plugin2");
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      const ctx = {
        request: new Request("http://localhost/test"),
        path: "/test",
        method: "GET",
        url: new URL("http://localhost/test"),
        headers: new Headers(),
      };

      await manager.triggerRequest(ctx);

      expect(callOrder).toEqual(["plugin1", "plugin2"]);
    });
  });

  describe("triggerError() 错误处理", () => {
    it("应该将错误传递给所有插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const errorsReceived: Error[] = [];

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onError(error) {
          errorsReceived.push(error);
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        async onError(error) {
          errorsReceived.push(error);
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      const testError = new Error("Test error");
      await manager.triggerError(testError);

      expect(errorsReceived.length).toBe(2);
      expect(errorsReceived[0].message).toBe("Test error");
      expect(errorsReceived[1].message).toBe("Test error");
    });

    it("应该返回第一个插件返回的 Response", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onError() {
          return new Response("Error handled by plugin1", { status: 500 });
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        async onError() {
          return new Response("Error handled by plugin2", { status: 500 });
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      const testError = new Error("Test error");
      const response = await manager.triggerError(testError);

      expect(response).toBeInstanceOf(Response);
      const text = await response!.text();
      expect(text).toBe("Error handled by plugin1");
    });
  });

  describe("triggerHealthCheck() 健康检查", () => {
    it("应该合并多个插件的健康检查结果", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        onHealthCheck() {
          return {
            status: "healthy" as const,
            checks: {
              "database": { status: "pass" as const },
            },
          };
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        onHealthCheck() {
          return {
            status: "healthy" as const,
            checks: {
              "cache": { status: "pass" as const },
            },
          };
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      const status = await manager.triggerHealthCheck();

      // triggerHealthCheck 会在 check name 前加上 plugin name 前缀
      expect(status.checks!["plugin1:database"]).toBeDefined();
      expect(status.checks!["plugin2:cache"]).toBeDefined();
    });

    it("应该在有 fail 检查时返回 unhealthy 状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        onHealthCheck() {
          return {
            status: "unhealthy" as const,
            checks: {
              "database": {
                status: "fail" as const,
                message: "Connection lost",
              },
            },
          };
        },
      };

      await manager.use(plugin);

      const status = await manager.triggerHealthCheck();

      expect(status.status).toBe("unhealthy");
    });

    it("应该在有 warn 检查但无 fail 时返回 degraded 状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        onHealthCheck() {
          return {
            status: "degraded" as const,
            checks: {
              "memory": {
                status: "warn" as const,
                message: "High memory usage",
              },
            },
          };
        },
      };

      await manager.use(plugin);

      const status = await manager.triggerHealthCheck();

      expect(status.status).toBe("degraded");
    });
  });

  describe("triggerRoute() 路由处理", () => {
    it("应该允许插件修改路由", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "auth-plugin",
        version: "1.0.0",
        async onRoute(routes) {
          // 为所有路由添加认证中间件标记
          return routes.map((r) => ({
            ...r,
            meta: { ...r.meta, requiresAuth: true },
          }));
        },
      };

      await manager.use(plugin);

      // 创建 mock handler
      const mockHandler = () => new Response("OK");

      const initialRoutes: RouteDefinition[] = [
        { path: "/api/users", method: "GET", handler: mockHandler },
        { path: "/api/posts", method: "POST", handler: mockHandler },
      ];

      const finalRoutes = await manager.triggerRoute(initialRoutes);

      expect(finalRoutes[0].meta?.requiresAuth).toBe(true);
      expect(finalRoutes[1].meta?.requiresAuth).toBe(true);
    });

    it("应该允许插件添加新路由", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      // 创建 mock handler
      const mockHandler = () => new Response("OK");

      const plugin: Plugin = {
        name: "health-plugin",
        version: "1.0.0",
        async onRoute(routes) {
          return [
            ...routes,
            { path: "/health", method: "GET" as const, handler: mockHandler },
          ];
        },
      };

      await manager.use(plugin);

      const initialRoutes: RouteDefinition[] = [
        { path: "/api/users", method: "GET", handler: mockHandler },
      ];

      const finalRoutes = await manager.triggerRoute(initialRoutes);

      expect(finalRoutes.length).toBe(2);
      expect(finalRoutes[1].path).toBe("/health");
    });
  });

  describe("依赖顺序安装", () => {
    it("应该自动安装依赖插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const installOrder: string[] = [];

      manager.on("plugin:installed", (name) => {
        installOrder.push(name as string);
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

      // 只安装 test-plugin，但 dep-plugin 应该先被安装
      await manager.install("test-plugin");

      expect(installOrder[0]).toBe("dep-plugin");
      expect(installOrder[1]).toBe("test-plugin");
    });

    it("应该处理深层依赖链", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const installOrder: string[] = [];

      manager.on("plugin:installed", (name) => {
        installOrder.push(name as string);
      });

      const pluginA: Plugin = {
        name: "plugin-a",
        version: "1.0.0",
      };

      const pluginB: Plugin = {
        name: "plugin-b",
        version: "1.0.0",
        dependencies: ["plugin-a"],
      };

      const pluginC: Plugin = {
        name: "plugin-c",
        version: "1.0.0",
        dependencies: ["plugin-b"],
      };

      manager.register(pluginA);
      manager.register(pluginB);
      manager.register(pluginC);

      await manager.install("plugin-c");

      expect(installOrder).toEqual(["plugin-a", "plugin-b", "plugin-c"]);
    });
  });

  describe("getPlugin() 和 getState()", () => {
    it("应该返回 undefined 对于不存在的插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      expect(manager.getPlugin("non-existent")).toBeUndefined();
      expect(manager.getState("non-existent")).toBeUndefined();
    });
  });

  describe("多次调用 dispose()", () => {
    it("应该安全地多次调用 dispose", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      manager.dispose();
      manager.dispose(); // 不应该报错
    });
  });

  describe("事件监听器", () => {
    it("应该支持 once 监听器", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let callCount = 0;

      // 使用 on 然后在回调中 off 来模拟 once
      const listener = () => {
        callCount++;
        manager.off("custom:event", listener);
      };

      manager.on("custom:event", listener);
      manager.emit("custom:event");
      manager.emit("custom:event");

      expect(callCount).toBe(1);
    });
  });

  describe("共享依赖", () => {
    it("多个插件共享相同依赖时只安装一次", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let sharedDepInstallCount = 0;

      manager.on("plugin:installed", (name) => {
        if (name === "shared-dep") {
          sharedDepInstallCount++;
        }
      });

      const sharedDep: Plugin = {
        name: "shared-dep",
        version: "1.0.0",
      };

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        dependencies: ["shared-dep"],
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        dependencies: ["shared-dep"],
      };

      manager.register(sharedDep);
      manager.register(plugin1);
      manager.register(plugin2);

      await manager.install("plugin1");
      await manager.install("plugin2");

      // shared-dep 应该只安装一次
      expect(sharedDepInstallCount).toBe(1);
    });
  });

  describe("getRegisteredPlugins()", () => {
    it("应该返回所有已注册插件的名称列表", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin1: Plugin = { name: "plugin1", version: "1.0.0" };
      const plugin2: Plugin = { name: "plugin2", version: "1.0.0" };
      const plugin3: Plugin = { name: "plugin3", version: "1.0.0" };

      manager.register(plugin1);
      manager.register(plugin2);
      manager.register(plugin3);

      const plugins = manager.getRegisteredPlugins();

      expect(plugins.length).toBe(3);
      expect(plugins).toContain("plugin1");
      expect(plugins).toContain("plugin2");
      expect(plugins).toContain("plugin3");
    });

    it("应该返回空数组如果没有注册任何插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      expect(manager.getRegisteredPlugins()).toEqual([]);
    });
  });

  describe("install() 边界情况", () => {
    it("应该拒绝安装不存在的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        await manager.install("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
      }
    });

    it("应该跳过已安装的依赖", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let depInstallCount = 0;

      manager.on("plugin:installed", (name) => {
        if (name === "dep-plugin") {
          depInstallCount++;
        }
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

      // 先安装依赖
      await manager.install("dep-plugin");
      expect(depInstallCount).toBe(1);

      // 再安装主插件，依赖不应该重复安装
      await manager.install("test-plugin");
      expect(depInstallCount).toBe(1);
    });
  });

  describe("activate() 边界情况", () => {
    it("应该拒绝激活不存在的插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        manager.activate("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
      }
    });

    it("应该拒绝激活已激活的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      await manager.use(plugin);

      try {
        manager.activate("test-plugin");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("无法激活");
      }
    });
  });

  describe("deactivate() 边界情况", () => {
    it("应该拒绝停用不存在的插件", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        manager.deactivate("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
      }
    });
  });

  describe("uninstall() 边界情况", () => {
    it("应该拒绝卸载不存在的插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        await manager.uninstall("non-existent");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("未注册");
      }
    });
  });

  describe("triggerBuild() 和 triggerBuildComplete()", () => {
    it("应该在构建过程中调用插件钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let buildCalled = false;
      let buildCompleteCalled = false;
      let receivedOptions: unknown;
      let receivedResult: unknown;

      const plugin: Plugin = {
        name: "build-plugin",
        version: "1.0.0",
        async onBuild(options) {
          buildCalled = true;
          receivedOptions = options;
        },
        async onBuildComplete(result) {
          buildCompleteCalled = true;
          receivedResult = result;
        },
      };

      await manager.use(plugin);

      await manager.triggerBuild({ mode: "prod", target: "server" });
      await manager.triggerBuildComplete({
        success: true,
        outputDir: "/dist",
        duration: 1000,
      });

      expect(buildCalled).toBe(true);
      expect(buildCompleteCalled).toBe(true);
      expect(receivedOptions).toEqual({ mode: "prod", target: "server" });
      expect(receivedResult).toEqual({
        success: true,
        outputDir: "/dist",
        duration: 1000,
      });
    });
  });

  describe("triggerWebSocket() 和 triggerWebSocketClose()", () => {
    it("应该处理 WebSocket 连接和关闭事件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let connectCalled = false;
      let closeCalled = false;

      const plugin: Plugin = {
        name: "ws-plugin",
        version: "1.0.0",
        async onWebSocket(ctx) {
          connectCalled = true;
          expect(ctx.connectionId).toBe("conn-123");
        },
        async onWebSocketClose(ctx) {
          closeCalled = true;
          expect(ctx.connectionId).toBe("conn-123");
        },
      };

      await manager.use(plugin);

      // 创建 mock WebSocket context
      const mockSocket = {} as WebSocket;
      const ctx = {
        socket: mockSocket,
        request: new Request("http://localhost/ws"),
        connectionId: "conn-123",
      };

      await manager.triggerWebSocket(ctx);
      await manager.triggerWebSocketClose(ctx);

      expect(connectCalled).toBe(true);
      expect(closeCalled).toBe(true);
    });
  });

  describe("triggerSchedule()", () => {
    it("应该触发定时任务钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let scheduleCalled = false;
      let receivedContext: unknown;

      const plugin: Plugin = {
        name: "schedule-plugin",
        version: "1.0.0",
        async onSchedule(ctx) {
          scheduleCalled = true;
          receivedContext = ctx;
        },
      };

      await manager.use(plugin);

      const ctx = {
        taskName: "daily-cleanup",
        schedule: "0 0 * * *",
        lastRun: new Date("2024-01-01"),
      };

      await manager.triggerSchedule(ctx);

      expect(scheduleCalled).toBe(true);
      expect(receivedContext).toEqual(ctx);
    });
  });

  describe("configUpdateHook", () => {
    it("应该在配置更新时调用 onConfigUpdate 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let hookCalled = false;
      let receivedConfig: unknown;

      const plugin: Plugin = {
        name: "config-plugin",
        version: "1.0.0",
        async onConfigUpdate(newConfig) {
          hookCalled = true;
          receivedConfig = newConfig;
        },
      };

      manager.register(plugin);
      manager.setConfig("config-plugin", { key: "value" });

      // 等待异步钩子执行
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(hookCalled).toBe(true);
      expect(receivedConfig).toEqual({ key: "value" });
    });
  });

  describe("getDependencyGraph()", () => {
    it("应该返回完整的依赖关系图", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const pluginA: Plugin = { name: "a", version: "1.0.0" };
      const pluginB: Plugin = {
        name: "b",
        version: "1.0.0",
        dependencies: ["a"],
      };
      const pluginC: Plugin = {
        name: "c",
        version: "1.0.0",
        dependencies: ["a", "b"],
      };

      manager.register(pluginA);
      manager.register(pluginB);
      manager.register(pluginC);

      const graph = manager.getDependencyGraph();

      expect(graph).toEqual({
        a: [],
        b: ["a"],
        c: ["a", "b"],
      });
    });
  });

  describe("autoActivate 选项", () => {
    it("应该在安装后自动激活插件", async () => {
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

  describe("continueOnError 选项", () => {
    it("continueOnError: true 时应该继续执行后续插件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, { continueOnError: true });
      let plugin2Called = false;

      const plugin1: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("Plugin 1 error");
        },
      };

      const plugin2: Plugin = {
        name: "normal-plugin",
        version: "1.0.0",
        async onInit() {
          plugin2Called = true;
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      await manager.triggerInit();

      expect(plugin2Called).toBe(true);
    });

    it("continueOnError: false 时应该在第一个错误处停止", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, { continueOnError: false });
      let plugin2Called = false;

      const plugin1: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("Plugin 1 error");
        },
      };

      const plugin2: Plugin = {
        name: "normal-plugin",
        version: "1.0.0",
        async onInit() {
          plugin2Called = true;
        },
      };

      await manager.use(plugin1);
      await manager.use(plugin2);

      try {
        await manager.triggerInit();
      } catch {
        // 预期会抛出错误
      }

      expect(plugin2Called).toBe(false);
    });
  });
});
