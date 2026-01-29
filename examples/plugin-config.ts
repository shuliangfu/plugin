/**
 * 带配置的插件示例
 *
 * 演示插件配置和运行时配置更新
 * 插件只响应事件，不写生命周期钩子
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager, type RequestContext } from "../src/mod.ts";

/**
 * 缓存配置接口
 */
interface CacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 缓存过期时间（秒） */
  ttl: number;
  /** 是否启用缓存 */
  enabled: boolean;
}

/**
 * 简单的内存缓存
 */
const cache = new Map<string, { value: string; expires: number }>();

/**
 * 缓存插件
 *
 * 只响应事件，使用配置控制行为
 */
const cachePlugin: Plugin = {
  name: "cache-plugin",
  version: "1.0.0",

  // 插件配置
  config: {
    maxSize: 1000,
    ttl: 3600,
    enabled: true,
  } as Record<string, unknown>,

  // 配置验证
  validateConfig(config: Record<string, unknown>): boolean {
    const c = config as unknown as CacheConfig;
    return (
      typeof c.maxSize === "number" &&
      c.maxSize > 0 &&
      typeof c.ttl === "number" &&
      c.ttl > 0 &&
      typeof c.enabled === "boolean"
    );
  },

  // 配置更新时清除缓存
  async onConfigUpdate(newConfig: Record<string, unknown>) {
    const config = newConfig as unknown as CacheConfig;
    console.log("[CachePlugin] 配置已更新:", config);
    if (!config.enabled) {
      cache.clear();
      console.log("[CachePlugin] 缓存已禁用，清除所有条目");
    }
  },

  // 应用初始化时
  async onInit() {
    console.log("[CachePlugin] 缓存插件已初始化");
  },

  // 请求处理前检查缓存
  async onRequest(ctx: RequestContext) {
    const config = this.config as unknown as CacheConfig;
    if (!config.enabled) return;

    const cacheKey = `${ctx.method}:${ctx.path}`;
    const cached = cache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      console.log(`[CachePlugin] 缓存命中: ${cacheKey}`);
      // 返回缓存的响应
      return new Response(cached.value, {
        headers: { "X-Cache": "HIT" },
      });
    }

    console.log(`[CachePlugin] 缓存未命中: ${cacheKey}`);
  },

  // 请求处理后缓存响应
  async onResponse(ctx: RequestContext) {
    const config = this.config as unknown as CacheConfig;
    if (!config.enabled || !ctx.response) return;

    // 只缓存 GET 请求的成功响应
    if (ctx.method !== "GET" || ctx.response.status !== 200) return;

    const cacheKey = `${ctx.method}:${ctx.path}`;

    // 检查缓存大小限制
    if (cache.size >= config.maxSize) {
      // 简单的 LRU：删除最早的条目
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }

    // 缓存响应
    const body = await ctx.response.clone().text();
    cache.set(cacheKey, {
      value: body,
      expires: Date.now() + config.ttl * 1000,
    });
    console.log(`[CachePlugin] 已缓存: ${cacheKey}`);
  },

  // 健康检查
  async onHealthCheck() {
    const config = this.config as unknown as CacheConfig;
    return {
      status: config.enabled ? ("healthy" as const) : ("degraded" as const),
      checks: {
        cache: {
          status: config.enabled ? ("pass" as const) : ("warn" as const),
          message: config.enabled
            ? `缓存条目: ${cache.size}/${config.maxSize}`
            : "缓存已禁用",
        },
      },
    };
  },

  // 应用关闭时清理
  async onShutdown() {
    cache.clear();
    console.log("[CachePlugin] 缓存已清理");
  },
};

/**
 * 使用示例
 */
async function main() {
  const container = new ServiceContainer();
  const pluginManager = new PluginManager(container);

  // 使用 use() 添加并激活插件
  await pluginManager.use(cachePlugin);
  await pluginManager.triggerInit();

  // 模拟请求
  console.log("\n--- 第一次请求（缓存未命中）---");
  const ctx1: RequestContext = {
    request: new Request("http://localhost/api/data"),
    path: "/api/data",
    method: "GET",
    url: new URL("http://localhost/api/data"),
    headers: new Headers(),
  };

  let response = await pluginManager.triggerRequest(ctx1);
  if (!response) {
    ctx1.response = new Response('{"data": "hello"}', { status: 200 });
    await pluginManager.triggerResponse(ctx1);
  }

  // 第二次请求（应该命中缓存）
  console.log("\n--- 第二次请求（缓存命中）---");
  const ctx2: RequestContext = { ...ctx1 };
  response = await pluginManager.triggerRequest(ctx2);
  if (response) {
    console.log("返回缓存响应:", await response.text());
  }

  // 运行时更新配置
  console.log("\n--- 更新配置（禁用缓存）---");
  pluginManager.setConfig("cache-plugin", {
    maxSize: 500,
    ttl: 1800,
    enabled: false,
  });

  // 健康检查
  console.log("\n--- 健康检查 ---");
  const health = await pluginManager.triggerHealthCheck();
  console.log("健康状态:", JSON.stringify(health, null, 2));

  // 优雅关闭
  await pluginManager.shutdown();
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
