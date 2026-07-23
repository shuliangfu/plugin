# @dreamer/plugin

> 一个兼容 Deno、Bun、Node.js 22+
> 的插件管理系统，提供完整的插件注册、生命周期管理、依赖解析、配置管理、热加载等功能

> [English](../../README.md) | 中文 (Chinese)

[![JSR](https://jsr.io/badges/@dreamer/plugin)](https://jsr.io/@dreamer/plugin)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)
[![Tests](https://img.shields.io/badge/tests-157%20passed%20(3%20runtimes)-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

插件管理系统，用于管理应用的插件和扩展功能。插件系统依赖
`@dreamer/service`来注册插件提供的服务，但保持职责分离：service
负责服务管理，plugin 负责插件生命周期管理。

**设计原则**：Manager
负责插件生命周期管理（安装、激活、停用、卸载），插件只需实现事件响应钩子（onInit、onRequest
等）。

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/plugin
```

### Bun

```bash
bunx jsr add @dreamer/plugin
```

### Node.js

```bash
npx jsr add @dreamer/plugin
```

---

## 🌍 环境兼容性

| 环境       | 版本要求                | 状态                                                              |
| ---------- | ----------------------- | ----------------------------------------------------------------- |
| **Deno**   | 2.9+                    | ✅ 完全支持                                                       |
| **Bun**    | 1.3+                    | ✅ 完全支持                                                       |
| **Node.js** | 22+                    | ✅ 完全支持（通过 `tsx` 进行 TypeScript 转译）                    |
| **服务端** | -                       | ✅ 支持（兼容 Deno、Bun、Node.js 运行时，插件系统是服务端架构模式） |
| **客户端** | -                       | ❌ 不支持（浏览器环境，插件系统是服务端概念）                     |
| **依赖**   | `@dreamer/service@^1.1.0` | 📦 用于注册插件提供的服务（必须）                                |

**注意**：@dreamer/plugin 是纯服务端包，不提供客户端子包。

---

## ✨ 特性

- **插件注册和加载**：
  - 手动注册插件对象
  - 从文件加载插件（支持 default export 和 named export）
  - 从目录批量加载插件
  - 插件元数据管理（名称、版本、依赖等）

- **完整的生命周期管理**（Manager 负责，插件只响应事件）：
  - install（安装）：更新状态，解析依赖
  - activate（激活）：更新状态，检查依赖
  - deactivate（停用）：更新状态
  - uninstall（卸载）：更新状态，清理资源
  - 状态管理和转换验证
  - 便捷方法：use()、bootstrap()、shutdown()
  - 插件替换：register({ replace: true })

- **依赖管理**：
  - 插件依赖声明
  - 拓扑排序（自动计算加载顺序）
  - 循环依赖检测
  - 缺失依赖检测
  - 依赖验证工具

- **配置管理**：
  - 插件配置存储（运行时配置覆盖初始配置）
  - 配置验证（可选的验证函数）
  - 配置热更新（运行时更新配置）
  - 配置更新钩子（onConfigUpdate）

- **事件系统**：
  - 生命周期事件（plugin:registered、plugin:installed、plugin:activated 等）
  - 应用级别事件钩子（完整列表见下方）
  - Manager 提供 trigger* 方法触发所有已激活插件的钩子
  - 自定义事件支持
  - 事件发布/订阅模式
  - 多个监听器支持

- **应用级别事件钩子**（插件只需实现这些钩子，Manager 负责触发）：
  - **生命周期**：onInit、onStart、onStop、onShutdown
  - **HTTP 请求**：onRequest、onResponse、onError
  - **路由**：onRoute（动态修改路由）
  - **构建**：onBuild、onBuildComplete
  - **Socket**：onSocket、onSocketClose（同时支持 WebSocket 和 Socket.IO）
  - **健康检查**：onHealthCheck
  - **热重载**：onHotReload（开发环境）

- **错误隔离**：
  - 插件错误不影响其他插件
  - 错误记录和报告
  - 错误事件触发（plugin:error）
  - 错误信息查询

- **开发支持**：
  - 插件热加载（开发环境，监听文件变化）
  - 插件调试工具（getDebugInfo、getDependencyGraph）
  - 资源限制接口（已定义接口）

- **适配器模式**：
  - 统一的插件接口（Plugin）
  - 运行时切换插件
  - 插件服务自动管理

---

## 🎯 使用场景

- **应用功能扩展**：通过插件系统扩展应用功能
- **模块化架构**：将应用拆分为多个插件模块
- **第三方插件集成**：集成第三方开发的插件
- **插件化应用开发**：构建可插拔的应用架构
- **微服务插件管理**：管理微服务中的插件组件
- **开发环境热加载**：开发时自动重载插件

---

## 🚀 快速开始

### 基础用法

```typescript
import { ServiceContainer } from "@dreamer/service";
import { PluginManager } from "@dreamer/plugin";

// 创建服务容器
const container = new ServiceContainer();

// 创建插件管理器
const pluginManager = new PluginManager(container);

// 定义插件（只需实现事件钩子，不需要生命周期钩子）
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  // 初始化钩子（应用启动时调用）
  async onInit(container) {
    console.log("Auth plugin initialized");
  },
  // 请求处理钩子
  async onRequest(ctx) {
    // 检查认证
    const token = ctx.headers.get("Authorization");
    if (!token && ctx.path.startsWith("/api/")) {
      return new Response("Unauthorized", { status: 401 });
    }
  },
  // 关闭钩子
  async onShutdown() {
    console.log("Auth plugin shutdown");
  },
};

// 方式 1：使用便捷方法（推荐）
await pluginManager.use(authPlugin); // 自动注册 → 安装 → 激活

// 触发应用初始化
await pluginManager.triggerInit();

// 优雅关闭
await pluginManager.shutdown();
```

### 手动管理生命周期

```typescript
// 方式 2：手动管理生命周期（适用于精细控制场景）
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
pluginManager.activate("auth-plugin");

// 触发应用初始化
await pluginManager.triggerInit();

// 停用和卸载
pluginManager.deactivate("auth-plugin");
await pluginManager.uninstall("auth-plugin");
```

---

## 🎨 使用示例

### 插件依赖管理

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// 定义依赖插件
const databasePlugin = {
  name: "database-plugin",
  version: "1.0.0",
  async onInit(container) {
    console.log("数据库插件初始化");
  },
};

// 定义依赖 database-plugin 的插件
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  dependencies: ["database-plugin"], // 声明依赖
  async onInit(container) {
    // 依赖插件会自动先安装和激活，onInit 按依赖顺序调用
    console.log("认证插件初始化");
  },
};

// 注册插件（顺序不重要，Manager 会自动处理依赖顺序）
pluginManager.register(databasePlugin);
pluginManager.register(authPlugin);

// 方式 1：使用 bootstrap() 批量启动
await pluginManager.bootstrap(); // 自动按依赖顺序安装、激活、触发 onInit

// 方式 2：手动安装（会自动先安装依赖）
await pluginManager.install("auth-plugin"); // database-plugin 会先被安装
pluginManager.activate("database-plugin"); // 必须先激活依赖
pluginManager.activate("auth-plugin");
```

### 插件配置管理

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// 定义带配置的插件
const cachePlugin = {
  name: "cache-plugin",
  version: "1.0.0",
  config: {
    maxSize: 1000,
    ttl: 3600,
    enabled: true,
  },
  // 配置验证函数
  validateConfig(config) {
    return config.maxSize > 0 && config.ttl > 0;
  },
  // 配置更新钩子（配置热更新时调用）
  async onConfigUpdate(newConfig) {
    console.log("配置已更新:", newConfig);
    // 可以在这里重新初始化服务
  },
  // 初始化钩子
  async onInit(container) {
    const config = this.config || { maxSize: 1000, ttl: 3600 };
    console.log("缓存插件初始化，配置:", config);
  },
};

await pluginManager.use(cachePlugin);

// 获取插件配置
const config = pluginManager.getConfig("cache-plugin");
console.log(config); // { maxSize: 1000, ttl: 3600, enabled: true }

// 更新插件配置
pluginManager.setConfig("cache-plugin", {
  maxSize: 2000,
  ttl: 7200,
  enabled: true,
});

// 部分更新配置
pluginManager.updateConfig("cache-plugin", {
  maxSize: 3000,
});
```

### 从文件加载插件

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// 从单个文件加载插件
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");

// 从目录加载所有插件
await pluginManager.loadFromDirectory("./plugins");
```

**插件文件格式**（`./plugins/auth-plugin.ts`）：

```typescript
import type { Plugin } from "@dreamer/plugin";
import type { ServiceContainer } from "@dreamer/service";

const plugin: Plugin = {
  name: "auth-plugin",
  version: "1.0.0",
  // 初始化钩子
  async onInit(container: ServiceContainer) {
    console.log("认证插件初始化");
  },
  // 请求处理钩子
  async onRequest(ctx) {
    // 检查认证
    const token = ctx.headers.get("Authorization");
    if (!token && ctx.path.startsWith("/api/")) {
      return new Response("Unauthorized", { status: 401 });
    }
  },
};

export default plugin; // 或 export const plugin = { ... };
```

### 事件系统

#### 插件生命周期事件

插件管理器提供生命周期事件，可以通过 `on` 方法监听：

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// 监听生命周期事件
pluginManager.on("plugin:registered", (name, plugin) => {
  console.log(`插件 ${name} 已注册`);
});

pluginManager.on("plugin:installed", (name, plugin) => {
  console.log(`插件 ${name} 已安装`);
});

pluginManager.on("plugin:activated", (name, plugin) => {
  console.log(`插件 ${name} 已激活`);
});

pluginManager.on("plugin:error", (name, error) => {
  console.error(`插件 ${name} 发生错误:`, error);
});

// 注册并安装插件
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
await pluginManager.activate("auth-plugin");
```

#### 应用级别事件钩子

插件可以实现应用级别的事件钩子，响应应用生命周期和请求处理事件：

```typescript
import type { Plugin } from "@dreamer/plugin";
import type { HttpContext } from "@dreamer/server";
import type { ServiceContainer } from "@dreamer/service";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",

  // 应用初始化完成（所有插件安装和激活之后）
  async onInit(container: ServiceContainer) {
    console.log("应用已初始化");
  },

  // 应用启动时
  async onStart(container: ServiceContainer) {
    console.log("应用已启动");
  },

  // 请求处理前（可以访问 req, res）
  async onRequest(ctx: HttpContext, container: ServiceContainer) {
    console.log(`收到请求: ${ctx.method} ${ctx.path}`);
    // 可以访问 ctx.request, ctx.response, ctx.headers 等
  },

  // 请求处理完成后（可以访问 req, res）
  async onResponse(ctx: HttpContext, container: ServiceContainer) {
    console.log(`请求完成: ${ctx.method} ${ctx.path}`);
    // 可以访问 ctx.response 等
  },

  // 构建开始前
  async onBuild(
    options: { mode: "dev" | "prod"; target?: "client" | "server" },
    container: ServiceContainer,
  ) {
    console.log(`开始构建: ${options.mode}`);
  },

  // 构建完成后
  async onBuildComplete(
    result: {
      outputFiles?: string[];
      errors?: unknown[];
      warnings?: unknown[];
    },
    container: ServiceContainer,
  ) {
    console.log(`构建完成: ${result.outputFiles?.length || 0} 个文件`);
  },

  // 应用停止时
  async onStop(container: ServiceContainer) {
    console.log("应用已停止");
  },

  // 应用关闭时
  async onShutdown(container: ServiceContainer) {
    console.log("应用已关闭");
  },
};
```

**支持的事件钩子**：

| 钩子                | 触发时机                               | 返回值                                           |
| ------------------- | -------------------------------------- | ------------------------------------------------ |
| **onInit**          | 应用初始化完成（所有插件激活后）       | void                                             |
| **onStart**         | 应用服务器开始监听                     | void                                             |
| **onStop**          | 应用优雅停止                           | void                                             |
| **onShutdown**      | 应用最终关闭                           | void                                             |
| **onRequest**       | HTTP 请求处理前                        | `Response \| void`（返回 Response 跳过后续处理） |
| **onResponse**      | HTTP 请求处理完成后                    | void                                             |
| **onError**         | 错误发生时                             | `Response \| void`（返回自定义错误响应）         |
| **onRoute**         | 路由注册时                             | `RouteDefinition[]`（修改后的路由列表）          |
| **onBuild**         | 构建开始前                             | void                                             |
| **onBuildComplete** | 构建完成后                             | void                                             |
| **onSocket**        | Socket 连接建立（WebSocket/Socket.IO） | void                                             |
| **onSocketClose**   | Socket 连接关闭                        | void                                             |
| **onHealthCheck**   | 健康检查时                             | `HealthStatus`                                   |
| **onHotReload**     | 热重载完成（开发环境）                 | void                                             |

**Manager trigger\* 方法**（用于触发所有已激活插件的钩子）：

```typescript
// 应用框架应在适当时机调用这些方法
await pluginManager.triggerInit();      // 所有插件激活后
await pluginManager.triggerStart();     // 服务器开始监听时
await pluginManager.triggerStop();      // 优雅停止时（逆序执行）
await pluginManager.triggerShutdown();  // 最终关闭时（逆序执行）

// HTTP 请求生命周期
const response = await pluginManager.triggerRequest(ctx);  // 返回 Response 则跳过后续
await pluginManager.triggerResponse(ctx);
const errorResponse = await pluginManager.triggerError(error, ctx);

// 路由注册
const routes = await pluginManager.triggerRoute(initialRoutes);

// 构建
await pluginManager.triggerBuild({ mode: "prod", target: "client" });
await pluginManager.triggerBuildComplete({ outputFiles: [...] });

// Socket（WebSocket 或 Socket.IO）
await pluginManager.triggerSocket(ctx);      // ctx: SocketContext
await pluginManager.triggerSocketClose(ctx);

// 健康检查
const status = await pluginManager.triggerHealthCheck();

// 热重载
await pluginManager.triggerHotReload(["src/app.ts"]);
```

**注意事项**：

1. 只有**已激活**的插件才会响应应用级别事件
2. 事件钩子中的错误会被捕获并记录（`continueOnError: true` 时不影响其他插件）
3. `onStop` 和 `onShutdown` 逆序执行（后激活的先停止）
4. `onRequest` 返回 `Response` 时，后续插件的 `onRequest` 不会执行
5. `onHealthCheck` 会聚合所有插件的健康状态
6. 所有事件钩子都是可选的，插件可以选择性地实现需要的事件
7. **Socket 钩子需要手动触发**：`@dreamer/dweb` 框架不再内置 WebSocket/Socket.IO
   支持，需要自己实现并手动调用
   `triggerSocket`/`triggerSocketClose`（见下方示例）

#### Socket 钩子手动触发示例

`@dreamer/dweb` 框架已移除内置的 WebSocket 支持，如需使用 `onSocket`
钩子，需要自己创建 Socket.IO 服务并手动触发：

```typescript
import { Server } from "socket.io";
import type { Plugin, SocketContext } from "@dreamer/plugin";

// 1. 创建 Socket.IO 插件
export const socketIOPlugin: Plugin = {
  name: "socket-io",

  async onStart(container) {
    const pluginManager = container.get("plugin");
    const io = new Server(3001);

    io.on("connection", async (socket) => {
      // 构造 SocketContext
      const ctx: SocketContext = {
        type: "socket.io",
        socket,
        id: socket.id,
        handshake: socket.handshake,
      };

      // 手动触发 onSocket 钩子
      await pluginManager.triggerSocket(ctx);

      socket.on("disconnect", async () => {
        // 手动触发 onSocketClose 钩子
        await pluginManager.triggerSocketClose(ctx);
      });
    });

    // 注册到容器供其他插件使用
    container.registerSingleton("socketIO", () => io);
  },

  async onStop(container) {
    const io = container.get("socketIO");
    io?.close();
  },
};

// 2. 其他插件可以响应 Socket 事件
export const chatPlugin: Plugin = {
  name: "chat",

  async onSocket(ctx, container) {
    console.log(`用户连接: ${ctx.id}`);
    ctx.socket.on("message", (data) => {
      ctx.socket.broadcast.emit("message", data);
    });
  },

  async onSocketClose(ctx) {
    console.log(`用户断开: ${ctx.id}`);
  },
};
```

### 热加载（开发环境）

```typescript
import { PluginManager } from "@dreamer/plugin";

// 启用热加载
const pluginManager = new PluginManager(container, {
  enableHotReload: true,
  hotReloadInterval: 1000, // 1 秒检查一次
});

// 从文件加载插件（会自动监听文件变化）
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");

// 当文件发生变化时，插件会自动重新加载
// 如果插件已激活，会先停用，然后重新安装和激活
```

### 调试工具

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// 注册并安装插件
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
await pluginManager.activate("auth-plugin");

// 获取单个插件的调试信息
const debugInfo = pluginManager.getDebugInfo("auth-plugin");
console.log(debugInfo);
// {
//   name: "auth-plugin",
//   version: "1.0.0",
//   state: "active",
//   dependencies: [],
//   services: ["authService"],
//   config: undefined,
//   error: undefined,
// }

// 获取所有插件的调试信息
const allDebugInfo = pluginManager.getDebugInfo();
console.log(allDebugInfo); // PluginDebugInfo[]

// 获取依赖关系图
const dependencyGraph = pluginManager.getDependencyGraph();
console.log(dependencyGraph);
// {
//   "auth-plugin": ["database-plugin"],
//   "database-plugin": [],
// }
```

### 错误隔离

```typescript
import { PluginManager } from "@dreamer/plugin";

// 配置错误处理选项
const pluginManager = new PluginManager(container, {
  continueOnError: true, // 事件钩子错误时继续执行其他插件
});

// 注册有错误的插件
const errorPlugin = {
  name: "error-plugin",
  version: "1.0.0",
  async onInit() {
    throw new Error("初始化失败");
  },
};

// 注册正常插件
const normalPlugin = {
  name: "normal-plugin",
  version: "1.0.0",
  async onInit() {
    console.log("正常插件初始化成功");
  },
};

await pluginManager.use(errorPlugin);
await pluginManager.use(normalPlugin);

// 触发初始化（error-plugin 会失败，但 normal-plugin 会成功）
await pluginManager.triggerInit();

// 查询错误信息
const debugInfo = pluginManager.getDebugInfo("error-plugin");
console.log(debugInfo.error); // Error: 初始化失败
```

---

## 📚 API 文档

### PluginManager 类

插件管理器类，提供插件注册、生命周期管理、事件系统等功能。

#### 构造函数

```typescript
new PluginManager(
  container: ServiceContainer,
  options?: PluginManagerOptions
)
```

创建一个新的插件管理器实例。

**参数**：

| 参数        | 类型                   | 说明                                   |
| ----------- | ---------------------- | -------------------------------------- |
| `container` | `ServiceContainer`     | 服务容器实例（用于注册插件提供的服务） |
| `options`   | `PluginManagerOptions` | 配置选项（可选）                       |

**选项**：

| 选项                | 类型             | 默认值  | 说明                       |
| ------------------- | ---------------- | ------- | -------------------------- |
| `autoActivate`      | `boolean`        | `false` | 是否自动激活已安装的插件   |
| `continueOnError`   | `boolean`        | `true`  | 是否在插件错误时继续执行   |
| `enableHotReload`   | `boolean`        | `false` | 是否启用热加载（开发环境） |
| `hotReloadInterval` | `number`         | `1000`  | 热加载监听间隔（毫秒）     |
| `resourceLimits`    | `ResourceLimits` | -       | 资源限制（可选）           |

**示例**：

```typescript
const pluginManager = new PluginManager(container, {
  autoActivate: true,
  enableHotReload: true,
});
```

#### 便捷方法

| 方法          | 说明                               |
| ------------- | ---------------------------------- |
| `use(plugin)` | 自动注册 → 安装 → 激活插件         |
| `bootstrap()` | 按依赖顺序批量启动所有已注册插件   |
| `shutdown()`  | 优雅关闭所有插件（逆序停用和卸载） |

#### 生命周期方法

| 方法                         | 说明                                       |
| ---------------------------- | ------------------------------------------ |
| `register(plugin, options?)` | 注册插件（options.replace 可替换已有插件） |
| `install(name)`              | 安装插件（自动解析依赖）                   |
| `activate(name)`             | 激活插件（检查依赖已激活）                 |
| `deactivate(name)`           | 停用插件                                   |
| `uninstall(name)`            | 卸载插件（自动清理服务）                   |

#### 查询方法

| 方法                     | 说明                   |
| ------------------------ | ---------------------- |
| `getPlugin(name)`        | 获取插件对象           |
| `getState(name)`         | 获取插件状态           |
| `getRegisteredPlugins()` | 获取所有已注册插件名称 |
| `getConfig(name)`        | 获取插件配置           |
| `getDebugInfo(name?)`    | 获取插件调试信息       |
| `getDependencyGraph()`   | 获取依赖关系图         |

#### 配置方法

| 方法                          | 说明             |
| ----------------------------- | ---------------- |
| `setConfig(name, config)`     | 设置插件配置     |
| `updateConfig(name, partial)` | 部分更新插件配置 |

#### 加载方法

| 方法                     | 说明               |
| ------------------------ | ------------------ |
| `loadFromFile(path)`     | 从文件加载插件     |
| `loadFromDirectory(dir)` | 从目录加载所有插件 |

#### 事件方法

| 方法                   | 说明           |
| ---------------------- | -------------- |
| `on(event, listener)`  | 注册事件监听器 |
| `off(event, listener)` | 移除事件监听器 |
| `emit(event, ...args)` | 触发事件       |

#### 触发器方法（触发已激活插件的钩子）

| 方法                           | 说明                                      |
| ------------------------------ | ----------------------------------------- |
| `triggerInit()`                | 触发 onInit 钩子                          |
| `triggerStart()`               | 触发 onStart 钩子                         |
| `triggerStop()`                | 触发 onStop 钩子（逆序）                  |
| `triggerShutdown()`            | 触发 onShutdown 钩子（逆序）              |
| `triggerRequest(ctx)`          | 触发 onRequest 钩子                       |
| `triggerResponse(ctx)`         | 触发 onResponse 钩子                      |
| `triggerError(error, ctx?)`    | 触发 onError 钩子                         |
| `triggerRoute(routes)`         | 触发 onRoute 钩子                         |
| `triggerBuild(options)`        | 触发 onBuild 钩子                         |
| `triggerBuildComplete(result)` | 触发 onBuildComplete 钩子                 |
| `triggerSocket(ctx)`           | 触发 onSocket 钩子（WebSocket/Socket.IO） |
| `triggerSocketClose(ctx)`      | 触发 onSocketClose 钩子                   |
| `triggerHealthCheck()`         | 触发 onHealthCheck 钩子                   |
| `triggerHotReload(files)`      | 触发 onHotReload 钩子                     |

#### 其他方法

| 方法                          | 说明                      |
| ----------------------------- | ------------------------- |
| `validateDependencies(name?)` | 验证依赖（循环/缺失检测） |
| `stopHotReload()`             | 停止热加载                |
| `dispose()`                   | 清理所有资源              |

### Plugin 接口

插件接口，定义插件的基本结构和事件钩子。

```typescript
interface Plugin<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
  // 必需属性
  name: string; // 插件名称（唯一标识）
  version: string; // 插件版本

  // 可选属性
  dependencies?: string[]; // 插件依赖列表
  config?: TConfig; // 插件初始配置
  validateConfig?: ConfigValidator<TConfig>; // 配置验证函数
  onConfigUpdate?: (newConfig: TConfig) => Promise<void> | void; // 配置更新钩子

  // 应用级别事件钩子（可选，由 Manager.trigger* 方法触发）
  onInit?: (container: ServiceContainer) => Promise<void> | void;
  onStart?: (container: ServiceContainer) => Promise<void> | void;
  onStop?: (container: ServiceContainer) => Promise<void> | void;
  onShutdown?: (container: ServiceContainer) => Promise<void> | void;
  onRequest?: (
    ctx: RequestContext,
    container: ServiceContainer,
  ) => Promise<Response | void> | Response | void;
  onResponse?: (
    ctx: RequestContext,
    container: ServiceContainer,
  ) => Promise<void> | void;
  onError?: (
    error: Error,
    ctx: RequestContext | undefined,
    container: ServiceContainer,
  ) => Promise<Response | void> | Response | void;
  onRoute?: (
    routes: RouteDefinition[],
    container: ServiceContainer,
  ) => Promise<RouteDefinition[]> | RouteDefinition[];
  onBuild?: (
    options: BuildOptions,
    container: ServiceContainer,
  ) => Promise<void> | void;
  onBuildComplete?: (
    result: BuildResult,
    container: ServiceContainer,
  ) => Promise<void> | void;
  onSocket?: (
    ctx: SocketContext, // WebSocketContext | SocketIOContext
    container: ServiceContainer,
  ) => Promise<void> | void;
  onSocketClose?: (
    ctx: SocketContext,
    container: ServiceContainer,
  ) => Promise<void> | void;
  onHealthCheck?: (
    container: ServiceContainer,
  ) => Promise<HealthStatus> | HealthStatus;
  onHotReload?: (
    changedFiles: string[],
    container: ServiceContainer,
  ) => Promise<void> | void;
}
```

### PluginState 类型

插件状态类型。

```typescript
type PluginState =
  | "registered" // 已注册
  | "installed" // 已安装
  | "active" // 已激活
  | "inactive" // 已停用
  | "uninstalled"; // 已卸载
```

### 工具函数

| 函数                                 | 说明                     |
| ------------------------------------ | ------------------------ |
| `detectCircularDependency(plugins)`  | 检测循环依赖             |
| `detectMissingDependencies(plugins)` | 检测缺失依赖             |
| `topologicalSort(plugins, names)`    | 拓扑排序（计算加载顺序） |
| `loadPluginFromFile(path)`           | 从文件加载插件           |

---

## 🔧 高级配置

### 资源限制

```typescript
interface ResourceLimits {
  maxMemory?: number; // 内存限制（MB，可选）
  maxCpu?: number; // CPU 限制（百分比，可选）
  timeout?: number; // 超时时间（毫秒，可选）
}

const pluginManager = new PluginManager(container, {
  resourceLimits: {
    maxMemory: 512,
    timeout: 5000,
  },
});
```

### 插件替换

```typescript
// 使用 replace 选项替换已存在的同名插件
pluginManager.register(newPlugin, { replace: true });

// 监听替换事件
pluginManager.on("plugin:replaced", (name, oldPlugin, newPlugin) => {
  console.log(`插件 ${name} 已被替换`);
});
```

---

## 🚀 性能优化

- **依赖解析优化**：使用拓扑排序计算最优加载顺序
- **错误隔离**：插件错误不影响其他插件，提高系统稳定性
- **热加载优化**：开发环境支持文件变化监听，自动重载插件
- **服务管理**：自动管理插件注册的服务，卸载时自动清理
- **配置缓存**：运行时配置缓存，减少重复计算

---

## 📊 测试报告

| 指标         | 数值                                 |
| ------------ | ------------------------------------ |
| 测试时间     | 2026-07-23                           |
| 测试文件数   | 12                                   |
| Deno         | 169 通过，0 失败                     |
| Bun          | 157 通过，0 失败                     |
| Node.js 22   | 157 通过，0 失败                     |
| 通过率       | 100%（三端全通过）                   |
| CI           | 9 作业（Deno/Bun/Node × Linux/macOS/Windows） |

**测试覆盖**：

- ✅ 所有公共 API 方法（38 个）
- ✅ 所有应用级别事件钩子（14 个）
- ✅ 边界情况（13 种）
- ✅ 错误处理场景（10 种）
- ✅ 便捷方法（use/bootstrap/shutdown）
- ✅ 插件替换功能

详细测试报告请查看 [TEST_REPORT.md](./TEST_REPORT.md)。

---

## 📝 注意事项

1. **服务容器依赖**：插件系统依赖 `@dreamer/service`
   来注册插件提供的服务，必须提供 ServiceContainer 实例。

2. **插件状态管理**：插件状态转换必须按顺序进行（registered → installed → active
   → inactive → uninstalled），状态转换失败时会自动回滚。

3. **依赖管理**：
   - 插件依赖会在安装时自动解析和安装
   - 激活插件时会检查依赖插件是否已激活
   - 循环依赖和缺失依赖会被检测并抛出错误

4. **配置管理**：
   - 运行时配置会覆盖插件初始配置
   - 配置更新时会触发验证和更新钩子
   - 配置验证失败会抛出错误

5. **错误处理**：
   - 默认情况下（`continueOnError: true`），插件错误会被捕获并记录，不会影响其他插件
   - 错误信息可以通过 `getDebugInfo` 查询
   - 错误事件会触发 `plugin:error`

6. **热加载**：
   - 仅在开发环境使用，生产环境不建议启用
   - 文件变化时会自动重新加载插件
   - 已激活的插件会先停用，然后重新安装和激活

7. **服务清理**：卸载插件时会自动移除插件注册的所有服务，无需手动清理。

8. **类型安全**：完整的 TypeScript 类型支持，包括泛型配置类型。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

Apache License 2.0 - 详见 [LICENSE](../../LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
