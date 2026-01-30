/**
 * 插件类型定义
 */

import type { ServiceContainer } from "@dreamer/service";

/**
 * 插件状态
 */
export type PluginState =
  | "registered" // 已注册
  | "installed" // 已安装
  | "active" // 已激活
  | "inactive" // 已停用
  | "uninstalled"; // 已卸载

/**
 * 配置验证函数类型
 */
export type ConfigValidator = (
  config: Record<string, unknown>,
) => boolean;

/**
 * 请求上下文类型
 * 用于 onRequest 和 onResponse 钩子
 */
export interface RequestContext {
  /** 原始请求对象 */
  request: Request;
  /** 响应对象（在 onResponse 中可用） */
  response?: Response;
  /** 请求路径 */
  path: string;
  /** 请求方法 */
  method: string;
  /** 解析后的 URL 对象 */
  url: URL;
  /** 请求头 */
  headers: Headers;
  /** 路由参数（如 /user/:id 中的 id） */
  params?: Record<string, string>;
  /** 查询参数 */
  query?: Record<string, string>;
  /** 请求体（已解析） */
  body?: unknown;
  /** 扩展属性 */
  [key: string]: unknown;
}

/**
 * 构建选项类型
 */
export interface BuildOptions {
  /** 构建模式 */
  mode: "dev" | "prod";
  /** 构建目标 */
  target?: "client" | "server";
  /** 入口文件 */
  entryPoints?: string[];
  /** 输出目录 */
  outDir?: string;
  /** 是否压缩 */
  minify?: boolean;
  /** 是否生成 sourcemap */
  sourcemap?: boolean;
  /** 扩展属性 */
  [key: string]: unknown;
}

/**
 * 构建结果类型
 */
export interface BuildResult {
  /** 输出文件列表 */
  outputFiles?: string[];
  /** 构建错误 */
  errors?: unknown[];
  /** 构建警告 */
  warnings?: unknown[];
  /** 构建耗时（毫秒） */
  duration?: number;
  /** 扩展属性 */
  [key: string]: unknown;
}

/**
 * 路由定义类型
 */
export interface RouteDefinition {
  /** 路由路径 */
  path: string;
  /** 请求方法 */
  method:
    | "GET"
    | "POST"
    | "PUT"
    | "DELETE"
    | "PATCH"
    | "HEAD"
    | "OPTIONS"
    | "*";
  /** 路由处理函数 */
  handler: (ctx: RequestContext) => Promise<Response> | Response;
  /** 路由中间件 */
  middlewares?:
    ((ctx: RequestContext, next: () => Promise<void>) => Promise<void>)[];
  /** 路由元数据 */
  meta?: Record<string, unknown>;
}

/**
 * 健康检查状态类型
 */
export interface HealthStatus {
  /** 整体状态 */
  status: "healthy" | "unhealthy" | "degraded";
  /** 检查详情 */
  checks?: Record<string, {
    status: "pass" | "fail" | "warn";
    message?: string;
    duration?: number;
  }>;
  /** 检查时间戳 */
  timestamp?: number;
}

/**
 * Socket 类型枚举
 *
 * 用于区分 WebSocket 和 Socket.IO 连接
 */
export type SocketType = "websocket" | "socketio";

/**
 * Socket.IO Socket 接口
 *
 * Socket.IO 连接的操作接口
 */
export interface SocketIOSocket {
  /** Socket ID */
  id: string;
  /** 是否已连接 */
  connected: boolean;
  /** 当前加入的房间 */
  rooms: Set<string>;
  /** 命名空间 */
  nsp: { name: string };
  /** 握手信息 */
  handshake?: {
    url?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    auth?: Record<string, unknown>;
  };

  /**
   * 发送事件
   *
   * @param event - 事件名称
   * @param args - 参数
   */
  emit(event: string, ...args: unknown[]): boolean;

  /**
   * 监听事件
   *
   * @param event - 事件名称
   * @param listener - 事件处理函数
   */
  on(event: string, listener: (...args: unknown[]) => void): this;

  /**
   * 单次监听
   *
   * @param event - 事件名称
   * @param listener - 事件处理函数
   */
  once(event: string, listener: (...args: unknown[]) => void): this;

  /**
   * 移除监听
   *
   * @param event - 事件名称
   * @param listener - 事件处理函数（可选）
   */
  off(event: string, listener?: (...args: unknown[]) => void): this;

  /**
   * 加入房间
   *
   * @param room - 房间名称
   */
  join(room: string | string[]): void;

  /**
   * 离开房间
   *
   * @param room - 房间名称
   */
  leave(room: string): void;

  /**
   * 向房间发送消息
   *
   * @param room - 房间名称
   */
  to(room: string): { emit(event: string, ...args: unknown[]): boolean };

  /**
   * 向所有人广播（不包括自己）
   */
  broadcast: { emit(event: string, ...args: unknown[]): boolean };

  /**
   * 断开连接
   *
   * @param close - 是否关闭底层连接
   */
  disconnect(close?: boolean): this;
}

/**
 * WebSocket 上下文类型
 *
 * 原生 WebSocket 连接上下文
 */
export interface WebSocketContext {
  /**
   * Socket 类型标识
   */
  type: "websocket";

  /**
   * 连接 ID（自动生成的 UUID）
   */
  connectionId: string;

  /**
   * 原生 WebSocket 实例
   */
  socket: WebSocket;

  /**
   * 握手请求
   */
  request: Request;

  /**
   * 用户信息（如果已认证）
   */
  user?: unknown;

  /**
   * 扩展属性
   */
  [key: string]: unknown;
}

/**
 * Socket.IO 上下文类型
 *
 * Socket.IO 连接上下文
 */
export interface SocketIOContext {
  /**
   * Socket 类型标识
   */
  type: "socketio";

  /**
   * 连接 ID（即 socket.id）
   */
  connectionId: string;

  /**
   * Socket.IO Socket 实例
   */
  socket: SocketIOSocket;

  /**
   * 命名空间
   */
  namespace: string;

  /**
   * 当前加入的房间列表
   */
  rooms: Set<string>;

  /**
   * 握手信息
   */
  handshake?: {
    url?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    auth?: Record<string, unknown>;
  };

  /**
   * 用户信息（如果已认证）
   */
  user?: unknown;

  /**
   * 扩展属性
   */
  [key: string]: unknown;
}

/**
 * Socket 上下文联合类型
 *
 * 可以是 WebSocket 或 Socket.IO 连接
 */
export type SocketContext = WebSocketContext | SocketIOContext;

/**
 * 定时任务上下文类型
 */
export interface ScheduleContext {
  /** 任务名称 */
  taskName: string;
  /** cron 表达式或间隔 */
  schedule: string;
  /** 上次执行时间 */
  lastRun?: Date;
  /** 下次执行时间 */
  nextRun?: Date;
  /** 扩展属性 */
  [key: string]: unknown;
}

/**
 * 应用级别的事件钩子类型
 *
 * 插件可以实现这些钩子来响应应用的各种事件，
 * PluginManager 会在适当的时机调用所有已激活插件的对应钩子。
 */
export interface AppEventHooks {
  // ==================== 生命周期事件 ====================

  /** 应用初始化完成时调用（在所有插件安装和激活之后） */
  onInit?: (container: ServiceContainer) => Promise<void> | void;

  /** 应用启动时调用（服务器开始监听） */
  onStart?: (container: ServiceContainer) => Promise<void> | void;

  /** 应用停止时调用（优雅停止，可以做清理工作） */
  onStop?: (container: ServiceContainer) => Promise<void> | void;

  /** 应用关闭时调用（最终清理，释放所有资源） */
  onShutdown?: (container: ServiceContainer) => Promise<void> | void;

  // ==================== HTTP 请求事件 ====================

  /**
   * 请求处理前调用
   * 可以修改请求上下文，或返回 Response 直接响应（跳过后续处理）
   */
  onRequest?: (
    ctx: RequestContext,
    container: ServiceContainer,
  ) => Promise<Response | void> | Response | void;

  /**
   * 请求处理完成后调用
   * 可以修改响应，或记录日志等
   */
  onResponse?: (
    ctx: RequestContext,
    container: ServiceContainer,
  ) => Promise<void> | void;

  // ==================== 错误处理事件 ====================

  /**
   * 错误发生时调用
   * 可以记录错误、发送告警、或返回自定义错误响应
   */
  onError?: (
    error: Error,
    ctx: RequestContext | undefined,
    container: ServiceContainer,
  ) => Promise<Response | void> | Response | void;

  // ==================== 路由事件 ====================

  /**
   * 路由注册时调用
   * 插件可以动态添加、修改或删除路由
   * 返回修改后的路由列表
   */
  onRoute?: (
    routes: RouteDefinition[],
    container: ServiceContainer,
  ) => Promise<RouteDefinition[]> | RouteDefinition[];

  // ==================== 构建事件 ====================

  /** 构建开始前调用 */
  onBuild?: (
    options: BuildOptions,
    container: ServiceContainer,
  ) => Promise<void> | void;

  /** 构建完成后调用 */
  onBuildComplete?: (
    result: BuildResult,
    container: ServiceContainer,
  ) => Promise<void> | void;

  // ==================== Socket 事件（兼容 WebSocket 和 Socket.IO） ====================

  /**
   * Socket 连接建立时调用
   * 同时支持 WebSocket 和 Socket.IO 连接
   * 可以进行认证、记录连接等
   *
   * @param ctx - Socket 上下文，包含统一的 socket 接口
   * @param container - 服务容器
   */
  onSocket?: (
    ctx: SocketContext,
    container: ServiceContainer,
  ) => Promise<void> | void;

  /**
   * Socket 连接关闭时调用
   * 同时支持 WebSocket 和 Socket.IO 连接
   *
   * @param ctx - Socket 上下文
   * @param container - 服务容器
   */
  onSocketClose?: (
    ctx: SocketContext,
    container: ServiceContainer,
  ) => Promise<void> | void;

  // ==================== 定时任务事件 ====================

  /**
   * 定时任务触发时调用
   */
  onSchedule?: (
    ctx: ScheduleContext,
    container: ServiceContainer,
  ) => Promise<void> | void;

  // ==================== 健康检查事件 ====================

  /**
   * 健康检查时调用
   * 返回插件的健康状态
   */
  onHealthCheck?: (
    container: ServiceContainer,
  ) => Promise<HealthStatus> | HealthStatus;

  // ==================== 开发环境事件 ====================

  /**
   * 热重载完成时调用（仅开发环境）
   * 可以清除缓存、重新初始化等
   */
  onHotReload?: (
    changedFiles: string[],
    container: ServiceContainer,
  ) => Promise<void> | void;
}

/**
 * 插件接口
 *
 * 定义插件的基本结构和事件钩子
 *
 * 设计理念：
 * - Manager 负责管理生命周期（注册→安装→激活→停用→卸载）
 * - 插件只需响应应用级别事件（onInit、onRequest、onResponse 等）
 * - 插件不需要写生命周期钩子（install、activate、deactivate、uninstall）
 */
export interface Plugin extends AppEventHooks {
  /** 插件名称（唯一标识） */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件依赖列表（可选，用于确保激活顺序） */
  dependencies?: string[];
  /** 插件配置（可选） */
  config?: Record<string, unknown>;
  /** 配置验证函数（可选） */
  validateConfig?: ConfigValidator;
  /** 配置更新钩子（可选，配置热更新时调用） */
  onConfigUpdate?: (newConfig: Record<string, unknown>) => Promise<void> | void;
}

/**
 * 插件注册选项
 */
export interface RegisterOptions {
  /**
   * 是否替换已存在的同名插件（默认：false）
   *
   * - false: 如果插件已存在则抛出错误（安全，推荐）
   * - true: 替换已存在的插件（用于热重载等场景）
   */
  replace?: boolean;
}

/**
 * 插件管理器选项
 */
export interface PluginManagerOptions {
  /** 是否自动激活已安装的插件（默认：false） */
  autoActivate?: boolean;
  /** 是否在插件错误时继续执行（默认：true） */
  continueOnError?: boolean;
  /** 是否启用热加载（开发环境，默认：false） */
  enableHotReload?: boolean;
  /** 热加载监听间隔（毫秒，默认：1000） */
  hotReloadInterval?: number;
  /** 资源限制（可选） */
  resourceLimits?: ResourceLimits;
}

/**
 * 资源限制配置
 */
export interface ResourceLimits {
  /** 内存限制（MB，可选） */
  maxMemory?: number;
  /** CPU 限制（百分比，可选） */
  maxCpu?: number;
  /** 超时限制（毫秒，可选） */
  timeout?: number;
}

/**
 * 插件调试信息
 */
export interface PluginDebugInfo {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 当前状态 */
  state: PluginState;
  /** 依赖列表 */
  dependencies: string[];
  /** 注册的服务 */
  services: string[];
  /** 配置 */
  config?: Record<string, unknown>;
  /** 错误信息（如果有） */
  error?: Error;
}
