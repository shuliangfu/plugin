/**
 * 插件加载器
 *
 * 提供从文件加载插件的功能
 */

import { pathToFileURL } from "node:url";
import { $tr } from "./i18n.ts";
import type { Plugin } from "./types.ts";

/**
 * 从文件加载插件
 *
 * @param path 插件文件路径
 * @returns 插件对象
 * @throws 如果文件不存在或加载失败，抛出错误
 */
export async function loadPluginFromFile(path: string): Promise<Plugin> {
  try {
    // 动态导入插件文件
    // 使用 pathToFileURL 将路径转为 file:// URL：Windows 上裸路径 "D:/..." 的
    // 驱动器号会被 Deno 误解为 URL scheme（"Unsupported scheme d"），Bun 也无法
    // 解析；file:// URL 是三端（Deno/Bun/Node）跨平台动态 import 的标准方式。
    const module = await import(pathToFileURL(path).href);

    // 尝试获取插件对象
    // 支持 export default 或命名导出 export const plugin
    let plugin: Plugin | undefined;

    if (module.default) {
      plugin = module.default;
    } else if (module.plugin) {
      plugin = module.plugin;
    } else {
      // 尝试查找符合 Plugin 接口的对象
      for (const key of Object.keys(module)) {
        const value = module[key];
        if (
          value &&
          typeof value === "object" &&
          "name" in value &&
          "version" in value
        ) {
          plugin = value as Plugin;
          break;
        }
      }
    }

    if (!plugin) {
      throw new Error($tr("errors.pluginFileNoExport", { path }));
    }

    // 验证插件对象
    if (!plugin.name || !plugin.version) {
      throw new Error($tr("errors.pluginMissingNameVersion", { path }));
    }

    return plugin;
  } catch (error) {
    throw new Error(
      $tr("errors.loadPluginFailed", {
        path,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
