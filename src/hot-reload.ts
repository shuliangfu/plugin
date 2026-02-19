/**
 * 热加载管理器
 *
 * 监听插件文件变化，自动重新加载插件
 */

import { type FileWatcher, stat, watchFs } from "@dreamer/runtime-adapter";

import { $tr } from "./i18n.ts";

/**
 * 热加载管理器选项
 */
export interface HotReloadOptions {
  /** 监听间隔（毫秒） */
  interval?: number;
  /** 文件变化回调 */
  onFileChange?: (path: string) => Promise<void> | void;
}

/**
 * 热加载管理器类
 */
export class HotReloadManager {
  /** 文件监听器映射表 */
  private watchers: Map<string, FileWatcher> = new Map();

  /** 文件最后修改时间映射表 */
  private fileStats: Map<string, number> = new Map();

  /**
   * 创建热加载管理器实例
   *
   * @param _options 配置选项（保留用于未来扩展）
   */
  constructor(_options: HotReloadOptions = {}) {
    // 目前 options 未使用，保留用于未来扩展
  }

  /**
   * 监听文件变化
   *
   * @param filePath 文件路径
   * @param onChange 变化回调
   */
  async watchFile(
    filePath: string,
    onChange: (path: string) => Promise<void> | void,
  ): Promise<void> {
    try {
      // 获取文件初始状态
      const fileStat = await stat(filePath);
      if (fileStat.mtime) {
        this.fileStats.set(filePath, fileStat.mtime.getTime());
      }

      // 创建文件监听器
      const watcher = watchFs(filePath, {
        recursive: false,
      });

      // 异步迭代器监听文件变化事件
      (async () => {
        for await (const event of watcher) {
          // 检查事件是否包含目标文件
          const isTargetFile = event.paths && event.paths.includes(filePath);
          if (isTargetFile && event.kind === "modify") {
            const currentStat = await stat(filePath);
            if (currentStat.mtime) {
              const lastModified = this.fileStats.get(filePath) || 0;
              const currentModified = currentStat.mtime.getTime();

              // 如果文件确实被修改了
              if (currentModified > lastModified) {
                this.fileStats.set(filePath, currentModified);
                await onChange(filePath);
              }
            }
          }
        }
      })().catch((error) => {
        console.error($tr("log.fileWatchError", { path: filePath }), error);
      });

      this.watchers.set(filePath, watcher);
    } catch (error) {
      console.error($tr("log.watchFileFailed", { path: filePath }), error);
    }
  }

  /**
   * 停止监听文件
   *
   * @param filePath 文件路径
   */
  unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
      this.fileStats.delete(filePath);
    }
  }

  /**
   * 停止所有监听
   */
  stopAll(): void {
    for (const [filePath, watcher] of this.watchers.entries()) {
      watcher.close();
      this.fileStats.delete(filePath);
    }
    this.watchers.clear();
  }
}
