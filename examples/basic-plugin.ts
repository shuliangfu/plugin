/**
 * 基础插件示例
 *
 * 演示插件只需响应事件，生命周期由 Manager 统一管理
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager, type RequestContext } from "../src/mod.ts";

/**
 * 日志插件
 *
 * 只响应应用事件，不需要写生命周期钩子
 */
const loggerPlugin: Plugin = {
  name: "logger-plugin",
  version: "1.0.0",

  // 应用初始化完成时
  async onInit() {
    console.log("[LoggerPlugin] 应用已初始化");
  },

  // 应用启动时
  async onStart() {
    console.log("[LoggerPlugin] 应用已启动");
  },

  // 请求处理前
  async onRequest(ctx: RequestContext) {
    console.log(`[LoggerPlugin] 收到请求: ${ctx.method} ${ctx.path}`);
    // 不返回 Response，继续后续处理
  },

  // 请求处理后
  async onResponse(ctx: RequestContext) {
    console.log(
      `[LoggerPlugin] 响应完成: ${ctx.method} ${ctx.path} -> ${ctx.response?.status}`,
    );
  },

  // 错误处理
  async onError(error: Error, ctx?: RequestContext) {
    console.error(
      `[LoggerPlugin] 错误: ${error.message}`,
      ctx ? `(${ctx.method} ${ctx.path})` : "",
    );
    // 不返回 Response，使用默认错误处理
  },

  // 应用停止时
  async onStop() {
    console.log("[LoggerPlugin] 应用正在停止...");
  },

  // 应用关闭时
  async onShutdown() {
    console.log("[LoggerPlugin] 应用已关闭");
  },
};

/**
 * 认证插件
 *
 * 演示 onRequest 返回 Response 跳过后续处理
 */
const authPlugin: Plugin = {
  name: "auth-plugin",
  version: "1.0.0",

  // 请求处理前进行认证检查
  async onRequest(ctx: RequestContext) {
    // 检查是否需要认证的路径
    if (ctx.path.startsWith("/api/")) {
      const authHeader = ctx.headers.get("Authorization");
      if (!authHeader) {
        // 返回 Response 直接响应，跳过后续处理
        return new Response(JSON.stringify({ error: "未授权" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    // 不返回，继续后续处理
  },
};

/**
 * 健康检查插件
 */
const healthPlugin: Plugin = {
  name: "health-plugin",
  version: "1.0.0",

  // 健康检查
  async onHealthCheck() {
    return {
      status: "healthy" as const,
      checks: {
        memory: { status: "pass" as const },
        uptime: { status: "pass" as const, message: "运行正常" },
      },
    };
  },
};

/**
 * 使用插件
 */
async function main() {
  // 创建服务容器
  const container = new ServiceContainer();

  // 创建插件管理器
  const pluginManager = new PluginManager(container);

  // ===== 方式 1: 使用 use() 逐个添加并激活 =====
  await pluginManager.use(loggerPlugin);
  await pluginManager.use(authPlugin);
  await pluginManager.use(healthPlugin);

  // 触发初始化（use 不会自动触发 onInit）
  await pluginManager.triggerInit();

  // ===== 方式 2: 使用 bootstrap() 批量启动 =====
  // pluginManager.register(loggerPlugin);
  // pluginManager.register(authPlugin);
  // pluginManager.register(healthPlugin);
  // await pluginManager.bootstrap(); // 自动安装、激活并触发 onInit

  // ===== 以下由应用框架在适当时机触发 =====

  // 服务器开始监听时
  await pluginManager.triggerStart();

  // 模拟请求处理
  console.log("\n--- 模拟请求 ---");

  // 请求 1: 公开路径
  const ctx1: RequestContext = {
    request: new Request("http://localhost/public"),
    path: "/public",
    method: "GET",
    url: new URL("http://localhost/public"),
    headers: new Headers(),
  };
  const response1 = await pluginManager.triggerRequest(ctx1);
  if (!response1) {
    ctx1.response = new Response("Public content", { status: 200 });
    await pluginManager.triggerResponse(ctx1);
  }

  // 请求 2: API 路径（无认证头 → 被 authPlugin 拦截）
  const ctx2: RequestContext = {
    request: new Request("http://localhost/api/users"),
    path: "/api/users",
    method: "GET",
    url: new URL("http://localhost/api/users"),
    headers: new Headers(),
  };
  const response2 = await pluginManager.triggerRequest(ctx2);
  if (response2) {
    console.log(`[Main] 请求被拦截: ${response2.status}`);
  }

  // 健康检查
  console.log("\n--- 健康检查 ---");
  const health = await pluginManager.triggerHealthCheck();
  console.log("健康状态:", health);

  // 优雅关闭（触发 onStop、onShutdown，并停用/卸载所有插件）
  console.log("\n--- 应用关闭 ---");
  await pluginManager.shutdown();
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
