/**
 * 基础插件示例
 *
 * 演示 @dreamer/plugin 的核心设计原则：
 * - Manager 负责插件生命周期管理（安装、激活、停用、卸载）
 * - 插件只需响应事件钩子（onInit、onRequest、onResponse 等）
 * - 插件不需要写 install/activate/deactivate/uninstall 生命周期钩子
 *
 * @example
 * ```bash
 * deno run --allow-all examples/basic-plugin.ts
 * ```
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager, type RequestContext } from "../src/mod.ts";

// ============================================================================
// 插件定义（只需实现事件钩子）
// ============================================================================

/**
 * 日志插件
 *
 * 功能：记录应用生命周期和请求处理日志
 * 演示：onInit、onStart、onRequest、onResponse、onError、onStop、onShutdown 钩子
 */
const loggerPlugin: Plugin = {
  name: "logger-plugin",
  version: "1.0.0",

  /**
   * 应用初始化完成时调用
   * 所有插件激活后、服务器开始监听前
   */
  async onInit() {
    console.log("[LoggerPlugin] ✓ 应用已初始化");
  },

  /**
   * 应用启动时调用
   * 服务器开始监听时
   */
  async onStart() {
    console.log("[LoggerPlugin] ✓ 应用已启动");
  },

  /**
   * 请求处理前调用
   * 可以返回 Response 直接响应，跳过后续处理
   */
  async onRequest(ctx: RequestContext) {
    const timestamp = new Date().toISOString();
    console.log(`[LoggerPlugin] → ${timestamp} ${ctx.method} ${ctx.path}`);
    // 不返回 Response，继续后续处理
  },

  /**
   * 请求处理后调用
   * 可以访问 ctx.response 查看响应结果
   */
  async onResponse(ctx: RequestContext) {
    console.log(
      `[LoggerPlugin] ← ${ctx.method} ${ctx.path} -> ${
        ctx.response?.status || "N/A"
      }`,
    );
  },

  /**
   * 错误发生时调用
   * 可以返回 Response 作为自定义错误响应
   */
  async onError(error: Error, ctx?: RequestContext) {
    console.error(
      `[LoggerPlugin] ✗ 错误: ${error.message}`,
      ctx ? `(${ctx.method} ${ctx.path})` : "",
    );
    // 不返回 Response，使用默认错误处理
  },

  /**
   * 应用优雅停止时调用（逆序执行）
   */
  async onStop() {
    console.log("[LoggerPlugin] ◌ 应用正在停止...");
  },

  /**
   * 应用最终关闭时调用（逆序执行）
   */
  async onShutdown() {
    console.log("[LoggerPlugin] ✓ 应用已关闭");
  },
};

/**
 * 认证插件
 *
 * 功能：检查 API 请求的认证状态
 * 演示：onRequest 返回 Response 跳过后续处理
 */
const authPlugin: Plugin = {
  name: "auth-plugin",
  version: "1.0.0",

  /**
   * 请求处理前进行认证检查
   * 返回 Response 表示直接响应，不再继续处理
   */
  async onRequest(ctx: RequestContext) {
    // 只检查 /api/ 开头的路径
    if (!ctx.path.startsWith("/api/")) {
      return; // 公开路径，跳过认证
    }

    const authHeader = ctx.headers.get("Authorization");
    if (!authHeader) {
      // 返回 401 响应，后续插件的 onRequest 不会执行
      return new Response(
        JSON.stringify({ error: "未授权", message: "请提供认证令牌" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 验证令牌格式
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "无效令牌", message: "令牌格式错误" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 认证通过，继续后续处理
    console.log("[AuthPlugin] ✓ 认证通过");
  },
};

/**
 * 健康检查插件
 *
 * 功能：提供应用健康状态检查
 * 演示：onHealthCheck 钩子
 */
const healthPlugin: Plugin = {
  name: "health-plugin",
  version: "1.0.0",

  /**
   * 健康检查时调用
   * 返回 HealthStatus 对象
   */
  async onHealthCheck() {
    // 获取内存使用情况（如果可用）
    const memoryUsage =
      (globalThis as { Deno?: { memoryUsage?: () => { heapUsed: number } } })
        .Deno?.memoryUsage?.();

    return {
      status: "healthy" as const,
      checks: {
        memory: {
          status: "pass" as const,
          message: memoryUsage
            ? `堆内存: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
            : "内存正常",
        },
        uptime: {
          status: "pass" as const,
          message: "服务运行正常",
        },
      },
    };
  },
};

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 主函数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("基础插件示例 - @dreamer/plugin");
  console.log("=".repeat(60));

  // 1. 创建服务容器和插件管理器
  const container = new ServiceContainer();
  const pluginManager = new PluginManager(container);

  // 2. 添加插件（两种方式）

  // 方式 A: 使用 use() 逐个添加并激活（推荐）
  console.log("\n--- 初始化插件 ---");
  await pluginManager.use(loggerPlugin);
  await pluginManager.use(authPlugin);
  await pluginManager.use(healthPlugin);

  // 触发初始化（use() 不会自动触发 onInit）
  await pluginManager.triggerInit();

  // 方式 B: 使用 bootstrap() 批量启动（适合大量插件）
  // pluginManager.register(loggerPlugin);
  // pluginManager.register(authPlugin);
  // pluginManager.register(healthPlugin);
  // await pluginManager.bootstrap(); // 自动安装、激活并触发 onInit

  // 3. 服务器开始监听时触发
  await pluginManager.triggerStart();

  // 4. 模拟请求处理
  console.log("\n--- 模拟请求处理 ---");

  // 请求 1: 公开路径（无需认证）
  console.log("\n[请求 1] GET /public - 公开路径");
  const ctx1: RequestContext = {
    request: new Request("http://localhost/public"),
    path: "/public",
    method: "GET",
    url: new URL("http://localhost/public"),
    headers: new Headers(),
  };
  const response1 = await pluginManager.triggerRequest(ctx1);
  if (!response1) {
    // 没有被拦截，模拟正常响应
    ctx1.response = new Response("公开内容", { status: 200 });
    await pluginManager.triggerResponse(ctx1);
  }

  // 请求 2: API 路径（无认证头 → 被 authPlugin 拦截）
  console.log("\n[请求 2] GET /api/users - 无认证头");
  const ctx2: RequestContext = {
    request: new Request("http://localhost/api/users"),
    path: "/api/users",
    method: "GET",
    url: new URL("http://localhost/api/users"),
    headers: new Headers(),
  };
  const response2 = await pluginManager.triggerRequest(ctx2);
  if (response2) {
    console.log(`[结果] 请求被拦截: ${response2.status}`);
  }

  // 请求 3: API 路径（带认证头）
  console.log("\n[请求 3] GET /api/users - 带认证头");
  const ctx3: RequestContext = {
    request: new Request("http://localhost/api/users"),
    path: "/api/users",
    method: "GET",
    url: new URL("http://localhost/api/users"),
    headers: new Headers({ Authorization: "Bearer token123" }),
  };
  const response3 = await pluginManager.triggerRequest(ctx3);
  if (!response3) {
    ctx3.response = new Response('[{"id":1,"name":"Alice"}]', { status: 200 });
    await pluginManager.triggerResponse(ctx3);
  }

  // 5. 健康检查
  console.log("\n--- 健康检查 ---");
  const health = await pluginManager.triggerHealthCheck();
  console.log("健康状态:", JSON.stringify(health, null, 2));

  // 6. 优雅关闭
  console.log("\n--- 应用关闭 ---");
  await pluginManager.shutdown();

  console.log("\n" + "=".repeat(60));
  console.log("示例完成");
  console.log("=".repeat(60));
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
