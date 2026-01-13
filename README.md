# @dreamer/plugin

> 一个兼容 Deno 和 Bun 的插件管理系统，提供完整的插件注册、生命周期管理、依赖解析、配置管理、热加载等功能

[![JSR](https://jsr.io/badges/@dreamer/plugin)](https://jsr.io/@dreamer/plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 功能

插件管理系统，用于管理应用的插件和扩展功能。插件系统依赖 `@dreamer/service` 来注册插件提供的服务，但保持职责分离：service 负责服务管理，plugin 负责插件生命周期管理。

---

## ✨ 特性

- **插件注册和加载**：
  - 手动注册插件对象
  - 从文件加载插件（支持 default export 和 named export）
  - 从目录批量加载插件
  - 插件元数据管理（名称、版本、依赖等）

- **完整的生命周期管理**：
  - install（安装）：注册插件提供的服务，解析依赖
  - activate（激活）：初始化插件功能，检查依赖
  - deactivate（停用）：暂停插件功能
  - uninstall（卸载）：移除插件及其服务
  - 状态管理和转换验证

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
  - 自定义事件支持
  - 事件发布/订阅模式
  - 多个监听器支持

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

## 🎨 设计原则

**所有 @dreamer/* 库都遵循以下原则**：

- **主包（@dreamer/xxx）**：用于服务端（兼容 Deno 和 Bun 运行时）
- **客户端子包（@dreamer/xxx/client）**：用于客户端（浏览器环境）

这样可以：
- 明确区分服务端和客户端代码
- 避免在客户端代码中引入服务端依赖
- 提供更好的类型安全和代码提示
- 支持更好的 tree-shaking

**注意**：@dreamer/plugin 是纯服务端库，不提供客户端子包（插件系统是服务端架构模式）。

---

## 🎯 使用场景

- **应用功能扩展**：通过插件系统扩展应用功能
- **模块化架构**：将应用拆分为多个插件模块
- **第三方插件集成**：集成第三方开发的插件
- **插件化应用开发**：构建可插拔的应用架构
- **微服务插件管理**：管理微服务中的插件组件
- **开发环境热加载**：开发时自动重载插件

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

---

## 🌍 环境兼容性

| 环境 | 版本要求 | 状态 |
|------|---------|------|
| **Deno** | 2.5+ | ✅ 完全支持 |
| **Bun** | 1.0+ | ✅ 完全支持 |
| **服务端** | - | ✅ 支持（兼容 Deno 和 Bun 运行时，插件系统是服务端架构模式） |
| **客户端** | - | ❌ 不支持（浏览器环境，插件系统是服务端概念） |
| **依赖** | `@dreamer/service@^1.0.0-beta.1` | 📦 用于注册插件提供的服务（必须） |

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

// 定义插件
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  async install(container) {
    // 安装时注册服务
    container.registerSingleton("authService", () => new AuthService());
    console.log("Auth plugin installed");
  },
  async activate(container) {
    // 激活时初始化
    const authService = container.get("authService");
    await authService.initialize();
    console.log("Auth plugin activated");
  },
  async deactivate() {
    console.log("Auth plugin deactivated");
  },
  async uninstall() {
    console.log("Auth plugin uninstalled");
  },
};

// 注册插件
pluginManager.register(authPlugin);

// 安装插件
await pluginManager.install("auth-plugin");

// 激活插件
await pluginManager.activate("auth-plugin");

// 停用插件
await pluginManager.deactivate("auth-plugin");

// 卸载插件
await pluginManager.uninstall("auth-plugin");
```

### 插件依赖管理

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// 定义依赖插件
const databasePlugin = {
  name: "database-plugin",
  version: "1.0.0",
  async install(container) {
    container.registerSingleton("database", () => new Database());
  },
};

// 定义依赖 database-plugin 的插件
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  dependencies: ["database-plugin"], // 声明依赖
  async install(container) {
    container.registerSingleton("authService", () => new AuthService());
  },
  async activate(container) {
    // 依赖插件会自动先安装和激活
    const database = container.get("database");
    const authService = container.get("authService");
    await authService.initialize(database);
  },
};

// 注册插件
pluginManager.register(databasePlugin);
pluginManager.register(authPlugin);

// 安装 auth-plugin 会自动先安装 database-plugin
await pluginManager.install("auth-plugin");

// 激活 auth-plugin 会检查 database-plugin 是否已激活
await pluginManager.activate("auth-plugin");
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
  // 配置更新钩子
  async onConfigUpdate(newConfig) {
    console.log("配置已更新:", newConfig);
    // 重新初始化缓存服务
  },
  async install(container) {
    const config = this.config || { maxSize: 1000, ttl: 3600 };
    container.registerSingleton("cacheService", () => new CacheService(config));
  },
};

pluginManager.register(cachePlugin);
await pluginManager.install("cache-plugin");

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
  async install(container: ServiceContainer) {
    container.registerSingleton("authService", () => new AuthService());
  },
  async activate(container: ServiceContainer) {
    const authService = container.get("authService");
    await authService.initialize();
  },
};

export default plugin; // 或 export const plugin = { ... };
```

### 事件系统

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
  continueOnError: true, // 插件错误时继续执行其他插件
});

// 注册有错误的插件
const errorPlugin = {
  name: "error-plugin",
  version: "1.0.0",
  async install() {
    throw new Error("安装失败");
  },
};

// 注册正常插件
const normalPlugin = {
  name: "normal-plugin",
  version: "1.0.0",
  async install(container) {
    container.registerSingleton("normalService", () => ({ value: "ok" }));
  },
};

pluginManager.register(errorPlugin);
pluginManager.register(normalPlugin);

// 安装插件（error-plugin 会失败，但 normal-plugin 会成功）
await pluginManager.install("error-plugin"); // 错误被捕获，不会抛出
await pluginManager.install("normal-plugin"); // 成功

// 查询错误信息
const debugInfo = pluginManager.getDebugInfo("error-plugin");
console.log(debugInfo.error); // Error: 安装失败
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
- `container: ServiceContainer` - 服务容器实例（用于注册插件提供的服务）
- `options?: PluginManagerOptions` - 配置选项
  - `autoActivate?: boolean` - 是否自动激活已安装的插件（默认：false）
  - `continueOnError?: boolean` - 是否在插件错误时继续执行（默认：true）
  - `enableHotReload?: boolean` - 是否启用热加载（开发环境，默认：false）
  - `hotReloadInterval?: number` - 热加载监听间隔（毫秒，默认：1000）
  - `resourceLimits?: ResourceLimits` - 资源限制（可选）

**示例**：
```typescript
const pluginManager = new PluginManager(container, {
  autoActivate: true,
  enableHotReload: true,
});
```

#### 方法

##### `register(plugin: Plugin): void`

注册插件。

**参数**：
- `plugin: Plugin` - 插件对象

**抛出**：如果插件名称已存在，抛出错误

**示例**：
```typescript
pluginManager.register(authPlugin);
```

##### `getPlugin(name: string): Plugin | undefined`

获取插件对象。

**参数**：
- `name: string` - 插件名称

**返回**：插件对象，如果不存在则返回 undefined

##### `getState(name: string): PluginState | undefined`

获取插件状态。

**参数**：
- `name: string` - 插件名称

**返回**：插件状态（registered、installed、active、inactive、uninstalled），如果不存在则返回 undefined

##### `getRegisteredPlugins(): string[]`

获取所有已注册的插件名称。

**返回**：插件名称数组

##### `install(name: string): Promise<void>`

安装插件。会解析插件依赖，按依赖顺序安装插件。

**参数**：
- `name: string` - 插件名称

**抛出**：如果插件不存在、存在循环依赖或缺失依赖，抛出错误

**示例**：
```typescript
await pluginManager.install("auth-plugin");
```

##### `activate(name: string): Promise<void>`

激活插件。会检查依赖插件是否已激活。

**参数**：
- `name: string` - 插件名称

**抛出**：如果插件不存在、未安装或依赖未激活，抛出错误

**示例**：
```typescript
await pluginManager.activate("auth-plugin");
```

##### `deactivate(name: string): Promise<void>`

停用插件。

**参数**：
- `name: string` - 插件名称

**抛出**：如果插件不存在或未激活，抛出错误

**示例**：
```typescript
await pluginManager.deactivate("auth-plugin");
```

##### `uninstall(name: string): Promise<void>`

卸载插件。会自动停用已激活的插件，并移除插件注册的服务。

**参数**：
- `name: string` - 插件名称

**抛出**：如果插件不存在，抛出错误

**示例**：
```typescript
await pluginManager.uninstall("auth-plugin");
```

##### `loadFromFile(path: string): Promise<void>`

从文件加载插件。

**参数**：
- `path: string` - 插件文件路径

**抛出**：如果文件不存在或加载失败，抛出错误

**示例**：
```typescript
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");
```

##### `loadFromDirectory(directory: string): Promise<void>`

从目录加载所有插件。

**参数**：
- `directory: string` - 插件目录路径

**抛出**：如果目录不存在或加载失败，抛出错误

**示例**：
```typescript
await pluginManager.loadFromDirectory("./plugins");
```

##### `validateDependencies(name?: string): void`

验证插件依赖。

**参数**：
- `name?: string` - 插件名称（可选，如果不提供则验证所有插件）

**抛出**：如果存在循环依赖或缺失依赖，抛出错误

**示例**：
```typescript
// 验证单个插件的依赖
pluginManager.validateDependencies("auth-plugin");

// 验证所有插件的依赖
pluginManager.validateDependencies();
```

##### `getConfig<T>(name: string): T | undefined`

获取插件配置。

**参数**：
- `name: string` - 插件名称

**返回**：插件配置，如果不存在则返回 undefined（优先返回运行时配置）

**示例**：
```typescript
const config = pluginManager.getConfig("cache-plugin");
```

##### `setConfig<T>(name: string, config: T): Promise<void>`

设置插件配置。

**参数**：
- `name: string` - 插件名称
- `config: T` - 配置对象

**抛出**：如果插件不存在或配置验证失败，抛出错误

**示例**：
```typescript
await pluginManager.setConfig("cache-plugin", {
  maxSize: 2000,
  ttl: 7200,
});
```

##### `updateConfig<T>(name: string, partialConfig: Partial<T>): Promise<void>`

更新插件配置（合并现有配置）。

**参数**：
- `name: string` - 插件名称
- `partialConfig: Partial<T>` - 部分配置对象

**抛出**：如果插件不存在或配置验证失败，抛出错误

**示例**：
```typescript
await pluginManager.updateConfig("cache-plugin", {
  maxSize: 3000,
});
```

##### `getDebugInfo<TConfig>(name?: string): PluginDebugInfo<TConfig> | PluginDebugInfo<TConfig>[] | undefined`

获取插件调试信息。

**参数**：
- `name?: string` - 插件名称（可选，如果不提供则返回所有插件的信息）

**返回**：插件调试信息或列表

**示例**：
```typescript
// 获取单个插件的调试信息
const debugInfo = pluginManager.getDebugInfo("auth-plugin");

// 获取所有插件的调试信息
const allDebugInfo = pluginManager.getDebugInfo();
```

##### `getDependencyGraph(): Record<string, string[]>`

获取插件依赖关系图。

**返回**：依赖关系图，格式为 `{ pluginName: [dependencies] }`

**示例**：
```typescript
const graph = pluginManager.getDependencyGraph();
// { "auth-plugin": ["database-plugin"], "database-plugin": [] }
```

##### `on(event: string, listener: (...args: unknown[]) => void): void`

注册事件监听器。

**参数**：
- `event: string` - 事件名称
- `listener: (...args: unknown[]) => void` - 监听器函数

**示例**：
```typescript
pluginManager.on("plugin:installed", (name) => {
  console.log(`插件 ${name} 已安装`);
});
```

##### `off(event: string, listener: (...args: unknown[]) => void): void`

移除事件监听器。

**参数**：
- `event: string` - 事件名称
- `listener: (...args: unknown[]) => void` - 要移除的监听器函数

##### `emit(event: string, ...args: unknown[]): void`

触发事件。

**参数**：
- `event: string` - 事件名称
- `...args: unknown[]` - 事件参数

##### `stopHotReload(): void`

停止热加载。

**示例**：
```typescript
pluginManager.stopHotReload();
```

##### `dispose(): void`

清理插件管理器资源。

**示例**：
```typescript
pluginManager.dispose();
```

### Plugin 接口

插件接口，定义插件的基本结构和生命周期钩子。

```typescript
interface Plugin<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  name: string;                                    // 插件名称（必须）
  version: string;                                 // 插件版本（必须）
  dependencies?: string[];                         // 插件依赖列表（可选）
  config?: TConfig;                                // 插件初始配置（可选）
  validateConfig?: ConfigValidator<TConfig>;       // 配置验证函数（可选）
  onConfigUpdate?: (newConfig: TConfig) => Promise<void> | void; // 配置更新钩子（可选）
  install?: (container: ServiceContainer) => Promise<void> | void; // 安装钩子（可选）
  activate?: (container: ServiceContainer) => Promise<void> | void; // 激活钩子（可选）
  deactivate?: () => Promise<void> | void;         // 停用钩子（可选）
  uninstall?: () => Promise<void> | void;         // 卸载钩子（可选）
}
```

**属性说明**：
- `name: string` - 插件名称（必须，唯一标识）
- `version: string` - 插件版本（必须）
- `dependencies?: string[]` - 插件依赖列表（可选，依赖的插件名称数组）
- `config?: TConfig` - 插件初始配置（可选，运行时配置会覆盖初始配置）
- `validateConfig?: ConfigValidator<TConfig>` - 配置验证函数（可选，返回 true 表示验证通过）
- `onConfigUpdate?: (newConfig: TConfig) => Promise<void> | void` - 配置更新钩子（可选，配置更新时调用）
- `install?: (container: ServiceContainer) => Promise<void> | void` - 安装钩子（可选，安装时调用）
- `activate?: (container: ServiceContainer) => Promise<void> | void` - 激活钩子（可选，激活时调用）
- `deactivate?: () => Promise<void> | void` - 停用钩子（可选，停用时调用）
- `uninstall?: () => Promise<void> | void` - 卸载钩子（可选，卸载时调用）

### PluginState 类型

插件状态类型。

```typescript
type PluginState =
  | "registered"   // 已注册
  | "installed"    // 已安装
  | "active"       // 已激活
  | "inactive"     // 已停用
  | "uninstalled"; // 已卸载
```

### PluginManagerOptions 接口

插件管理器配置选项。

```typescript
interface PluginManagerOptions {
  autoActivate?: boolean;           // 是否自动激活已安装的插件（默认：false）
  continueOnError?: boolean;        // 是否在插件错误时继续执行（默认：true）
  enableHotReload?: boolean;        // 是否启用热加载（开发环境，默认：false）
  hotReloadInterval?: number;       // 热加载监听间隔（毫秒，默认：1000）
  resourceLimits?: ResourceLimits;   // 资源限制（可选）
}
```

### ResourceLimits 接口

资源限制配置（已定义接口，具体实现为未来扩展）。

```typescript
interface ResourceLimits {
  maxMemory?: number;  // 内存限制（MB，可选）
  maxCpu?: number;     // CPU 限制（百分比，可选）
  timeout?: number;    // 超时时间（毫秒，可选）
}
```

### PluginDebugInfo 接口

插件调试信息接口。

```typescript
interface PluginDebugInfo<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  name: string;                    // 插件名称
  version: string;                 // 插件版本
  state: PluginState;              // 插件状态
  dependencies: string[];          // 依赖列表
  services: string[];              // 注册的服务列表
  config?: TConfig;                // 插件配置
  error?: Error;                   // 错误信息（如果有）
}
```

### 工具函数

#### `detectCircularDependency(plugins: Map<string, Plugin>): string[] | null`

检测循环依赖。

**参数**：
- `plugins: Map<string, Plugin>` - 插件映射表

**返回**：循环依赖路径（如果存在），否则返回 null

**示例**：
```typescript
import { detectCircularDependency } from "@dreamer/plugin";

const plugins = new Map([
  ["plugin1", { name: "plugin1", version: "1.0.0", dependencies: ["plugin2"] }],
  ["plugin2", { name: "plugin2", version: "1.0.0", dependencies: ["plugin1"] }],
]);

const cycle = detectCircularDependency(plugins);
if (cycle) {
  console.error("检测到循环依赖:", cycle);
}
```

#### `detectMissingDependencies(plugins: Map<string, Plugin>): Record<string, string[]>`

检测缺失依赖。

**参数**：
- `plugins: Map<string, Plugin>` - 插件映射表

**返回**：缺失依赖映射表，格式为 `{ pluginName: [missingDependencies] }`

**示例**：
```typescript
import { detectMissingDependencies } from "@dreamer/plugin";

const plugins = new Map([
  ["plugin1", { name: "plugin1", version: "1.0.0", dependencies: ["missing-plugin"] }],
]);

const missing = detectMissingDependencies(plugins);
console.log(missing); // { "plugin1": ["missing-plugin"] }
```

#### `topologicalSort(plugins: Map<string, Plugin>, pluginNames: string[]): string[]`

拓扑排序，计算插件加载顺序。

**参数**：
- `plugins: Map<string, Plugin>` - 插件映射表
- `pluginNames: string[]` - 要排序的插件名称列表

**返回**：排序后的插件名称数组

**抛出**：如果存在循环依赖，抛出错误

**示例**：
```typescript
import { topologicalSort } from "@dreamer/plugin";

const plugins = new Map([
  ["plugin1", { name: "plugin1", version: "1.0.0", dependencies: ["plugin2"] }],
  ["plugin2", { name: "plugin2", version: "1.0.0" }],
]);

const sorted = topologicalSort(plugins, ["plugin1", "plugin2"]);
console.log(sorted); // ["plugin2", "plugin1"]
```

#### `loadPluginFromFile(path: string): Promise<Plugin>`

从文件加载插件。

**参数**：
- `path: string` - 插件文件路径

**返回**：插件对象

**抛出**：如果文件不存在或加载失败，抛出错误

**示例**：
```typescript
import { loadPluginFromFile } from "@dreamer/plugin";

const plugin = await loadPluginFromFile("./plugins/auth-plugin.ts");
```

---

## ⚡ 性能优化

- **依赖解析优化**：使用拓扑排序计算最优加载顺序
- **错误隔离**：插件错误不影响其他插件，提高系统稳定性
- **热加载优化**：开发环境支持文件变化监听，自动重载插件
- **服务管理**：自动管理插件注册的服务，卸载时自动清理
- **配置缓存**：运行时配置缓存，减少重复计算

---

## 📝 注意事项

1. **服务容器依赖**：插件系统依赖 `@dreamer/service` 来注册插件提供的服务，必须提供 ServiceContainer 实例。

2. **插件状态管理**：插件状态转换必须按顺序进行（registered → installed → active → inactive → uninstalled），状态转换失败时会自动回滚。

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

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
