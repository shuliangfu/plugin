/**
 * 带配置的插件示例
 *
 * 演示如何使用插件配置
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager } from "../src/mod.ts";

// 配置接口
interface CachePluginConfig {
  maxSize: number;
  ttl: number;
  enabled: boolean;
}

// 缓存服务
class CacheService {
  private maxSize: number;
  private ttl: number;
  private enabled: boolean;

  constructor(config: CachePluginConfig) {
    this.maxSize = config.maxSize;
    this.ttl = config.ttl;
    this.enabled = config.enabled;
  }

  get(key: string): string | null {
    if (!this.enabled) {
      return null;
    }
    console.log(
      `Getting ${key} from cache (maxSize: ${this.maxSize}, ttl: ${this.ttl})`,
    );
    return `cached-${key}`;
  }

  set(key: string, value: string): void {
    if (!this.enabled) {
      return;
    }
    console.log(`Setting ${key} in cache`);
  }
}

// 带配置的缓存插件
const cachePluginConfig: CachePluginConfig = {
  maxSize: 1000,
  ttl: 3600,
  enabled: true,
};

const cachePlugin: Plugin = {
  name: "cache-plugin",
  version: "1.0.0",
  // 插件配置
  config: cachePluginConfig as unknown as Record<string, unknown>,
  async install(container) {
    // 从插件配置创建服务
    const config =
      (this.config || cachePluginConfig) as unknown as CachePluginConfig;
    container.registerSingleton("cacheService", () => new CacheService(config));
    console.log("Cache plugin installed with config:", config);
  },
  async activate(container) {
    const cacheService = container.get<CacheService>("cacheService");
    cacheService.set("test", "value");
    console.log("Cache plugin activated");
  },
  async deactivate() {
    console.log("Cache plugin deactivated");
  },
};

// 使用插件
async function main() {
  const container = new ServiceContainer();
  const pluginManager = new PluginManager(container);

  // 注册插件
  pluginManager.register(cachePlugin);

  // 安装并激活
  await pluginManager.install("cache-plugin");
  await pluginManager.activate("cache-plugin");

  // 使用服务
  const cacheService = container.get<CacheService>("cacheService");
  const value = cacheService.get("test");
  console.log("Cached value:", value);

  // 清理
  await pluginManager.deactivate("cache-plugin");
  await pluginManager.uninstall("cache-plugin");
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
