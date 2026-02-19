/**
 * 插件管理器
 *
 * 提供插件注册、生命周期管理、依赖解析等功能
 */

import { join, readdir, stat } from "@dreamer/runtime-adapter";
import type { ServiceContainer } from "@dreamer/service";

import { $tr } from "./i18n.ts";
import {
  detectCircularDependency,
  detectMissingDependencies,
  topologicalSort,
} from "./dependency-resolver.ts";
import { EventEmitter } from "./event-emitter.ts";
import { HotReloadManager } from "./hot-reload.ts";
import { loadPluginFromFile } from "./loader.ts";
import type {
  BuildOptions,
  BuildResult,
  HealthStatus,
  Plugin,
  PluginDebugInfo,
  PluginManagerOptions,
  PluginState,
  RegisterOptions,
  RequestContext,
  ResourceLimits,
  RouteDefinition,
  SocketContext,
} from "./types.ts";

/**
 * 插件管理器类
 *
 * 管理插件的注册、安装、激活、停用和卸载
 */
export class PluginManager {
  /** 服务容器（用于注册插件提供的服务） */
  private container: ServiceContainer;

  /** 插件映射表 */
  private plugins: Map<string, Plugin> = new Map();

  /** 插件状态映射表 */
  private pluginStates: Map<string, PluginState> = new Map();

  /** 插件注册的服务映射表（记录每个插件注册了哪些服务） */
  private pluginServices: Map<string, Set<string>> = new Map();

  /** 插件配置映射表（运行时配置，可以覆盖插件初始配置） */
  private pluginConfigs: Map<string, Record<string, unknown>> = new Map();

  /** 插件错误映射表（记录每个插件的错误） */
  private pluginErrors: Map<string, Error> = new Map();

  /** 事件发射器 */
  private eventEmitter: EventEmitter = new EventEmitter();

  /** 热加载管理器 */
  private hotReloadManager: HotReloadManager | null = null;

  /** 配置选项 */
  private options: Required<Omit<PluginManagerOptions, "resourceLimits">> & {
    resourceLimits?: ResourceLimits;
  };

  /**
   * 创建插件管理器实例
   *
   * @param container 服务容器实例
   * @param options 配置选项
   */
  constructor(
    container: ServiceContainer,
    options: PluginManagerOptions = {},
  ) {
    this.container = container;
    this.options = {
      autoActivate: options.autoActivate ?? false,
      continueOnError: options.continueOnError ?? true,
      enableHotReload: options.enableHotReload ?? false,
      hotReloadInterval: options.hotReloadInterval ?? 1000,
      resourceLimits: options.resourceLimits,
    };

    // 如果启用了热加载，创建热加载管理器
    if (this.options.enableHotReload) {
      this.hotReloadManager = new HotReloadManager({
        interval: this.options.hotReloadInterval,
        onFileChange: async (path) => {
          await this.reloadPluginFromFile(path);
        },
      });
    }
  }

  /**
   * 注册插件
   *
   * @param plugin 插件对象
   * @param options 注册选项
   * @param options.replace 是否替换已存在的同名插件（默认：false）
   * @throws 如果插件名称已存在且 replace 为 false，抛出错误
   *
   * @example
   * ```typescript
   * // 默认：如果已存在则抛出错误
   * manager.register(myPlugin);
   *
   * // 替换已存在的插件（用于热重载）
   * manager.register(myPlugin, { replace: true });
   * ```
   */
  register(plugin: Plugin, options: RegisterOptions = {}): void {
    const { replace = false } = options;

    if (this.plugins.has(plugin.name)) {
      if (!replace) {
        throw new Error(
          $tr("errors.pluginAlreadyRegistered", { name: plugin.name }),
        );
      }
      // 替换模式：先清理旧插件的状态
      this.pluginStates.delete(plugin.name);
      this.pluginServices.delete(plugin.name);
      this.pluginConfigs.delete(plugin.name);
      this.pluginErrors.delete(plugin.name);
      // 触发替换事件
      this.eventEmitter.emit("plugin:replaced", plugin.name, plugin);
    }

    this.plugins.set(plugin.name, plugin);
    this.pluginStates.set(plugin.name, "registered");

    // 触发注册事件
    this.eventEmitter.emit("plugin:registered", plugin.name, plugin);
  }

  /**
   * 添加并激活插件（便捷方法）
   *
   * 自动完成注册、安装、激活流程
   *
   * @param plugin 插件对象
   *
   * @example
   * ```typescript
   * await pluginManager.use(loggerPlugin);
   * await pluginManager.use(authPlugin);
   * ```
   */
  async use(plugin: Plugin): Promise<void> {
    // 如果插件已注册，跳过注册
    if (!this.plugins.has(plugin.name)) {
      this.register(plugin);
    }

    // 安装（会自动处理依赖）
    const state = this.pluginStates.get(plugin.name);
    if (state === "registered") {
      await this.install(plugin.name);
    }

    // 激活
    const newState = this.pluginStates.get(plugin.name);
    if (newState === "installed" || newState === "inactive") {
      await this.activate(plugin.name);
    }
  }

  /**
   * 批量添加并启动所有插件（便捷方法）
   *
   * 按依赖顺序安装和激活所有已注册但未激活的插件，
   * 然后触发 onInit 事件
   *
   * @example
   * ```typescript
   * pluginManager.register(loggerPlugin);
   * pluginManager.register(authPlugin);
   * await pluginManager.bootstrap();
   * ```
   */
  async bootstrap(): Promise<void> {
    // 获取所有已注册的插件
    const plugins = this.getRegisteredPlugins();

    // 按依赖顺序安装
    for (const name of plugins) {
      const state = this.pluginStates.get(name);
      if (state === "registered") {
        await this.install(name);
      }
    }

    // 按依赖顺序激活
    for (const name of plugins) {
      const state = this.pluginStates.get(name);
      if (state === "installed") {
        await this.activate(name);
      }
    }

    // 触发初始化事件
    await this.triggerInit();
  }

  /**
   * 优雅关闭所有插件（便捷方法）
   *
   * 触发 onStop 和 onShutdown，然后停用和卸载所有插件
   *
   * @example
   * ```typescript
   * await pluginManager.shutdown();
   * ```
   */
  async shutdown(): Promise<void> {
    // 触发停止事件
    await this.triggerStop();

    // 触发关闭事件
    await this.triggerShutdown();

    // 获取所有已激活的插件（逆序）
    const activePlugins = this.getActivePlugins().reverse();

    // 停用所有插件
    for (const plugin of activePlugins) {
      try {
        await this.deactivate(plugin.name);
      } catch {
        // 忽略停用错误
      }
    }

    // 卸载所有插件
    for (const name of this.getRegisteredPlugins()) {
      const state = this.pluginStates.get(name);
      if (state !== "uninstalled" && state !== "registered") {
        try {
          await this.uninstall(name);
        } catch {
          // 忽略卸载错误
        }
      }
    }
  }

  /**
   * 获取插件
   *
   * @param name 插件名称
   * @returns 插件对象，如果不存在则返回 undefined
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 获取插件状态
   *
   * @param name 插件名称
   * @returns 插件状态，如果不存在则返回 undefined
   */
  getState(name: string): PluginState | undefined {
    return this.pluginStates.get(name);
  }

  /**
   * 获取所有已注册的插件名称
   *
   * @returns 插件名称数组
   */
  getRegisteredPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * 安装插件
   *
   * 会解析插件依赖，按依赖顺序安装插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在、存在循环依赖或缺失依赖，抛出错误
   */
  async install(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error($tr("errors.pluginNotRegistered", { name }));
    }

    const currentState = this.pluginStates.get(name);
    if (currentState !== "registered") {
      throw new Error(
        $tr("errors.pluginWrongStateInstall", {
          name,
          state: currentState ?? "undefined",
        }),
      );
    }

    try {
      // 解析依赖并获取安装顺序
      const installOrder = this.resolveInstallOrder(name);

      // 按顺序安装依赖插件
      for (const depName of installOrder) {
        if (depName === name) {
          continue; // 跳过自己
        }
        const depState = this.pluginStates.get(depName);
        if (depState === "registered") {
          await this.installPlugin(depName);
        }
      }

      // 安装当前插件
      await this.installPlugin(name);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.pluginErrors.set(name, err);
      this.eventEmitter.emit("plugin:error", name, err);
      if (!this.options.continueOnError) {
        throw error;
      }
    }
  }

  /**
   * 安装单个插件（内部方法）
   *
   * @param name 插件名称
   */
  private async installPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)!;

    // 更新状态
    this.pluginStates.set(name, "installed");

    // 初始化插件服务集合（用于调试信息）
    this.pluginServices.set(name, new Set<string>());

    // 触发安装事件
    this.eventEmitter.emit("plugin:installed", name, plugin);

    // 如果启用了自动激活，则自动激活插件
    if (this.options.autoActivate) {
      await this.activate(name);
    }
  }

  /**
   * 激活插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在或未安装，抛出错误
   */
  activate(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error($tr("errors.pluginNotRegistered", { name }));
    }

    const currentState = this.pluginStates.get(name);
    if (currentState !== "installed" && currentState !== "inactive") {
      throw new Error(
        $tr("errors.pluginWrongStateActivate", {
          name,
          state: currentState ?? "undefined",
        }),
      );
    }

    // 检查依赖插件是否已激活
    if (plugin.dependencies) {
      for (const depName of plugin.dependencies) {
        const depState = this.pluginStates.get(depName);
        if (!depState || depState !== "active") {
          const stateStr = depState || "undefined";
          throw new Error(
            $tr("errors.pluginDependencyNotActive", {
              name,
              dep: depName,
              state: stateStr,
            }),
          );
        }
      }
    }

    // 更新状态
    this.pluginStates.set(name, "active");

    // 触发激活事件
    this.eventEmitter.emit("plugin:activated", name, plugin);
    // 清除之前的错误
    this.pluginErrors.delete(name);
  }

  /**
   * 停用插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在或未激活，抛出错误
   */
  deactivate(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error($tr("errors.pluginNotRegistered", { name }));
    }

    const currentState = this.pluginStates.get(name);
    if (currentState !== "active") {
      throw new Error(
        $tr("errors.pluginWrongStateDeactivate", {
          name,
          state: currentState ?? "undefined",
        }),
      );
    }

    // 更新状态
    this.pluginStates.set(name, "inactive");

    // 触发停用事件
    this.eventEmitter.emit("plugin:deactivated", name, plugin);
    // 清除之前的错误
    this.pluginErrors.delete(name);
  }

  /**
   * 卸载插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在，抛出错误
   */
  async uninstall(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error($tr("errors.pluginNotRegistered", { name }));
    }

    const currentState = this.pluginStates.get(name);
    if (currentState === "uninstalled") {
      return; // 已经卸载，无需重复操作
    }

    // 如果插件已激活，先停用
    if (currentState === "active") {
      await this.deactivate(name);
    }

    // 清理插件服务记录
    this.pluginServices.delete(name);

    // 更新状态
    this.pluginStates.set(name, "uninstalled");

    // 触发卸载事件
    this.eventEmitter.emit("plugin:uninstalled", name, plugin);
    // 清除错误和配置
    this.pluginErrors.delete(name);
    this.pluginConfigs.delete(name);
  }

  /**
   * 从文件加载插件
   *
   * @param path 插件文件路径
   * @throws 如果文件不存在或加载失败，抛出错误
   */
  async loadFromFile(path: string): Promise<void> {
    const plugin = await loadPluginFromFile(path);
    this.register(plugin);

    // 如果启用了热加载，监听文件变化
    if (this.hotReloadManager) {
      await this.hotReloadManager.watchFile(path, async (filePath) => {
        await this.reloadPluginFromFile(filePath);
      });
    }
  }

  /**
   * 从文件重新加载插件（热加载）
   *
   * @param path 插件文件路径
   */
  private async reloadPluginFromFile(path: string): Promise<void> {
    try {
      const plugin = await loadPluginFromFile(path);
      const existingPlugin = this.plugins.get(plugin.name);

      if (existingPlugin) {
        const currentState = this.pluginStates.get(plugin.name);

        // 如果插件已激活，先停用
        if (currentState === "active") {
          await this.deactivate(plugin.name);
        }

        // 如果插件已安装，先卸载
        if (currentState === "installed" || currentState === "inactive") {
          await this.uninstall(plugin.name);
        }

        // 重新注册插件
        this.plugins.set(plugin.name, plugin);
        this.pluginStates.set(plugin.name, "registered");

        // 触发重新加载事件
        this.eventEmitter.emit("plugin:reloaded", plugin.name, plugin);
      } else {
        // 新插件，直接注册
        this.register(plugin);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.eventEmitter.emit("plugin:error", path, err);
      console.error($tr("log.hotReloadFailed", { path }), error);
    }
  }

  /**
   * 从目录加载所有插件
   *
   * @param directory 插件目录路径
   * @throws 如果目录不存在或加载失败，抛出错误
   */
  async loadFromDirectory(directory: string): Promise<void> {
    try {
      const entries = await readdir(directory);
      const pluginFiles: string[] = [];

      // 收集所有可能的插件文件
      for (const entry of entries) {
        const filePath = join(directory, entry.name);
        const fileStat = await stat(filePath);
        if (
          fileStat.isFile &&
          (filePath.endsWith(".ts") || filePath.endsWith(".js"))
        ) {
          pluginFiles.push(filePath);
        }
      }

      // 加载所有插件文件
      for (const filePath of pluginFiles) {
        try {
          await this.loadFromFile(filePath);
        } catch (error) {
          console.error(
            $tr("log.loadPluginFileFailed", { path: filePath }),
            error,
          );
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    } catch (error) {
      throw new Error(
        $tr("errors.loadDirectoryFailed", {
          directory,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /**
   * 解析插件的安装顺序（包括依赖）
   *
   * @param name 插件名称
   * @returns 安装顺序（包括依赖）
   */
  private resolveInstallOrder(name: string): string[] {
    // 收集所有相关插件（包括依赖）
    const relatedPlugins = new Set<string>([name]);
    const queue = [name];

    while (queue.length > 0) {
      const currentName = queue.shift()!;
      const plugin = this.plugins.get(currentName);
      if (plugin && plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!relatedPlugins.has(dep)) {
            relatedPlugins.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    // 使用拓扑排序计算安装顺序
    return topologicalSort(this.plugins, Array.from(relatedPlugins));
  }

  /**
   * 注册事件监听器
   *
   * @param event 事件名称
   * @param listener 监听器函数
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * 移除事件监听器
   *
   * @param event 事件名称
   * @param listener 监听器函数
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * 触发事件
   *
   * @param event 事件名称
   * @param args 事件参数
   */
  emit(event: string, ...args: unknown[]): void {
    this.eventEmitter.emit(event, ...args);
  }

  /**
   * 验证插件依赖
   *
   * @param name 插件名称（可选，如果不提供则验证所有插件）
   * @throws 如果存在循环依赖或缺失依赖，抛出错误
   */
  validateDependencies(name?: string): void {
    if (name) {
      const plugin = this.plugins.get(name);
      if (!plugin) {
        throw new Error($tr("errors.pluginNotRegistered", { name }));
      }

      // 收集相关插件
      const relatedPlugins = new Map<string, Plugin>();
      const queue = [name];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const currentName = queue.shift()!;
        if (visited.has(currentName)) {
          continue;
        }
        visited.add(currentName);

        const currentPlugin = this.plugins.get(currentName);
        if (currentPlugin) {
          relatedPlugins.set(currentName, currentPlugin);
          if (currentPlugin.dependencies) {
            for (const dep of currentPlugin.dependencies) {
              if (this.plugins.has(dep) && !visited.has(dep)) {
                queue.push(dep);
              }
            }
          }
        }
      }

      const cycle = detectCircularDependency(relatedPlugins);
      if (cycle) {
        throw new Error(
          $tr("errors.circularDependencySingle", {
            name,
            cycle: cycle.join(" -> "),
            first: cycle[0],
          }),
        );
      }

      const missing = detectMissingDependencies(relatedPlugins);
      if (Object.keys(missing).length > 0) {
        const missingList = Object.entries(missing)
          .map(([pName, deps]) => `${pName}: [${deps.join(", ")}]`)
          .join("; ");
        throw new Error(
          $tr("errors.missingDependencySingle", { name, list: missingList }),
        );
      }
    } else {
      const cycle = detectCircularDependency(this.plugins);
      if (cycle) {
        throw new Error(
          $tr("errors.circularDependencyAll", {
            cycle: cycle.join(" -> "),
            first: cycle[0],
          }),
        );
      }

      const missing = detectMissingDependencies(this.plugins);
      if (Object.keys(missing).length > 0) {
        const missingList = Object.entries(missing)
          .map(([pName, deps]) => `${pName}: [${deps.join(", ")}]`)
          .join("; ");
        throw new Error(
          $tr("errors.missingDependencyAll", { list: missingList }),
        );
      }
    }
  }

  /**
   * 获取插件配置
   *
   * @param name 插件名称
   * @returns 插件配置，如果不存在则返回 undefined
   */
  getConfig(name: string): Record<string, unknown> | undefined {
    // 优先返回运行时配置，否则返回插件初始配置
    if (this.pluginConfigs.has(name)) {
      return this.pluginConfigs.get(name);
    }
    const plugin = this.plugins.get(name);
    return plugin?.config;
  }

  /**
   * 设置插件配置
   *
   * @param name 插件名称
   * @param config 配置对象
   * @throws 如果插件不存在或配置验证失败，抛出错误
   */
  setConfig(name: string, config: Record<string, unknown>): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error($tr("errors.pluginNotRegistered", { name }));
    }

    if (plugin.validateConfig) {
      if (!plugin.validateConfig(config)) {
        throw new Error($tr("errors.pluginConfigValidationFailed", { name }));
      }
    }

    // 保存配置
    this.pluginConfigs.set(name, config);

    // 触发配置更新事件
    this.eventEmitter.emit("plugin:config:updated", name, config);

    // 如果插件有配置更新钩子，调用它
    if (plugin.onConfigUpdate) {
      Promise.resolve(plugin.onConfigUpdate(config)).catch((error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        this.pluginErrors.set(name, err);
        this.eventEmitter.emit("plugin:error", name, err);
      });
    }
  }

  /**
   * 更新插件配置（合并现有配置）
   *
   * @param name 插件名称
   * @param partialConfig 部分配置对象
   * @throws 如果插件不存在或配置验证失败，抛出错误
   */
  updateConfig(
    name: string,
    partialConfig: Record<string, unknown>,
  ): void {
    const currentConfig = this.getConfig(name) || {};
    const newConfig = { ...currentConfig, ...partialConfig };
    this.setConfig(name, newConfig);
  }

  /**
   * 获取插件调试信息
   *
   * @param name 插件名称（可选，如果不提供则返回所有插件的信息）
   * @returns 插件调试信息
   */
  getDebugInfo(name?: string): PluginDebugInfo | PluginDebugInfo[] {
    if (name) {
      const plugin = this.plugins.get(name);
      if (!plugin) {
        throw new Error($tr("errors.pluginNotFound", { name }));
      }

      return {
        name: plugin.name,
        version: plugin.version,
        state: this.pluginStates.get(name) || "registered",
        dependencies: plugin.dependencies || [],
        services: Array.from(this.pluginServices.get(name) || []),
        config: this.getConfig(name),
        error: this.pluginErrors.get(name),
      };
    } else {
      // 返回所有插件的调试信息
      return Array.from(this.plugins.keys()).map((pluginName) =>
        this.getDebugInfo(pluginName) as PluginDebugInfo
      );
    }
  }

  /**
   * 获取插件依赖关系图
   *
   * @returns 依赖关系图，格式为 { pluginName: [dependencies] }
   */
  getDependencyGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    for (const [name, plugin] of this.plugins.entries()) {
      graph[name] = plugin.dependencies || [];
    }
    return graph;
  }

  /**
   * 停止热加载
   */
  stopHotReload(): void {
    if (this.hotReloadManager) {
      this.hotReloadManager.stopAll();
      this.hotReloadManager = null;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 停止热加载
    this.stopHotReload();

    // 清理所有数据
    this.plugins.clear();
    this.pluginStates.clear();
    this.pluginServices.clear();
    this.pluginConfigs.clear();
    this.pluginErrors.clear();
    this.eventEmitter.removeAllListeners();
  }

  // ==================== 应用级别事件钩子触发方法 ====================

  /**
   * 获取所有已激活的插件
   *
   * @returns 已激活的插件数组
   */
  private getActivePlugins(): Plugin[] {
    const activePlugins: Plugin[] = [];
    for (const [name, state] of this.pluginStates.entries()) {
      if (state === "active") {
        const plugin = this.plugins.get(name);
        if (plugin) {
          activePlugins.push(plugin);
        }
      }
    }
    return activePlugins;
  }

  /**
   * 触发 onInit 钩子
   * 应在所有插件安装和激活完成后调用
   *
   * @example
   * ```typescript
   * // 安装并激活所有插件后
   * await pluginManager.triggerInit();
   * ```
   */
  async triggerInit(): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onInit) {
        try {
          await plugin.onInit(this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    // 触发内部事件
    this.eventEmitter.emit("app:init");
  }

  /**
   * 触发 onStart 钩子
   * 应在应用服务器开始监听时调用
   *
   * @example
   * ```typescript
   * server.listen(3000, async () => {
   *   await pluginManager.triggerStart();
   * });
   * ```
   */
  async triggerStart(): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onStart) {
        try {
          await plugin.onStart(this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:start");
  }

  /**
   * 触发 onStop 钩子
   * 应在应用优雅停止时调用
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await pluginManager.triggerStop();
   *   server.close();
   * });
   * ```
   */
  async triggerStop(): Promise<void> {
    const activePlugins = this.getActivePlugins();
    // 逆序执行，后启动的先停止
    for (const plugin of activePlugins.reverse()) {
      if (plugin.onStop) {
        try {
          await plugin.onStop(this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:stop");
  }

  /**
   * 触发 onShutdown 钩子
   * 应在应用完全关闭前调用（最终清理）
   *
   * @example
   * ```typescript
   * process.on('exit', async () => {
   *   await pluginManager.triggerShutdown();
   * });
   * ```
   */
  async triggerShutdown(): Promise<void> {
    const activePlugins = this.getActivePlugins();
    // 逆序执行
    for (const plugin of activePlugins.reverse()) {
      if (plugin.onShutdown) {
        try {
          await plugin.onShutdown(this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          // shutdown 时不抛出错误，确保所有插件都有机会清理
        }
      }
    }
    this.eventEmitter.emit("app:shutdown");
  }

  /**
   * 触发 onRequest 钩子
   * 应在每个 HTTP 请求处理前调用
   *
   * @param ctx 请求上下文
   * @returns 如果某个插件返回了 Response，则返回该 Response；否则返回 undefined
   *
   * @example
   * ```typescript
   * server.use(async (req, res, next) => {
   *   const ctx = { request: req, path: req.url, method: req.method, ... };
   *   const response = await pluginManager.triggerRequest(ctx);
   *   if (response) {
   *     return response; // 插件已处理请求
   *   }
   *   next();
   * });
   * ```
   */
  async triggerRequest(ctx: RequestContext): Promise<Response | undefined> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onRequest) {
        try {
          const result = await plugin.onRequest(ctx, this.container);
          // 如果插件返回了 Response，直接返回（跳过后续处理）
          if (result instanceof Response) {
            return result;
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:request", ctx);
    return undefined;
  }

  /**
   * 触发 onResponse 钩子
   * 应在每个 HTTP 请求处理完成后调用
   *
   * @param ctx 请求上下文（包含响应）
   *
   * @example
   * ```typescript
   * const response = await handler(request);
   * ctx.response = response;
   * await pluginManager.triggerResponse(ctx);
   * return ctx.response;
   * ```
   */
  async triggerResponse(ctx: RequestContext): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onResponse) {
        try {
          await plugin.onResponse(ctx, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:response", ctx);
  }

  /**
   * 触发 onError 钩子
   * 应在发生错误时调用
   *
   * @param error 错误对象
   * @param ctx 请求上下文（可选，如果是请求相关的错误）
   * @returns 如果某个插件返回了 Response，则返回该 Response；否则返回 undefined
   *
   * @example
   * ```typescript
   * try {
   *   await handler(request);
   * } catch (error) {
   *   const response = await pluginManager.triggerError(error, ctx);
   *   if (response) return response;
   *   // 默认错误处理
   * }
   * ```
   */
  async triggerError(
    error: Error,
    ctx?: RequestContext,
  ): Promise<Response | undefined> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onError) {
        try {
          const result = await plugin.onError(error, ctx, this.container);
          if (result instanceof Response) {
            return result;
          }
        } catch (hookError) {
          // 错误钩子本身出错，记录但不抛出
          const err = hookError instanceof Error
            ? hookError
            : new Error(String(hookError));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
        }
      }
    }
    this.eventEmitter.emit("app:error", error, ctx);
    return undefined;
  }

  /**
   * 触发 onRoute 钩子
   * 应在路由注册时调用，允许插件动态修改路由
   *
   * @param routes 初始路由列表
   * @returns 修改后的路由列表
   *
   * @example
   * ```typescript
   * let routes = [
   *   { path: '/api/users', method: 'GET', handler: ... },
   * ];
   * routes = await pluginManager.triggerRoute(routes);
   * // 注册最终的路由
   * ```
   */
  async triggerRoute(routes: RouteDefinition[]): Promise<RouteDefinition[]> {
    let currentRoutes = [...routes];
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onRoute) {
        try {
          currentRoutes = await plugin.onRoute(currentRoutes, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:route", currentRoutes);
    return currentRoutes;
  }

  /**
   * 触发 onBuild 钩子
   * 应在构建开始前调用
   *
   * @param options 构建选项
   *
   * @example
   * ```typescript
   * await pluginManager.triggerBuild({ mode: 'prod', target: 'client' });
   * await esbuild.build(config);
   * ```
   */
  async triggerBuild(options: BuildOptions): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onBuild) {
        try {
          await plugin.onBuild(options, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:build", options);
  }

  /**
   * 触发 onBuildComplete 钩子
   * 应在构建完成后调用
   *
   * @param result 构建结果
   *
   * @example
   * ```typescript
   * const result = await esbuild.build(config);
   * await pluginManager.triggerBuildComplete({
   *   outputFiles: result.outputFiles,
   *   duration: Date.now() - startTime,
   * });
   * ```
   */
  async triggerBuildComplete(result: BuildResult): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onBuildComplete) {
        try {
          await plugin.onBuildComplete(result, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:build:complete", result);
  }

  /**
   * 触发 onSocket 钩子
   * 应在 Socket（WebSocket 或 Socket.IO）连接建立时调用
   *
   * @param ctx Socket 上下文
   *
   * @example
   * ```typescript
   * // WebSocket
   * wss.on('connection', async (socket, request) => {
   *   await pluginManager.triggerSocket(createSocketContext('websocket', socket, request));
   * });
   *
   * // Socket.IO
   * io.on('connection', async (socket) => {
   *   await pluginManager.triggerSocket(createSocketContext('socketio', socket));
   * });
   * ```
   */
  async triggerSocket(ctx: SocketContext): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onSocket) {
        try {
          await plugin.onSocket(ctx, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:socket", ctx);
  }

  /**
   * 触发 onSocketClose 钩子
   * 应在 Socket（WebSocket 或 Socket.IO）连接关闭时调用
   *
   * @param ctx Socket 上下文
   *
   * @example
   * ```typescript
   * // WebSocket
   * socket.on('close', async () => {
   *   await pluginManager.triggerSocketClose(ctx);
   * });
   *
   * // Socket.IO
   * socket.on('disconnect', async () => {
   *   await pluginManager.triggerSocketClose(ctx);
   * });
   * ```
   */
  async triggerSocketClose(ctx: SocketContext): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onSocketClose) {
        try {
          await plugin.onSocketClose(ctx, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    }
    this.eventEmitter.emit("app:socket:close", ctx);
  }

  /**
   * 触发 onHealthCheck 钩子
   * 应在健康检查端点被调用时触发
   *
   * @returns 聚合的健康状态
   *
   * @example
   * ```typescript
   * app.get('/health', async (req, res) => {
   *   const status = await pluginManager.triggerHealthCheck();
   *   res.json(status);
   * });
   * ```
   */
  async triggerHealthCheck(): Promise<HealthStatus> {
    const checks: Record<
      string,
      { status: "pass" | "fail" | "warn"; message?: string; duration?: number }
    > = {};
    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy";

    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onHealthCheck) {
        const startTime = Date.now();
        try {
          const result = await plugin.onHealthCheck(this.container);
          const duration = Date.now() - startTime;

          // 记录插件的健康状态
          if (result.checks) {
            for (
              const [checkName, checkResult] of Object.entries(
                result.checks,
              )
            ) {
              checks[`${plugin.name}:${checkName}`] = {
                ...checkResult,
                duration: checkResult.duration ?? duration,
              };
            }
          } else {
            // 如果插件没有详细的 checks，用整体状态
            checks[plugin.name] = {
              status: result.status === "healthy"
                ? "pass"
                : result.status === "degraded"
                ? "warn"
                : "fail",
              duration,
            };
          }

          // 更新整体状态
          if (result.status === "unhealthy") {
            overallStatus = "unhealthy";
          } else if (
            result.status === "degraded" && overallStatus === "healthy"
          ) {
            overallStatus = "degraded";
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          const err = error instanceof Error ? error : new Error(String(error));
          checks[plugin.name] = {
            status: "fail",
            message: err.message,
            duration,
          };
          overallStatus = "unhealthy";
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
        }
      }
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      checks,
      timestamp: Date.now(),
    };

    this.eventEmitter.emit("app:healthcheck", healthStatus);
    return healthStatus;
  }

  /**
   * 触发 onHotReload 钩子
   * 应在文件热重载完成后调用（仅开发环境）
   *
   * @param changedFiles 变更的文件列表
   *
   * @example
   * ```typescript
   * watcher.on('change', async (files) => {
   *   // 重新加载模块...
   *   await pluginManager.triggerHotReload(files);
   * });
   * ```
   */
  async triggerHotReload(changedFiles: string[]): Promise<void> {
    const activePlugins = this.getActivePlugins();
    for (const plugin of activePlugins) {
      if (plugin.onHotReload) {
        try {
          await plugin.onHotReload(changedFiles, this.container);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.pluginErrors.set(plugin.name, err);
          this.eventEmitter.emit("plugin:error", plugin.name, err);
          // 热重载错误不中断其他插件
        }
      }
    }
    this.eventEmitter.emit("app:hotreload", changedFiles);
  }
}
