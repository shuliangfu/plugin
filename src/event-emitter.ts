/**
 * 事件发射器
 *
 * 提供简单的事件发布/订阅功能
 */

/**
 * 事件监听器类型
 */
export type EventListener = (...args: unknown[]) => void;

/**
 * 事件发射器类
 *
 * 用于管理事件监听器和触发事件
 */
export class EventEmitter {
  /** 事件监听器映射表 */
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * 注册事件监听器
   *
   * @param event 事件名称
   * @param listener 监听器函数
   */
  on(event: string, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * 移除事件监听器
   *
   * @param event 事件名称
   * @param listener 监听器函数
   */
  off(event: string, listener: EventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * 触发事件
   *
   * @param event 事件名称
   * @param args 事件参数
   */
  emit(event: string, ...args: unknown[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch (error) {
          // 监听器错误不应该影响其他监听器
          console.error(`事件监听器错误 (${event}):`, error);
        }
      }
    }
  }

  /**
   * 移除所有事件监听器
   *
   * @param event 事件名称（可选，如果不提供则移除所有事件）
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   *
   * @param event 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * 获取所有事件名称
   *
   * @returns 事件名称数组
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
