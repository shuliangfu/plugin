/**
 * Socket 工具函数
 *
 * 提供创建 SocketContext 的工厂函数，用于统一 WebSocket 和 Socket.IO 的处理
 *
 * @module
 */

import type {
  SocketContext,
  SocketIOContext,
  SocketIOSocket,
  WebSocketContext,
} from "./types.ts";

/**
 * 创建 WebSocket 上下文
 *
 * @param socket - 原生 WebSocket 实例
 * @param request - 握手请求
 * @param connectionId - 连接 ID（可选，自动生成）
 * @returns WebSocketContext 实例
 *
 * @example
 * ```typescript
 * // Deno 原生 WebSocket
 * Deno.serve((req) => {
 *   if (req.headers.get("upgrade") === "websocket") {
 *     const { socket, response } = Deno.upgradeWebSocket(req);
 *     const ctx = createWebSocketContext(socket, req);
 *
 *     socket.onopen = async () => {
 *       await pluginManager.triggerSocket(ctx);
 *     };
 *
 *     socket.onclose = async () => {
 *       await pluginManager.triggerSocketClose(ctx);
 *     };
 *
 *     return response;
 *   }
 *   return new Response("Not a WebSocket request");
 * });
 * ```
 */
export function createWebSocketContext(
  socket: WebSocket,
  request: Request,
  connectionId?: string,
): WebSocketContext {
  const id = connectionId || crypto.randomUUID();

  return {
    type: "websocket",
    connectionId: id,
    socket,
    request,
  };
}

/**
 * 创建 Socket.IO 上下文
 *
 * @param socket - Socket.IO Socket 实例
 * @returns SocketIOContext 实例
 *
 * @example
 * ```typescript
 * import { Server } from "@dreamer/socket-io";
 *
 * const io = new Server(server);
 *
 * io.on("connection", async (socket) => {
 *   const ctx = createSocketIOContext(socket);
 *   await pluginManager.triggerSocket(ctx);
 *
 *   socket.on("disconnect", async () => {
 *     await pluginManager.triggerSocketClose(ctx);
 *   });
 * });
 * ```
 */
export function createSocketIOContext(socket: SocketIOSocket): SocketIOContext {
  return {
    type: "socketio",
    connectionId: socket.id,
    socket,
    namespace: socket.nsp.name,
    rooms: socket.rooms,
    handshake: socket.handshake,
  };
}

/**
 * 创建 SocketContext 的通用工厂函数
 *
 * @param type - Socket 类型
 * @param options - 创建选项
 * @returns SocketContext 实例
 *
 * @example
 * ```typescript
 * // WebSocket
 * const ctx = createSocketContext("websocket", {
 *   socket: ws,
 *   request: req,
 * });
 *
 * // Socket.IO
 * const ctx = createSocketContext("socketio", {
 *   socket: ioSocket,
 * });
 * ```
 */
export function createSocketContext(
  type: "websocket",
  options: { socket: WebSocket; request: Request; connectionId?: string },
): WebSocketContext;
export function createSocketContext(
  type: "socketio",
  options: { socket: SocketIOSocket },
): SocketIOContext;
export function createSocketContext(
  type: "websocket" | "socketio",
  options: {
    socket: WebSocket | SocketIOSocket;
    request?: Request;
    connectionId?: string;
  },
): SocketContext {
  if (type === "websocket") {
    return createWebSocketContext(
      options.socket as WebSocket,
      options.request!,
      options.connectionId,
    );
  } else {
    return createSocketIOContext(options.socket as SocketIOSocket);
  }
}

/**
 * 判断是否为 WebSocket 上下文
 *
 * @param ctx - Socket 上下文
 * @returns 是否为 WebSocket 类型
 */
export function isWebSocketContext(ctx: SocketContext): ctx is WebSocketContext {
  return ctx.type === "websocket";
}

/**
 * 判断是否为 Socket.IO 上下文
 *
 * @param ctx - Socket 上下文
 * @returns 是否为 Socket.IO 类型
 */
export function isSocketIOContext(ctx: SocketContext): ctx is SocketIOContext {
  return ctx.type === "socketio";
}
