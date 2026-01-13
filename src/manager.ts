/**
 * 插件管理器
 *
 * 提供插件注册、生命周期管理、依赖解析等功能
 */

import { join, readdir, stat } from "@dreamer/runtime-adapter";
import type { ServiceContainer } from "@dreamer/service";

import {
  detectCircularDependency,
  detectMissingDependencies,
  topologicalSort,
} from "./dependency-resolver.ts";
import { EventEmitter } from "./event-emitter.ts";
import { HotReloadManager } from "./hot-reload.ts";
import { loadPluginFromFile } from "./loader.ts";
import type {
  Plugin,
  PluginDebugInfo,
  PluginManagerOptions,
  PluginState,
  ResourceLimits,
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
   * @throws 如果插件名称已存在，抛出错误
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`插件 "${plugin.name}" 已注册`);
    }

    this.plugins.set(plugin.name, plugin);
    this.pluginStates.set(plugin.name, "registered");

    // 触发注册事件
    this.eventEmitter.emit("plugin:registered", plugin.name, plugin);
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
      throw new Error(`插件 "${name}" 未注册`);
    }

    const currentState = this.pluginStates.get(name);
    if (currentState !== "registered") {
      throw new Error(
        `插件 "${name}" 当前状态为 "${currentState}"，无法安装（只能从 registered 状态安装）`,
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
    const services = new Set<string>();

    // 记录安装前的服务列表
    const beforeServices = new Set(this.container.getRegisteredServices());

    // 执行安装钩子
    if (plugin.install) {
      await plugin.install(this.container);
    }

    // 记录新注册的服务
    const afterServices = new Set(this.container.getRegisteredServices());
    for (const serviceName of afterServices) {
      if (!beforeServices.has(serviceName)) {
        services.add(serviceName);
      }
    }

    // 保存插件注册的服务列表
    this.pluginServices.set(name, services);

    // 更新状态
    this.pluginStates.set(name, "installed");

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
  async activate(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件 "${name}" 未注册`);
    }

    const currentState = this.pluginStates.get(name);
    if (currentState !== "installed" && currentState !== "inactive") {
      throw new Error(
        `插件 "${name}" 当前状态为 "${currentState}"，无法激活（只能从 installed 或 inactive 状态激活）`,
      );
    }

    try {
      // 检查依赖插件是否已激活
      if (plugin.dependencies) {
        for (const depName of plugin.dependencies) {
          const depState = this.pluginStates.get(depName);
          // 只有当状态明确不是 "active" 时才抛出错误
          // 如果状态是 undefined 或其他值，也应该抛出错误
          if (!depState || depState !== "active") {
            const stateStr = depState || "undefined";
            throw new Error(
              `插件 "${name}" 的依赖 "${depName}" 未激活（当前状态: ${stateStr}）`,
            );
          }
        }
      }

      // 执行激活钩子
      if (plugin.activate) {
        await plugin.activate(this.container);
      }

      // 更新状态
      this.pluginStates.set(name, "active");

      // 触发激活事件
      this.eventEmitter.emit("plugin:activated", name, plugin);
      // 清除之前的错误
      this.pluginErrors.delete(name);
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
   * 停用插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在或未激活，抛出错误
   */
  async deactivate(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件 "${name}" 未注册`);
    }

    const currentState = this.pluginStates.get(name);
    if (currentState !== "active") {
      throw new Error(
        `插件 "${name}" 当前状态为 "${currentState}"，无法停用（只能从 active 状态停用）`,
      );
    }

    try {
      // 执行停用钩子
      if (plugin.deactivate) {
        await plugin.deactivate();
      }

      // 更新状态
      this.pluginStates.set(name, "inactive");

      // 触发停用事件
      this.eventEmitter.emit("plugin:deactivated", name, plugin);
      // 清除之前的错误
      this.pluginErrors.delete(name);
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
   * 卸载插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在，抛出错误
   */
  async uninstall(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`插件 "${name}" 未注册`);
    }

    const currentState = this.pluginStates.get(name);
    if (currentState === "uninstalled") {
      return; // 已经卸载，无需重复操作
    }

    try {
      // 如果插件已激活，先停用
      if (currentState === "active") {
        await this.deactivate(name);
      }

      // 执行卸载钩子
      if (plugin.uninstall) {
        await plugin.uninstall();
      }

      // 移除插件注册的服务
      const services = this.pluginServices.get(name);
      if (services) {
        for (const serviceName of services) {
          this.container.remove(serviceName);
        }
        this.pluginServices.delete(name);
      }

      // 更新状态
      this.pluginStates.set(name, "uninstalled");

      // 触发卸载事件
      this.eventEmitter.emit("plugin:uninstalled", name, plugin);
      // 清除错误和配置
      this.pluginErrors.delete(name);
      this.pluginConfigs.delete(name);
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
      console.error(`热加载插件失败: ${path}`, error);
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
          // 如果某个文件加载失败，记录错误但继续加载其他文件
          console.error(`加载插件文件失败: ${filePath}`, error);
          if (!this.options.continueOnError) {
            throw error;
          }
        }
      }
    } catch (error) {
      throw new Error(
        `加载插件目录失败: ${directory} - ${
          error instanceof Error ? error.message : String(error)
        }`,
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
      // 验证单个插件的依赖
      const plugin = this.plugins.get(name);
      if (!plugin) {
        throw new Error(`插件 "${name}" 未注册`);
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

      // 检测循环依赖
      const cycle = detectCircularDependency(relatedPlugins);
      if (cycle) {
        throw new Error(
          `插件 "${name}" 存在循环依赖: ${cycle.join(" -> ")} -> ${cycle[0]}`,
        );
      }

      // 检测缺失依赖
      const missing = detectMissingDependencies(relatedPlugins);
      if (Object.keys(missing).length > 0) {
        const missingList = Object.entries(missing)
          .map(([pName, deps]) => `${pName}: [${deps.join(", ")}]`)
          .join("; ");
        throw new Error(`插件 "${name}" 存在缺失依赖: ${missingList}`);
      }
    } else {
      // 验证所有插件的依赖
      const cycle = detectCircularDependency(this.plugins);
      if (cycle) {
        throw new Error(
          `检测到循环依赖: ${cycle.join(" -> ")} -> ${cycle[0]}`,
        );
      }

      const missing = detectMissingDependencies(this.plugins);
      if (Object.keys(missing).length > 0) {
        const missingList = Object.entries(missing)
          .map(([pName, deps]) => `${pName}: [${deps.join(", ")}]`)
          .join("; ");
        throw new Error(`检测到缺失依赖: ${missingList}`);
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
      throw new Error(`插件 "${name}" 未注册`);
    }

    // 如果插件有配置验证函数，进行验证
    if (plugin.validateConfig) {
      if (!plugin.validateConfig(config)) {
        throw new Error(`插件 "${name}" 配置验证失败`);
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
        throw new Error(`插件 "${name}" 未注册`);
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
}
