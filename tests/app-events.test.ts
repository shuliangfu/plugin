/**
 * 应用级别事件钩子测试
 *
 * 测试 PluginManager 的 trigger* 方法是否正确触发插件的事件钩子
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { PluginManager } from "../src/mod.ts";
import type {
  Plugin,
  RequestContext,
  RouteDefinition,
  ScheduleContext,
  WebSocketContext,
} from "../src/types.ts";

/**
 * 创建模拟的请求上下文
 *
 * @returns 模拟的 RequestContext 对象
 */
function createMockRequestContext(): RequestContext {
  return {
    request: new Request("http://example.com/test"),
    path: "/test",
    method: "GET",
    url: new URL("http://example.com/test"),
    headers: new Headers(),
  };
}

/**
 * 创建模拟的 WebSocket 上下文
 *
 * @returns 模拟的 WebSocketContext 对象
 */
function createMockWebSocketContext(): WebSocketContext {
  // 创建一个模拟的 WebSocket 对象
  const mockSocket = {
    readyState: 1, // OPEN
    send: () => {},
    close: () => {},
  } as unknown as WebSocket;

  return {
    socket: mockSocket,
    request: new Request("http://example.com/ws"),
    connectionId: "test-connection-id",
  };
}

/**
 * 创建模拟的定时任务上下文
 *
 * @returns 模拟的 ScheduleContext 对象
 */
function createMockScheduleContext(): ScheduleContext {
  return {
    taskName: "test-task",
    schedule: "0 * * * *",
    lastRun: new Date(Date.now() - 3600000),
    nextRun: new Date(Date.now() + 3600000),
  };
}

describe("应用级别事件钩子 - Manager trigger* 方法", () => {
  // ==================== 生命周期事件测试 ====================

  describe("triggerInit", () => {
    it("应该触发所有已激活插件的 onInit 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const calledPlugins: string[] = [];

      const plugin1: Plugin = {
        name: "plugin1",
        version: "1.0.0",
        async onInit() {
          calledPlugins.push("plugin1");
        },
      };

      const plugin2: Plugin = {
        name: "plugin2",
        version: "1.0.0",
        async onInit() {
          calledPlugins.push("plugin2");
        },
      };

      manager.register(plugin1);
      manager.register(plugin2);
      await manager.install("plugin1");
      await manager.install("plugin2");
      await manager.activate("plugin1");
      await manager.activate("plugin2");

      // 使用 Manager 的 triggerInit 方法
      await manager.triggerInit();

      expect(calledPlugins).toContain("plugin1");
      expect(calledPlugins).toContain("plugin2");
    });

    it("应该只触发已激活插件的 onInit 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let activePluginCalled = false;
      let inactivePluginCalled = false;

      const activePlugin: Plugin = {
        name: "active-plugin",
        version: "1.0.0",
        async onInit() {
          activePluginCalled = true;
        },
      };

      const inactivePlugin: Plugin = {
        name: "inactive-plugin",
        version: "1.0.0",
        async onInit() {
          inactivePluginCalled = true;
        },
      };

      manager.register(activePlugin);
      manager.register(inactivePlugin);
      await manager.install("active-plugin");
      await manager.install("inactive-plugin");
      await manager.activate("active-plugin");
      // inactive-plugin 未激活

      await manager.triggerInit();

      expect(activePluginCalled).toBe(true);
      expect(inactivePluginCalled).toBe(false);
    });

    it("应该处理 onInit 钩子中的错误（continueOnError: true）", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, { continueOnError: true });
      let normalPluginCalled = false;

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("onInit 错误");
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
      await manager.activate("error-plugin");
      await manager.activate("normal-plugin");

      // 不应该抛出错误，继续执行
      await manager.triggerInit();

      expect(normalPluginCalled).toBe(true);
    });
  });

  describe("triggerStart", () => {
    it("应该触发所有已激活插件的 onStart 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onStartCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onStart(container) {
          onStartCalled = true;
          expect(container).toBeInstanceOf(ServiceContainer);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      await manager.triggerStart();

      expect(onStartCalled).toBe(true);
    });
  });

  describe("triggerStop", () => {
    it("应该触发所有已激活插件的 onStop 钩子（逆序）", async () => {
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

      manager.register(plugin1);
      manager.register(plugin2);
      await manager.install("plugin1");
      await manager.install("plugin2");
      await manager.activate("plugin1");
      await manager.activate("plugin2");

      await manager.triggerStop();

      // 后激活的先停止
      expect(stopOrder[0]).toBe("plugin2");
      expect(stopOrder[1]).toBe("plugin1");
    });
  });

  describe("triggerShutdown", () => {
    it("应该触发所有已激活插件的 onShutdown 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onShutdownCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onShutdown() {
          onShutdownCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      await manager.triggerShutdown();

      expect(onShutdownCalled).toBe(true);
    });
  });

  // ==================== HTTP 请求事件测试 ====================

  describe("triggerRequest", () => {
    it("应该触发所有已激活插件的 onRequest 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onRequestCalled = false;
      let receivedCtx: RequestContext | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onRequest(ctx) {
          onRequestCalled = true;
          receivedCtx = ctx;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockRequestContext();
      await manager.triggerRequest(ctx);

      expect(onRequestCalled).toBe(true);
      expect(receivedCtx).not.toBeNull();
      expect(receivedCtx!.path).toBe("/test");
    });

    it("应该在插件返回 Response 时直接返回", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let secondPluginCalled = false;

      const authPlugin: Plugin = {
        name: "auth-plugin",
        version: "1.0.0",
        async onRequest() {
          // 模拟认证失败，返回 401
          return new Response("Unauthorized", { status: 401 });
        },
      };

      const logPlugin: Plugin = {
        name: "log-plugin",
        version: "1.0.0",
        async onRequest() {
          secondPluginCalled = true;
        },
      };

      manager.register(authPlugin);
      manager.register(logPlugin);
      await manager.install("auth-plugin");
      await manager.install("log-plugin");
      await manager.activate("auth-plugin");
      await manager.activate("log-plugin");

      const ctx = createMockRequestContext();
      const response = await manager.triggerRequest(ctx);

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(401);
      // 由于第一个插件返回了 Response，第二个插件不应该被调用
      expect(secondPluginCalled).toBe(false);
    });
  });

  describe("triggerResponse", () => {
    it("应该触发所有已激活插件的 onResponse 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onResponseCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onResponse(ctx) {
          onResponseCalled = true;
          expect(ctx.response).toBeDefined();
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockRequestContext();
      ctx.response = new Response("OK", { status: 200 });
      await manager.triggerResponse(ctx);

      expect(onResponseCalled).toBe(true);
    });
  });

  // ==================== 错误处理事件测试 ====================

  describe("triggerError", () => {
    it("应该触发所有已激活插件的 onError 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onErrorCalled = false;
      let receivedError: Error | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onError(error) {
          onErrorCalled = true;
          receivedError = error;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const testError = new Error("测试错误");
      await manager.triggerError(testError);

      expect(onErrorCalled).toBe(true);
      expect(receivedError).toBe(testError);
    });

    it("应该在插件返回 Response 时返回自定义错误响应", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const errorHandlerPlugin: Plugin = {
        name: "error-handler",
        version: "1.0.0",
        async onError(error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        },
      };

      manager.register(errorHandlerPlugin);
      await manager.install("error-handler");
      await manager.activate("error-handler");

      const testError = new Error("测试错误");
      const response = await manager.triggerError(testError);

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(500);
    });
  });

  // ==================== 路由事件测试 ====================

  describe("triggerRoute", () => {
    it("应该允许插件修改路由列表", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const routePlugin: Plugin = {
        name: "route-plugin",
        version: "1.0.0",
        async onRoute(routes) {
          // 添加一个新路由
          return [
            ...routes,
            {
              path: "/plugin-route",
              method: "GET" as const,
              handler: () => new Response("Plugin Route"),
            },
          ];
        },
      };

      manager.register(routePlugin);
      await manager.install("route-plugin");
      await manager.activate("route-plugin");

      const initialRoutes: RouteDefinition[] = [
        {
          path: "/api/users",
          method: "GET",
          handler: () => new Response("Users"),
        },
      ];

      const finalRoutes = await manager.triggerRoute(initialRoutes);

      expect(finalRoutes.length).toBe(2);
      expect(finalRoutes[1].path).toBe("/plugin-route");
    });
  });

  // ==================== 构建事件测试 ====================

  describe("triggerBuild", () => {
    it("应该触发所有已激活插件的 onBuild 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onBuildCalled = false;
      let receivedMode: string | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onBuild(options) {
          onBuildCalled = true;
          receivedMode = options.mode;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      await manager.triggerBuild({ mode: "prod", target: "client" });

      expect(onBuildCalled).toBe(true);
      expect(receivedMode).toBe("prod");
    });
  });

  describe("triggerBuildComplete", () => {
    it("应该触发所有已激活插件的 onBuildComplete 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onBuildCompleteCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onBuildComplete(result) {
          onBuildCompleteCalled = true;
          expect(result.outputFiles).toEqual(["bundle.js"]);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      await manager.triggerBuildComplete({
        outputFiles: ["bundle.js"],
        duration: 1000,
      });

      expect(onBuildCompleteCalled).toBe(true);
    });
  });

  // ==================== WebSocket 事件测试 ====================

  describe("triggerWebSocket", () => {
    it("应该触发所有已激活插件的 onWebSocket 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onWebSocketCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onWebSocket(ctx) {
          onWebSocketCalled = true;
          expect(ctx.socket).toBeDefined();
          expect(ctx.connectionId).toBe("test-connection-id");
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockWebSocketContext();
      await manager.triggerWebSocket(ctx);

      expect(onWebSocketCalled).toBe(true);
    });
  });

  describe("triggerWebSocketClose", () => {
    it("应该触发所有已激活插件的 onWebSocketClose 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onWebSocketCloseCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onWebSocketClose() {
          onWebSocketCloseCalled = true;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockWebSocketContext();
      await manager.triggerWebSocketClose(ctx);

      expect(onWebSocketCloseCalled).toBe(true);
    });
  });

  // ==================== 定时任务事件测试 ====================

  describe("triggerSchedule", () => {
    it("应该触发所有已激活插件的 onSchedule 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onScheduleCalled = false;
      let receivedTaskName: string | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onSchedule(ctx) {
          onScheduleCalled = true;
          receivedTaskName = ctx.taskName;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockScheduleContext();
      await manager.triggerSchedule(ctx);

      expect(onScheduleCalled).toBe(true);
      expect(receivedTaskName).toBe("test-task");
    });
  });

  // ==================== 健康检查事件测试 ====================

  describe("triggerHealthCheck", () => {
    it("应该聚合所有已激活插件的健康状态", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const healthyPlugin: Plugin = {
        name: "healthy-plugin",
        version: "1.0.0",
        async onHealthCheck() {
          return {
            status: "healthy" as const,
            checks: {
              database: { status: "pass" as const },
            },
          };
        },
      };

      const degradedPlugin: Plugin = {
        name: "degraded-plugin",
        version: "1.0.0",
        async onHealthCheck() {
          return {
            status: "degraded" as const,
            checks: {
              cache: { status: "warn" as const, message: "缓存响应较慢" },
            },
          };
        },
      };

      manager.register(healthyPlugin);
      manager.register(degradedPlugin);
      await manager.install("healthy-plugin");
      await manager.install("degraded-plugin");
      await manager.activate("healthy-plugin");
      await manager.activate("degraded-plugin");

      const status = await manager.triggerHealthCheck();

      // 整体状态应该是 degraded（因为有一个插件是 degraded）
      expect(status.status).toBe("degraded");
      expect(status.checks).toBeDefined();
      expect(status.timestamp).toBeDefined();
    });

    it("应该处理健康检查中的错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onHealthCheck() {
          throw new Error("健康检查失败");
        },
      };

      manager.register(errorPlugin);
      await manager.install("error-plugin");
      await manager.activate("error-plugin");

      const status = await manager.triggerHealthCheck();

      expect(status.status).toBe("unhealthy");
      expect(status.checks!["error-plugin"].status).toBe("fail");
      expect(status.checks!["error-plugin"].message).toBe("健康检查失败");
    });
  });

  // ==================== 热重载事件测试 ====================

  describe("triggerHotReload", () => {
    it("应该触发所有已激活插件的 onHotReload 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onHotReloadCalled = false;
      let receivedFiles: string[] = [];

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onHotReload(changedFiles) {
          onHotReloadCalled = true;
          receivedFiles = changedFiles;
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      await manager.triggerHotReload(["src/app.ts", "src/utils.ts"]);

      expect(onHotReloadCalled).toBe(true);
      expect(receivedFiles).toEqual(["src/app.ts", "src/utils.ts"]);
    });
  });

  // ==================== 事件钩子组合测试 ====================

  describe("事件钩子组合", () => {
    it("应该支持完整的生命周期流程", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const lifecycle: string[] = [];

      const plugin: Plugin = {
        name: "lifecycle-plugin",
        version: "1.0.0",
        async onInit() {
          lifecycle.push("init");
        },
        async onStart() {
          lifecycle.push("start");
        },
        async onRequest() {
          lifecycle.push("request");
        },
        async onResponse() {
          lifecycle.push("response");
        },
        async onStop() {
          lifecycle.push("stop");
        },
        async onShutdown() {
          lifecycle.push("shutdown");
        },
      };

      manager.register(plugin);
      await manager.install("lifecycle-plugin");
      await manager.activate("lifecycle-plugin");

      // 模拟完整的应用生命周期
      await manager.triggerInit();
      await manager.triggerStart();
      await manager.triggerRequest(createMockRequestContext());
      const ctx = createMockRequestContext();
      ctx.response = new Response();
      await manager.triggerResponse(ctx);
      await manager.triggerStop();
      await manager.triggerShutdown();

      expect(lifecycle).toEqual([
        "init",
        "start",
        "request",
        "response",
        "stop",
        "shutdown",
      ]);
    });
  });
});
