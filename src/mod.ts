/**
 * @module @dreamer/plugin
 *
 * @dreamer/plugin 插件管理系统
 *
 * 提供插件注册、生命周期管理、依赖解析、事件系统等功能。
 *
 * 环境兼容性：
 * - 服务端：✅ 支持（Deno 和 Bun 运行时）
 * - 客户端：❌ 不支持（浏览器环境，插件系统是服务端概念）
 *
 * @example
 * ```typescript
 * import { ServiceContainer } from "@dreamer/service";
 * import { PluginManager } from "@dreamer/plugin";
 *
 * const container = new ServiceContainer();
 * const pluginManager = new PluginManager(container);
 *
 * // 注册插件
 * pluginManager.register({
 *   name: "my-plugin",
 *   version: "1.0.0",
 *   async install(container) {
 *     container.registerSingleton("myService", () => new MyService());
 *   },
 * });
 *
 * // 安装并激活插件
 * await pluginManager.install("my-plugin");
 * await pluginManager.activate("my-plugin");
 * ```
 */

// 导出核心类
export { PluginManager } from "./manager.ts";

// 导出热加载管理器
export { HotReloadManager } from "./hot-reload.ts";
export type { HotReloadOptions } from "./hot-reload.ts";

// 导出类型
export type {
  AppEventHooks,
  BuildOptions,
  BuildResult,
  ConfigValidator,
  HealthStatus,
  Plugin,
  PluginDebugInfo,
  PluginManagerOptions,
  PluginState,
  RegisterOptions,
  RequestContext,
  ResourceLimits,
  RouteDefinition,
  ScheduleContext,
  // Socket 类型（兼容 WebSocket 和 Socket.IO）
  SocketContext,
  SocketIOContext,
  SocketIOSocket,
  SocketType,
  WebSocketContext,
} from "./types.ts";

// 导出工具函数
export {
  detectCircularDependency,
  detectMissingDependencies,
  topologicalSort,
} from "./dependency-resolver.ts";

// 导出 Socket 工具函数
export {
  createSocketContext,
  createSocketIOContext,
  createWebSocketContext,
  isSocketIOContext,
  isWebSocketContext,
} from "./socket-utils.ts";

// 导出加载器
export { loadPluginFromFile } from "./loader.ts";

// 导出事件发射器（如果需要直接使用）
export { EventEmitter } from "./event-emitter.ts";
export type { EventListener } from "./event-emitter.ts";
