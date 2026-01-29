/**
 * 带依赖的插件示例
 *
 * 演示插件之间的依赖关系和事件协作
 * 插件只响应事件，依赖用于确保激活顺序
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager, type RequestContext } from "../src/mod.ts";

/**
 * 数据库连接状态
 */
let dbConnected = false;

/**
 * 数据库插件
 *
 * 基础插件，提供数据库连接能力
 */
const databasePlugin: Plugin = {
  name: "database-plugin",
  version: "1.0.0",

  // 应用初始化时连接数据库
  async onInit() {
    console.log("[DatabasePlugin] 正在连接数据库...");
    // 模拟数据库连接
    await new Promise((resolve) => setTimeout(resolve, 100));
    dbConnected = true;
    console.log("[DatabasePlugin] 数据库已连接");
  },

  // 健康检查
  async onHealthCheck() {
    return {
      status: dbConnected ? ("healthy" as const) : ("unhealthy" as const),
      checks: {
        database: {
          status: dbConnected ? ("pass" as const) : ("fail" as const),
          message: dbConnected ? "数据库连接正常" : "数据库未连接",
        },
      },
    };
  },

  // 应用停止时断开连接
  async onStop() {
    console.log("[DatabasePlugin] 正在断开数据库连接...");
    dbConnected = false;
    console.log("[DatabasePlugin] 数据库已断开");
  },
};

/**
 * 用户数据存储
 */
const users: Map<string, { id: string; name: string }> = new Map();

/**
 * 用户插件
 *
 * 依赖数据库插件，处理用户相关的请求
 */
const userPlugin: Plugin = {
  name: "user-plugin",
  version: "1.0.0",
  // 声明依赖：确保 database-plugin 先激活
  dependencies: ["database-plugin"],

  // 应用初始化时加载用户数据
  async onInit() {
    if (!dbConnected) {
      console.error("[UserPlugin] 错误：数据库未连接");
      return;
    }
    console.log("[UserPlugin] 正在从数据库加载用户数据...");
    // 模拟加载数据
    users.set("1", { id: "1", name: "Alice" });
    users.set("2", { id: "2", name: "Bob" });
    console.log("[UserPlugin] 用户数据已加载，共 %d 条", users.size);
  },

  // 处理用户相关请求
  async onRequest(ctx: RequestContext) {
    // 只处理 /api/users 路径
    if (!ctx.path.startsWith("/api/users")) return;

    if (!dbConnected) {
      return new Response(JSON.stringify({ error: "数据库不可用" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /api/users - 获取所有用户
    if (ctx.method === "GET" && ctx.path === "/api/users") {
      const userList = Array.from(users.values());
      return new Response(JSON.stringify(userList), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /api/users/:id - 获取单个用户
    const match = ctx.path.match(/^\/api\/users\/(\d+)$/);
    if (ctx.method === "GET" && match) {
      const user = users.get(match[1]);
      if (user) {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "用户不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  // 健康检查
  async onHealthCheck() {
    return {
      status: users.size > 0 ? ("healthy" as const) : ("degraded" as const),
      checks: {
        users: {
          status: users.size > 0 ? ("pass" as const) : ("warn" as const),
          message: `用户数据: ${users.size} 条`,
        },
      },
    };
  },
};

/**
 * 审计日志插件
 *
 * 依赖用户插件，记录用户操作日志
 */
const auditPlugin: Plugin = {
  name: "audit-plugin",
  version: "1.0.0",
  // 依赖链：audit -> user -> database
  dependencies: ["user-plugin"],

  // 记录请求日志
  async onResponse(ctx: RequestContext) {
    if (ctx.path.startsWith("/api/users")) {
      console.log(
        `[AuditPlugin] 审计日志: ${ctx.method} ${ctx.path} -> ${ctx.response?.status}`,
      );
    }
  },
};

/**
 * 使用示例
 */
async function main() {
  const container = new ServiceContainer();
  const pluginManager = new PluginManager(container);

  // 方式 1: 使用 bootstrap() 批量启动
  // 按依赖顺序注册（database -> user -> audit）
  pluginManager.register(databasePlugin);
  pluginManager.register(userPlugin);
  pluginManager.register(auditPlugin);

  // bootstrap() 自动按依赖顺序安装、激活并触发 onInit
  console.log("=== 启动插件 ===");
  await pluginManager.bootstrap();

  // 方式 2: 使用 use() 逐个添加（需要按依赖顺序）
  // await pluginManager.use(databasePlugin);
  // await pluginManager.use(userPlugin);
  // await pluginManager.use(auditPlugin);
  // await pluginManager.triggerInit();

  // 模拟请求
  console.log("\n=== 模拟请求 ===");

  // 请求 1: 获取所有用户
  const ctx1: RequestContext = {
    request: new Request("http://localhost/api/users"),
    path: "/api/users",
    method: "GET",
    url: new URL("http://localhost/api/users"),
    headers: new Headers(),
  };
  const response1 = await pluginManager.triggerRequest(ctx1);
  if (response1) {
    console.log("用户列表:", await response1.text());
    ctx1.response = response1;
    await pluginManager.triggerResponse(ctx1);
  }

  // 请求 2: 获取单个用户
  const ctx2: RequestContext = {
    request: new Request("http://localhost/api/users/1"),
    path: "/api/users/1",
    method: "GET",
    url: new URL("http://localhost/api/users/1"),
    headers: new Headers(),
  };
  const response2 = await pluginManager.triggerRequest(ctx2);
  if (response2) {
    console.log("用户详情:", await response2.text());
    ctx2.response = response2;
    await pluginManager.triggerResponse(ctx2);
  }

  // 健康检查
  console.log("\n=== 健康检查 ===");
  const health = await pluginManager.triggerHealthCheck();
  console.log("健康状态:", JSON.stringify(health, null, 2));

  // 优雅关闭
  console.log("\n=== 关闭应用 ===");
  await pluginManager.shutdown();
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
