/**
 * 依赖解析器
 *
 * 提供插件依赖解析、拓扑排序、循环依赖检测等功能
 */

import { $tr } from "./i18n.ts";
import type { Plugin } from "./types.ts";

/**
 * 检测循环依赖
 *
 * @param plugins 插件映射表
 * @returns 如果存在循环依赖，返回循环路径；否则返回 null
 */
export function detectCircularDependency(
  plugins: Map<string, Plugin>,
): string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  /**
   * 深度优先搜索检测循环
   */
  function dfs(pluginName: string): string[] | null {
    if (recursionStack.has(pluginName)) {
      // 找到循环，构建循环路径
      const cycleStart = path.indexOf(pluginName);
      if (cycleStart !== -1) {
        // 构建完整的循环路径（从循环起点到当前节点，再回到起点）
        const cycle = path.slice(cycleStart);
        cycle.push(pluginName); // 添加回到起点的节点，形成完整循环
        return cycle;
      }
      return null;
    }

    if (visited.has(pluginName)) {
      return null;
    }

    visited.add(pluginName);
    recursionStack.add(pluginName);
    path.push(pluginName);

    const plugin = plugins.get(pluginName);
    if (plugin && plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!plugins.has(dep)) {
          // 缺失依赖，但不在这里处理
          continue;
        }
        const cycle = dfs(dep);
        if (cycle) {
          return cycle;
        }
      }
    }

    recursionStack.delete(pluginName);
    path.pop();
    return null;
  }

  // 检查所有插件
  for (const pluginName of plugins.keys()) {
    if (!visited.has(pluginName)) {
      path.length = 0;
      recursionStack.clear();
      const cycle = dfs(pluginName);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

/**
 * 检测缺失的依赖
 *
 * @param plugins 插件映射表
 * @returns 缺失的依赖列表，格式为 { pluginName: [missingDeps] }
 */
export function detectMissingDependencies(
  plugins: Map<string, Plugin>,
): Record<string, string[]> {
  const missing: Record<string, string[]> = {};

  for (const [pluginName, plugin] of plugins.entries()) {
    if (plugin.dependencies) {
      const missingDeps: string[] = [];
      for (const dep of plugin.dependencies) {
        if (!plugins.has(dep)) {
          missingDeps.push(dep);
        }
      }
      if (missingDeps.length > 0) {
        missing[pluginName] = missingDeps;
      }
    }
  }

  return missing;
}

/**
 * 拓扑排序
 *
 * 根据依赖关系计算插件的加载顺序
 *
 * @param plugins 插件映射表
 * @param pluginNames 要排序的插件名称列表（如果未提供，则排序所有插件）
 * @returns 排序后的插件名称列表
 * @throws 如果存在循环依赖或缺失依赖，抛出错误
 */
export function topologicalSort(
  plugins: Map<string, Plugin>,
  pluginNames?: string[],
): string[] {
  // 检测循环依赖
  const cycle = detectCircularDependency(plugins);
  if (cycle) {
    throw new Error(
      $tr("dependencyResolver.circularDependency", {
        cycle: cycle.join(" -> "),
        first: cycle[0],
      }),
    );
  }

  // 检测缺失依赖
  const missing = detectMissingDependencies(plugins);
  if (Object.keys(missing).length > 0) {
    const missingList = Object.entries(missing)
      .map(([name, deps]) => `${name}: [${deps.join(", ")}]`)
      .join("; ");
    throw new Error(
      $tr("dependencyResolver.missingDependency", { list: missingList }),
    );
  }

  // 要排序的插件列表
  const targetPlugins = pluginNames || Array.from(plugins.keys());
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  /**
   * 深度优先搜索进行拓扑排序
   */
  function dfs(pluginName: string): void {
    if (visiting.has(pluginName)) {
      throw new Error(
        $tr("dependencyResolver.circularDependencyCycle", { name: pluginName }),
      );
    }

    if (visited.has(pluginName)) {
      return;
    }

    visiting.add(pluginName);

    const plugin = plugins.get(pluginName);
    if (plugin && plugin.dependencies) {
      // 先处理依赖
      for (const dep of plugin.dependencies) {
        if (targetPlugins.includes(dep)) {
          dfs(dep);
        }
      }
    }

    visiting.delete(pluginName);
    visited.add(pluginName);
    sorted.push(pluginName);
  }

  // 对每个目标插件进行排序
  for (const pluginName of targetPlugins) {
    if (!visited.has(pluginName)) {
      dfs(pluginName);
    }
  }

  return sorted;
}
