/**
 * Socket 插件示例
 *
 * 演示 @dreamer/plugin 的统一 Socket 事件钩子（兼容 WebSocket 和 Socket.IO）：
 * - onSocket: Socket 连接建立时调用
 * - onSocketClose: Socket 连接关闭时调用
 *
 * 支持两种连接类型：
 * - WebSocket: 原生 WebSocket 连接
 * - Socket.IO: Socket.IO 连接（支持房间、命名空间等）
 *
 * @example
 * ```bash
 * deno run --allow-all examples/socket-plugin.ts
 * ```
 */

import { ServiceContainer } from "@dreamer/service";
import {
  createSocketIOContext,
  createWebSocketContext,
  isSocketIOContext,
  isWebSocketContext,
  type Plugin,
  PluginManager,
  type SocketContext,
  type SocketIOSocket,
} from "../src/mod.ts";

// ============================================================================
// 连接管理器（服务）
// ============================================================================

/**
 * 连接信息接口
 */
interface ConnectionInfo {
  /** 连接 ID */
  id: string;
  /** 连接类型 */
  type: "websocket" | "socketio";
  /** 用户名 */
  username?: string;
  /** 连接时间 */
  connectedAt: Date;
}

/**
 * 连接管理器
 *
 * 统一管理 WebSocket 和 Socket.IO 连接
 */
class ConnectionManager {
  /** 所有活跃连接 */
  private connections = new Map<string, ConnectionInfo>();

  /**
   * 添加连接
   */
  add(ctx: SocketContext, username?: string): void {
    this.connections.set(ctx.connectionId, {
      id: ctx.connectionId,
      type: ctx.type,
      username,
      connectedAt: new Date(),
    });
    console.log(
      `[ConnManager] 新连接: ${ctx.connectionId} (${ctx.type}), 当前总连接数: ${this.connections.size}`,
    );
  }

  /**
   * 移除连接
   */
  remove(connectionId: string): void {
    this.connections.delete(connectionId);
    console.log(
      `[ConnManager] 连接断开: ${connectionId}, 当前总连接数: ${this.connections.size}`,
    );
  }

  /**
   * 获取连接信息
   */
  get(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 获取连接数量
   */
  get count(): number {
    return this.connections.size;
  }

  /**
   * 获取所有连接
   */
  getAll(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }
}

// ============================================================================
// Socket 插件定义
// ============================================================================

/**
 * 聊天室插件
 *
 * 功能：统一处理 WebSocket 和 Socket.IO 连接
 * 演示：onSocket、onSocketClose 钩子
 */
const chatPlugin: Plugin = {
  name: "chat-plugin",
  version: "1.0.0",

  /**
   * 初始化时注册连接管理器服务
   */
  async onInit(container: ServiceContainer) {
    container.registerSingleton("connectionManager", () => new ConnectionManager());
    console.log("[ChatPlugin] ✓ 连接管理器已注册");
  },

  /**
   * Socket 连接建立时调用（WebSocket 或 Socket.IO）
   */
  async onSocket(ctx: SocketContext, container: ServiceContainer) {
    const connManager = container.get<ConnectionManager>("connectionManager");

    // 根据连接类型处理
    if (isWebSocketContext(ctx)) {
      // WebSocket 连接
      const url = new URL(ctx.request.url);
      const username = url.searchParams.get("username") || `用户${ctx.connectionId.slice(0, 6)}`;

      connManager.add(ctx, username);

      // 设置消息处理
      ctx.socket.onmessage = (event) => {
        console.log(`[WebSocket] 收到消息: ${event.data}`);
        // 回显消息
        ctx.socket.send(`Echo: ${event.data}`);
      };

      // 发送欢迎消息
      ctx.socket.send(JSON.stringify({
        type: "welcome",
        connectionId: ctx.connectionId,
        username,
        message: `欢迎加入聊天室，${username}！`,
      }));

      console.log(`[ChatPlugin] ✓ WebSocket 用户 ${username} 已连接`);
    } else if (isSocketIOContext(ctx)) {
      // Socket.IO 连接
      const username = ctx.handshake?.query?.username as string ||
        `用户${ctx.connectionId.slice(0, 6)}`;

      connManager.add(ctx, username);

      // 设置消息处理
      ctx.socket.on("chat", (message: unknown) => {
        console.log(`[Socket.IO] 收到消息: ${message}`);
        // 广播给其他用户
        ctx.socket.broadcast.emit("chat", {
          username,
          message,
          timestamp: new Date().toISOString(),
        });
      });

      // 发送欢迎消息
      ctx.socket.emit("welcome", {
        connectionId: ctx.connectionId,
        username,
        namespace: ctx.namespace,
        rooms: Array.from(ctx.rooms),
      });

      console.log(`[ChatPlugin] ✓ Socket.IO 用户 ${username} 已连接 (命名空间: ${ctx.namespace})`);
    }
  },

  /**
   * Socket 连接关闭时调用
   */
  async onSocketClose(ctx: SocketContext, container: ServiceContainer) {
    const connManager = container.get<ConnectionManager>("connectionManager");
    const connInfo = connManager.get(ctx.connectionId);

    if (connInfo) {
      connManager.remove(ctx.connectionId);
      console.log(`[ChatPlugin] ◌ ${connInfo.type} 用户 ${connInfo.username} 已断开`);
    }
  },
};

/**
 * 认证插件
 *
 * 功能：验证 Socket 连接的认证信息
 */
const authPlugin: Plugin = {
  name: "auth-plugin",
  version: "1.0.0",

  async onSocket(ctx: SocketContext) {
    if (isWebSocketContext(ctx)) {
      // WebSocket 认证：检查 URL 参数中的 token
      const url = new URL(ctx.request.url);
      const token = url.searchParams.get("token");

      if (url.pathname.startsWith("/ws/private") && !token) {
        ctx.socket.send(JSON.stringify({
          type: "error",
          code: "AUTH_REQUIRED",
          message: "需要认证令牌",
        }));
        ctx.socket.close(4001, "Unauthorized");
        console.log("[AuthPlugin] ✗ WebSocket 连接被拒绝：未提供令牌");
        return;
      }
    } else if (isSocketIOContext(ctx)) {
      // Socket.IO 认证：检查 handshake.auth 中的 token
      const token = ctx.handshake?.auth?.token;

      if (ctx.namespace === "/private" && !token) {
        ctx.socket.emit("error", {
          code: "AUTH_REQUIRED",
          message: "需要认证令牌",
        });
        ctx.socket.disconnect(true);
        console.log("[AuthPlugin] ✗ Socket.IO 连接被拒绝：未提供令牌");
        return;
      }
    }

    console.log("[AuthPlugin] ✓ 认证通过");
  },
};

// ============================================================================
// 模拟 Socket 对象
// ============================================================================

/**
 * 创建模拟的 WebSocket
 */
function createMockWebSocket(): WebSocket {
  const mockSocket = {
    readyState: WebSocket.OPEN,
    send: (data: string) => {
      console.log(`[MockWS] 发送: ${data}`);
    },
    close: (code?: number, reason?: string) => {
      console.log(`[MockWS] 关闭: ${code} - ${reason}`);
    },
    onmessage: null as ((event: MessageEvent) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
  };
  return mockSocket as unknown as WebSocket;
}

/**
 * 创建模拟的 Socket.IO Socket
 */
function createMockSocketIO(id: string, namespace: string = "/"): SocketIOSocket {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();

  return {
    id,
    connected: true,
    rooms: new Set([id]),
    nsp: { name: namespace },
    handshake: {
      query: { username: `SocketIO用户${id.slice(0, 4)}` },
      auth: {},
    },
    emit: (event: string, ...args: unknown[]) => {
      console.log(`[MockIO] 发送 ${event}:`, args);
      return true;
    },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(listener);
      return createMockSocketIO(id, namespace);
    },
    once: (event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(listener);
      return createMockSocketIO(id, namespace);
    },
    off: (event: string) => {
      listeners.delete(event);
      return createMockSocketIO(id, namespace);
    },
    join: (room: string | string[]) => {
      console.log(`[MockIO] 加入房间: ${room}`);
    },
    leave: (room: string) => {
      console.log(`[MockIO] 离开房间: ${room}`);
    },
    to: (room: string) => ({
      emit: (event: string, ...args: unknown[]) => {
        console.log(`[MockIO] 向房间 ${room} 发送 ${event}:`, args);
        return true;
      },
    }),
    broadcast: {
      emit: (event: string, ...args: unknown[]) => {
        console.log(`[MockIO] 广播 ${event}:`, args);
        return true;
      },
    },
    disconnect: (close?: boolean) => {
      console.log(`[MockIO] 断开连接: close=${close}`);
      return createMockSocketIO(id, namespace);
    },
  };
}

// ============================================================================
// 使用示例
// ============================================================================

/**
 * 主函数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Socket 插件示例 - @dreamer/plugin");
  console.log("=".repeat(60));

  // 1. 创建服务容器和插件管理器
  const container = new ServiceContainer();
  const pluginManager = new PluginManager(container);

  // 2. 添加插件
  console.log("\n--- 初始化插件 ---");
  await pluginManager.use(authPlugin);
  await pluginManager.use(chatPlugin);

  // 触发初始化
  await pluginManager.triggerInit();

  // 3. 模拟 WebSocket 连接
  console.log("\n--- 模拟 WebSocket 连接 ---");
  const ws1 = createMockWebSocket();
  const wsCtx1 = createWebSocketContext(ws1, new Request("ws://localhost/ws/chat?username=Alice"));
  await pluginManager.triggerSocket(wsCtx1);

  // 4. 模拟 Socket.IO 连接
  console.log("\n--- 模拟 Socket.IO 连接 ---");
  const io1 = createMockSocketIO("socket-001", "/");
  const ioCtx1 = createSocketIOContext(io1);
  await pluginManager.triggerSocket(ioCtx1);

  // 5. 检查连接状态
  console.log("\n--- 连接状态 ---");
  const connManager = container.get<ConnectionManager>("connectionManager");
  console.log(`当前在线用户: ${connManager.count}`);
  for (const conn of connManager.getAll()) {
    console.log(`  - ${conn.username} (${conn.type})`);
  }

  // 6. 模拟连接关闭
  console.log("\n--- 模拟连接关闭 ---");
  await pluginManager.triggerSocketClose(wsCtx1);
  await pluginManager.triggerSocketClose(ioCtx1);

  // 7. 优雅关闭
  console.log("\n--- 应用关闭 ---");
  await pluginManager.shutdown();

  console.log("\n" + "=".repeat(60));
  console.log("示例完成");
  console.log("=".repeat(60));
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
