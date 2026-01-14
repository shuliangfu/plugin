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
 * 应用级别的事件钩子类型
 */
export interface AppEventHooks {
  /** 应用初始化完成时调用（在所有插件安装和激活之后） */
  onInit?: (container: ServiceContainer) => Promise<void> | void;
  /** 请求处理前调用（可以访问 req, res） */
  onRequest?: (
    ctx: {
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
    },
    container: ServiceContainer,
  ) => Promise<void> | void;
  /** 请求处理完成后调用（可以访问 req, res） */
  onResponse?: (
    ctx: {
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
    },
    container: ServiceContainer,
  ) => Promise<void> | void;
  /** 构建开始前调用 */
  onBuild?: (
    options: {
      mode: "dev" | "prod";
      target?: "client" | "server";
    },
    container: ServiceContainer,
  ) => Promise<void> | void;
  /** 构建完成后调用 */
  onBuildComplete?: (
    result: {
      outputFiles?: string[];
      errors?: unknown[];
      warnings?: unknown[];
    },
    container: ServiceContainer,
  ) => Promise<void> | void;
  /** 应用启动时调用 */
  onStart?: (container: ServiceContainer) => Promise<void> | void;
  /** 应用停止时调用 */
  onStop?: (container: ServiceContainer) => Promise<void> | void;
  /** 应用关闭时调用 */
  onShutdown?: (container: ServiceContainer) => Promise<void> | void;
}

/**
 * 插件接口
 *
 * 定义插件的基本结构和生命周期钩子
 */
export interface Plugin extends AppEventHooks {
  /** 插件名称（唯一标识） */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件依赖列表（可选） */
  dependencies?: string[];
  /** 插件配置（可选） */
  config?: Record<string, unknown>;
  /** 配置验证函数（可选） */
  validateConfig?: ConfigValidator;
  /** 配置更新钩子（可选，配置热更新时调用） */
  onConfigUpdate?: (newConfig: Record<string, unknown>) => Promise<void> | void;
  /** 安装钩子（可选） */
  install?: (container: ServiceContainer) => Promise<void> | void;
  /** 激活钩子（可选） */
  activate?: (container: ServiceContainer) => Promise<void> | void;
  /** 停用钩子（可选） */
  deactivate?: () => Promise<void> | void;
  /** 卸载钩子（可选） */
  uninstall?: () => Promise<void> | void;
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
