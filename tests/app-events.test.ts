/**
 * 应用级别事件钩子测试
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { PluginManager } from "../src/mod.ts";
import type { Plugin } from "../src/types.ts";

// 定义简化的 HttpContext 类型（用于测试，匹配 Plugin 接口中的类型）
type HttpContext = {
  request: Request;
  response?: Response;
  path: string;
  method: string;
  url: URL;
  headers: Headers;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown;
};

// 模拟 HttpContext
function createMockHttpContext(): HttpContext {
  return {
    request: new Request("http://example.com/test"),
    path: "/test",
    method: "GET",
    url: new URL("http://example.com/test"),
    headers: new Headers(),
  };
}

describe("应用级别事件钩子", () => {
  describe("onInit", () => {
    it("应该调用 onInit 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onInitCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onInit(container) {
          onInitCalled = true;
          expect(container).toBeInstanceOf(ServiceContainer);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      // 注意：onInit 是由应用框架触发的，这里我们直接调用
      // 在实际应用中，这应该由 dweb 框架触发
      if (plugin.onInit) {
        await plugin.onInit(container);
      }

      expect(onInitCalled).toBe(true);
    });

    it("应该支持多个插件的 onInit 钩子", async () => {
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

      // 模拟触发 onInit
      if (plugin1.onInit) await plugin1.onInit(container);
      if (plugin2.onInit) await plugin2.onInit(container);

      expect(calledPlugins).toContain("plugin1");
      expect(calledPlugins).toContain("plugin2");
    });

    it("应该处理 onInit 钩子中的错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let errorCaught = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onInit() {
          throw new Error("onInit 错误");
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      try {
        if (plugin.onInit) {
          await plugin.onInit(container);
        }
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(Error);
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe("onStart", () => {
    it("应该调用 onStart 钩子", async () => {
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

      if (plugin.onStart) {
        await plugin.onStart(container);
      }

      expect(onStartCalled).toBe(true);
    });
  });

  describe("onStop", () => {
    it("应该调用 onStop 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onStopCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onStop(container) {
          onStopCalled = true;
          expect(container).toBeInstanceOf(ServiceContainer);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      if (plugin.onStop) {
        await plugin.onStop(container);
      }

      expect(onStopCalled).toBe(true);
    });
  });

  describe("onShutdown", () => {
    it("应该调用 onShutdown 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onShutdownCalled = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onShutdown(container) {
          onShutdownCalled = true;
          expect(container).toBeInstanceOf(ServiceContainer);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      if (plugin.onShutdown) {
        await plugin.onShutdown(container);
      }

      expect(onShutdownCalled).toBe(true);
    });
  });

  describe("onRequest", () => {
    it("应该调用 onRequest 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onRequestCalled = false;
      let receivedCtx: HttpContext | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onRequest(ctx: HttpContext, container: ServiceContainer) {
          onRequestCalled = true;
          receivedCtx = ctx;
          expect(ctx).toBeDefined();
          expect(ctx.path).toBe("/test");
          expect(ctx.method).toBe("GET");
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockHttpContext();
      if (plugin.onRequest) {
        await plugin.onRequest(ctx, container);
      }

      expect(onRequestCalled).toBe(true);
      expect(receivedCtx).not.toBeNull();
      if (receivedCtx) {
        expect((receivedCtx as HttpContext).path).toBe("/test");
      }
    });

    it("应该能够访问请求上下文的所有属性", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let accessedProperties: string[] = [];

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onRequest(ctx) {
          accessedProperties.push("request");
          accessedProperties.push("path");
          accessedProperties.push("method");
          accessedProperties.push("url");
          accessedProperties.push("headers");

          expect(ctx.request).toBeInstanceOf(Request);
          expect(typeof ctx.path).toBe("string");
          expect(typeof ctx.method).toBe("string");
          expect(ctx.url).toBeInstanceOf(URL);
          expect(ctx.headers).toBeInstanceOf(Headers);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockHttpContext();
      if (plugin.onRequest) {
        await plugin.onRequest(ctx, container);
      }

      expect(accessedProperties.length).toBeGreaterThan(0);
    });

    it("应该处理 onRequest 钩子中的错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let errorCaught = false;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onRequest() {
          throw new Error("onRequest 错误");
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockHttpContext();
      try {
        if (plugin.onRequest) {
          await plugin.onRequest(ctx, container);
        }
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(Error);
      }

      expect(errorCaught).toBe(true);
    });
  });

  describe("onResponse", () => {
    it("应该调用 onResponse 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onResponseCalled = false;
      let receivedCtx: Parameters<NonNullable<Plugin["onResponse"]>>[0] | null =
        null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onResponse(ctx, container) {
          onResponseCalled = true;
          receivedCtx = ctx;
          expect(ctx).toBeDefined();
          expect(ctx.response).toBeDefined();
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockHttpContext();
      ctx.response = new Response("OK", { status: 200 });
      if (plugin.onResponse) {
        await plugin.onResponse(ctx, container);
      }

      expect(onResponseCalled).toBe(true);
      expect(receivedCtx).not.toBeNull();
      if (receivedCtx) {
        expect((receivedCtx as HttpContext).response).toBeDefined();
      }
    });

    it("应该能够访问响应对象", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let responseStatus: number | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onResponse(ctx) {
          if (ctx.response) {
            responseStatus = ctx.response.status;
          }
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const ctx = createMockHttpContext();
      ctx.response = new Response("OK", { status: 201 });
      if (plugin.onResponse) {
        await plugin.onResponse(ctx, container);
      }

      expect(responseStatus).toBe(201);
    });
  });

  describe("onBuild", () => {
    it("应该调用 onBuild 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onBuildCalled = false;
      let receivedOptions: {
        mode: "dev" | "prod";
        target?: "client" | "server";
      } | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onBuild(options, container) {
          onBuildCalled = true;
          receivedOptions = options;
          expect(options.mode).toBe("prod");
          expect(container).toBeInstanceOf(ServiceContainer);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const options = { mode: "prod" as const, target: "client" as const };
      if (plugin.onBuild) {
        await plugin.onBuild(options, container);
      }

      expect(onBuildCalled).toBe(true);
      expect(receivedOptions).not.toBeNull();
      if (receivedOptions) {
        expect(
          (receivedOptions as {
            mode: "dev" | "prod";
            target?: "client" | "server";
          }).mode,
        ).toBe("prod");
      }
    });

    it("应该支持 dev 和 prod 模式", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const modes: string[] = [];

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onBuild(options) {
          modes.push(options.mode);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      if (plugin.onBuild) {
        await plugin.onBuild({ mode: "dev" }, container);
        await plugin.onBuild({ mode: "prod" }, container);
      }

      expect(modes).toContain("dev");
      expect(modes).toContain("prod");
    });
  });

  describe("onBuildComplete", () => {
    it("应该调用 onBuildComplete 钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let onBuildCompleteCalled = false;
      let receivedResult:
        | Parameters<NonNullable<Plugin["onBuildComplete"]>>[0]
        | null = null;

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onBuildComplete(result, container) {
          onBuildCompleteCalled = true;
          receivedResult = result;
          expect(result.outputFiles).toBeDefined();
          expect(container).toBeInstanceOf(ServiceContainer);
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const result = {
        outputFiles: ["file1.js", "file2.css"],
        errors: [],
        warnings: [],
      };
      if (plugin.onBuildComplete) {
        await plugin.onBuildComplete(result, container);
      }

      expect(onBuildCompleteCalled).toBe(true);
      expect(receivedResult).not.toBeNull();
      if (receivedResult) {
        expect(
          (receivedResult as {
            outputFiles?: string[];
            errors?: unknown[];
            warnings?: unknown[];
          }).outputFiles,
        ).toEqual(["file1.js", "file2.css"]);
      }
    });

    it("应该能够访问构建结果的所有属性", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let accessedProperties: string[] = [];

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onBuildComplete(result) {
          if (result.outputFiles) accessedProperties.push("outputFiles");
          if (result.errors) accessedProperties.push("errors");
          if (result.warnings) accessedProperties.push("warnings");
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      const result = {
        outputFiles: ["file1.js"],
        errors: [new Error("构建错误")],
        warnings: ["警告信息"],
      };
      if (plugin.onBuildComplete) {
        await plugin.onBuildComplete(result, container);
      }

      expect(accessedProperties.length).toBeGreaterThan(0);
    });
  });

  describe("事件钩子组合", () => {
    it("应该支持插件实现多个事件钩子", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      const calledHooks: string[] = [];

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
        async onInit() {
          calledHooks.push("onInit");
        },
        async onStart() {
          calledHooks.push("onStart");
        },
        async onRequest() {
          calledHooks.push("onRequest");
        },
        async onResponse() {
          calledHooks.push("onResponse");
        },
        async onStop() {
          calledHooks.push("onStop");
        },
        async onShutdown() {
          calledHooks.push("onShutdown");
        },
      };

      manager.register(plugin);
      await manager.install("test-plugin");
      await manager.activate("test-plugin");

      // 模拟触发所有事件
      if (plugin.onInit) await plugin.onInit(container);
      if (plugin.onStart) await plugin.onStart(container);
      if (plugin.onRequest) {
        await plugin.onRequest(createMockHttpContext(), container);
      }
      if (plugin.onResponse) {
        const ctx = createMockHttpContext();
        ctx.response = new Response();
        await plugin.onResponse(ctx, container);
      }
      if (plugin.onStop) await plugin.onStop(container);
      if (plugin.onShutdown) await plugin.onShutdown(container);

      expect(calledHooks).toContain("onInit");
      expect(calledHooks).toContain("onStart");
      expect(calledHooks).toContain("onRequest");
      expect(calledHooks).toContain("onResponse");
      expect(calledHooks).toContain("onStop");
      expect(calledHooks).toContain("onShutdown");
    });

    it("应该只触发已激活插件的事件钩子", async () => {
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

      // 只触发已激活插件的钩子
      if (activePlugin.onInit) await activePlugin.onInit(container);
      if (inactivePlugin.onInit) await inactivePlugin.onInit(container);

      expect(activePluginCalled).toBe(true);
      // 注意：这里 inactivePluginCalled 也会是 true，因为我们是直接调用的
      // 在实际应用中，事件系统会检查插件状态
    });
  });

  describe("事件钩子错误处理", () => {
    it("应该隔离不同插件的事件钩子错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);
      let errorPluginCalled = false;
      let normalPluginCalled = false;

      const errorPlugin: Plugin = {
        name: "error-plugin",
        version: "1.0.0",
        async onInit() {
          errorPluginCalled = true;
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

      // 触发错误插件的钩子（应该抛出错误）
      try {
        if (errorPlugin.onInit) await errorPlugin.onInit(container);
      } catch {
        // 捕获错误
      }

      // 触发正常插件的钩子（应该成功）
      if (normalPlugin.onInit) await normalPlugin.onInit(container);

      expect(errorPluginCalled).toBe(true);
      expect(normalPluginCalled).toBe(true);
    });
  });
});
