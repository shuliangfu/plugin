# @dreamer/plugin

> Plugin management system for Deno and Bun: registration, lifecycle, dependency resolution, config, hot reload

English | [中文 (Chinese)](./README-zh.md)

[![JSR](https://jsr.io/badges/@dreamer/plugin)](https://jsr.io/@dreamer/plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-157%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 Features

Plugin management system for app plugins and extensions. Depends on `@dreamer/service` for service registration; service handles services, plugin handles lifecycle.

**Design**: Manager handles lifecycle (install, activate, deactivate, uninstall); plugins implement event hooks (onInit, onRequest, etc.).

---

## 📦 Installation

### Deno

```bash
deno add jsr:@dreamer/plugin
```

### Bun

```bash
bunx jsr add @dreamer/plugin
```

---

## 🌍 Environment Compatibility

| Environment | Version | Status |
|-------------|---------|--------|
| **Deno** | 2.5+ | ✅ Full support |
| **Bun** | 1.0+ | ✅ Full support |
| **Server** | - | ✅ Deno/Bun compatible |
| **Client** | - | ❌ Not supported (server-only) |
| **Dependencies** | `@dreamer/service@^1.0.0-beta.1` | 📦 Required |

**Note**: @dreamer/plugin is server-only; no client subpath.

---

## ✨ Characteristics

- **Registration and loading**:
  - Manual register
  - Load from file (default/named export)
  - Load from directory
  - Metadata (name, version, dependencies)

- **Lifecycle** (Manager-driven):
  - install, activate, deactivate, uninstall
  - State management and validation
  - use(), bootstrap(), shutdown()
  - register({ replace: true })

- **Dependency management**:
  - Declaration, topological sort
  - Circular/missing dependency detection

- **Config management**:
  - Runtime config overrides initial
  - Validation, hot update
  - onConfigUpdate hook

- **Event system**:
  - Lifecycle events (plugin:registered, etc.)
  - App-level hooks (trigger* methods)
  - Custom events, pub/sub

- **App-level hooks**:
  - Lifecycle: onInit, onStart, onStop, onShutdown
  - HTTP: onRequest, onResponse, onError
  - Route: onRoute
  - Build: onBuild, onBuildComplete
  - Socket: onSocket, onSocketClose (WebSocket/Socket.IO)
  - Health: onHealthCheck
  - Dev: onHotReload

- **Error isolation**, **dev tools**, **adapter pattern**

---

## 🎯 Use Cases

- App extension, modular architecture
- Third-party plugin integration
- Pluggable application development
- Microservice plugin management
- Dev hot reload

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { ServiceContainer } from "@dreamer/service";
import { PluginManager } from "@dreamer/plugin";

// Create service container
const container = new ServiceContainer();

// Create plugin manager
const pluginManager = new PluginManager(container);

// Define plugin (implement event hooks only)
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  // Init hook (called when app starts)
  async onInit(container) {
    console.log("Auth plugin initialized");
  },
  // Request hook
  async onRequest(ctx) {
    // Check auth
    const token = ctx.headers.get("Authorization");
    if (!token && ctx.path.startsWith("/api/")) {
      return new Response("Unauthorized", { status: 401 });
    }
  },
  // Shutdown hook
  async onShutdown() {
    console.log("Auth plugin shutdown");
  },
};

// 1. Use convenience method (recommended)
await pluginManager.use(authPlugin); // Auto register → install → activate

// Trigger app init
await pluginManager.triggerInit();

// Graceful shutdown
await pluginManager.shutdown();
```

### Manual Lifecycle

```typescript
// 2. Manual lifecycle (for fine-grained control)
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
pluginManager.activate("auth-plugin");

// Trigger app init
await pluginManager.triggerInit();

// Deactivate and uninstall
pluginManager.deactivate("auth-plugin");
await pluginManager.uninstall("auth-plugin");
```

---

## 🎨 Examples

### Plugin Dependencies

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Define dependency plugin
const databasePlugin = {
  name: "database-plugin",
  version: "1.0.0",
  async onInit(container) {
    console.log("Database plugin initialized");
  },
};

// Plugin that depends on database-plugin
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  dependencies: ["database-plugin"], // Declare dependency
  async onInit(container) {
    // Dependencies auto-installed/activated first; onInit called in order
    console.log("Auth plugin initialized");
  },
};

// Register (order doesn't matter; Manager handles dependency order)
pluginManager.register(databasePlugin);
pluginManager.register(authPlugin);

// 1. Use bootstrap() for batch start
await pluginManager.bootstrap(); // Auto install, activate, trigger onInit in order

// 2. Manual install (auto-installs dependencies first)
await pluginManager.install("auth-plugin"); // database-plugin installed first
pluginManager.activate("database-plugin"); // Activate dependency first
pluginManager.activate("auth-plugin");
```

### Plugin Config

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Plugin with config
const cachePlugin = {
  name: "cache-plugin",
  version: "1.0.0",
  config: {
    maxSize: 1000,
    ttl: 3600,
    enabled: true,
  },
  // Config validator
  validateConfig(config) {
    return config.maxSize > 0 && config.ttl > 0;
  },
  // Config update hook (called on hot update)
  async onConfigUpdate(newConfig) {
    console.log("Config updated:", newConfig);
  },
  // Init hook
  async onInit(container) {
    const config = this.config || { maxSize: 1000, ttl: 3600 };
    console.log("Cache plugin init, config:", config);
  },
};

await pluginManager.use(cachePlugin);

// Get config
const config = pluginManager.getConfig("cache-plugin");
console.log(config); // { maxSize: 1000, ttl: 3600, enabled: true }

// Update config
pluginManager.setConfig("cache-plugin", {
  maxSize: 2000,
  ttl: 7200,
  enabled: true,
});

// Partial update
pluginManager.updateConfig("cache-plugin", {
  maxSize: 3000,
});
```

### Load from File

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Load from single file
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");

// Load all from directory
await pluginManager.loadFromDirectory("./plugins");
```

**Plugin file format** (`./plugins/auth-plugin.ts`):

```typescript
import type { Plugin } from "@dreamer/plugin";
import type { ServiceContainer } from "@dreamer/service";

const plugin: Plugin = {
  name: "auth-plugin",
  version: "1.0.0",
  // Init hook
  async onInit(container: ServiceContainer) {
    console.log("Auth plugin initialized");
  },
  // Request hook
  async onRequest(ctx) {
    // Check auth
    const token = ctx.headers.get("Authorization");
    if (!token && ctx.path.startsWith("/api/")) {
      return new Response("Unauthorized", { status: 401 });
    }
  },
};

export default plugin; // or export const plugin = { ... };
```

### Event System

#### Lifecycle Events

Plugin manager emits lifecycle events; listen with `on`:

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Listen to lifecycle events
pluginManager.on("plugin:registered", (name, plugin) => {
  console.log(`Plugin ${name} registered`);
});

pluginManager.on("plugin:installed", (name, plugin) => {
  console.log(`Plugin ${name} installed`);
});

pluginManager.on("plugin:activated", (name, plugin) => {
  console.log(`Plugin ${name} activated`);
});

pluginManager.on("plugin:error", (name, error) => {
  console.error(`Plugin ${name} error:`, error);
});

// Register and install
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
await pluginManager.activate("auth-plugin");
```

#### App-level Event Hooks

Plugins can implement app-level hooks for lifecycle and request handling:

```typescript
import type { Plugin } from "@dreamer/plugin";
import type { HttpContext } from "@dreamer/server";
import type { ServiceContainer } from "@dreamer/service";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",

  // App init complete (after all plugins installed/activated)
  async onInit(container: ServiceContainer) {
    console.log("App initialized");
  },

  // App start
  async onStart(container: ServiceContainer) {
    console.log("App started");
  },

  // Before request (access req, res)
  async onRequest(ctx: HttpContext, container: ServiceContainer) {
    console.log(`Request: ${ctx.method} ${ctx.path}`);
  },

  // After request
  async onResponse(ctx: HttpContext, container: ServiceContainer) {
    console.log(`Request done: ${ctx.method} ${ctx.path}`);
  },

  // Before build
  async onBuild(
    options: { mode: "dev" | "prod"; target?: "client" | "server" },
    container: ServiceContainer,
  ) {
    console.log(`Build start: ${options.mode}`);
  },

  // After build
  async onBuildComplete(
    result: {
      outputFiles?: string[];
      errors?: unknown[];
      warnings?: unknown[];
    },
    container: ServiceContainer,
  ) {
    console.log(`Build complete: ${result.outputFiles?.length || 0} files`);
  },

  // App stop
  async onStop(container: ServiceContainer) {
    console.log("App stopped");
  },

  // App shutdown
  async onShutdown(container: ServiceContainer) {
    console.log("App shutdown");
  },
};
```

**Supported hooks**:

| Hook | When | Returns |
|------|------|---------|
| **onInit** | App init complete | void |
| **onStart** | Server listening | void |
| **onStop** | Graceful stop | void |
| **onShutdown** | Final shutdown | void |
| **onRequest** | Before HTTP request | `Response \| void` |
| **onResponse** | After HTTP request | void |
| **onError** | On error | `Response \| void` |
| **onRoute** | Route registration | `RouteDefinition[]` |
| **onBuild** | Before build | void |
| **onBuildComplete** | After build | void |
| **onSocket** | Socket connect (WebSocket/Socket.IO) | void |
| **onSocketClose** | Socket close | void |
| **onHealthCheck** | Health check | `HealthStatus` |
| **onHotReload** | Hot reload (dev) | void |

**Manager trigger\* methods** (trigger hooks of all activated plugins):

```typescript
// App framework should call these at appropriate times
await pluginManager.triggerInit();      // After all plugins activated
await pluginManager.triggerStart();     // When server starts listening
await pluginManager.triggerStop();      // Graceful stop (reverse order)
await pluginManager.triggerShutdown();  // Final shutdown (reverse order)

// HTTP request lifecycle
const response = await pluginManager.triggerRequest(ctx);  // Return Response to skip
await pluginManager.triggerResponse(ctx);
const errorResponse = await pluginManager.triggerError(error, ctx);

// Route registration
const routes = await pluginManager.triggerRoute(initialRoutes);

// Build
await pluginManager.triggerBuild({ mode: "prod", target: "client" });
await pluginManager.triggerBuildComplete({ outputFiles: [...] });

// Socket (WebSocket or Socket.IO)
await pluginManager.triggerSocket(ctx);      // ctx: SocketContext
await pluginManager.triggerSocketClose(ctx);

// Health check
const status = await pluginManager.triggerHealthCheck();

// Hot reload
await pluginManager.triggerHotReload(["src/app.ts"]);
```

**Notes**:

1. Only **activated** plugins respond to app-level events
2. Hook errors are caught and logged (`continueOnError: true` doesn't affect others)
3. `onStop` and `onShutdown` run in reverse order
4. `onRequest` returning `Response` skips subsequent plugins
5. `onHealthCheck` aggregates all plugin health statuses
6. All hooks are optional
7. **Socket hooks must be triggered manually**: `@dreamer/dweb` has no built-in WebSocket/Socket.IO; implement and call `triggerSocket`/`triggerSocketClose` (see example below)

#### Socket Hook Manual Trigger Example

`@dreamer/dweb` has no built-in WebSocket. To use `onSocket`, create Socket.IO and trigger manually:

```typescript
import { Server } from "socket.io";
import type { Plugin, SocketContext } from "@dreamer/plugin";

// 1. Create Socket.IO plugin
export const socketIOPlugin: Plugin = {
  name: "socket-io",

  async onStart(container) {
    const pluginManager = container.get("plugin");
    const io = new Server(3001);

    io.on("connection", async (socket) => {
      // Build SocketContext
      const ctx: SocketContext = {
        type: "socket.io",
        socket,
        id: socket.id,
        handshake: socket.handshake,
      };

      // Manually trigger onSocket
      await pluginManager.triggerSocket(ctx);

      socket.on("disconnect", async () => {
        // Manually trigger onSocketClose
        await pluginManager.triggerSocketClose(ctx);
      });
    });

    // Register in container for other plugins
    container.registerSingleton("socketIO", () => io);
  },

  async onStop(container) {
    const io = container.get("socketIO");
    io?.close();
  },
};

// 2. Other plugins can respond to Socket events
export const chatPlugin: Plugin = {
  name: "chat",

  async onSocket(ctx, container) {
    console.log(`User connected: ${ctx.id}`);
    ctx.socket.on("message", (data) => {
      ctx.socket.broadcast.emit("message", data);
    });
  },

  async onSocketClose(ctx) {
    console.log(`User disconnected: ${ctx.id}`);
  },
};
```

### Hot Reload (Dev)

```typescript
import { PluginManager } from "@dreamer/plugin";

// Enable hot reload
const pluginManager = new PluginManager(container, {
  enableHotReload: true,
  hotReloadInterval: 1000, // Check every 1s
});

// Load from file (auto-watches for changes)
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");

// When file changes, plugin auto-reloads
// If activated, deactivates first, then re-installs and activates
```

### Debug Tools

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Register and install
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
await pluginManager.activate("auth-plugin");

// Get single plugin debug info
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

// Get all plugins debug info
const allDebugInfo = pluginManager.getDebugInfo();
console.log(allDebugInfo); // PluginDebugInfo[]

// Get dependency graph
const dependencyGraph = pluginManager.getDependencyGraph();
console.log(dependencyGraph);
// {
//   "auth-plugin": ["database-plugin"],
//   "database-plugin": [],
// }
```

### Error Isolation

```typescript
import { PluginManager } from "@dreamer/plugin";

// Configure error handling
const pluginManager = new PluginManager(container, {
  continueOnError: true, // Continue when hook errors
});

// Register plugin with error
const errorPlugin = {
  name: "error-plugin",
  version: "1.0.0",
  async onInit() {
    throw new Error("Init failed");
  },
};

// Register normal plugin
const normalPlugin = {
  name: "normal-plugin",
  version: "1.0.0",
  async onInit() {
    console.log("Normal plugin init success");
  },
};

await pluginManager.use(errorPlugin);
await pluginManager.use(normalPlugin);

// Trigger init (error-plugin fails, normal-plugin succeeds)
await pluginManager.triggerInit();

// Query error info
const debugInfo = pluginManager.getDebugInfo("error-plugin");
console.log(debugInfo.error); // Error: Init failed
```

---

## 📚 API Reference

### PluginManager Class

Plugin manager: registration, lifecycle, events.

#### Constructor

```typescript
new PluginManager(
  container: ServiceContainer,
  options?: PluginManagerOptions
)
```

Create a new plugin manager instance.

**Params**:

| Param | Type | Description |
|-------|------|--------------|
| `container` | `ServiceContainer` | Service container |
| `options` | `PluginManagerOptions` | Optional config |

**Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoActivate` | `boolean` | `false` | Auto-activate installed plugins |
| `continueOnError` | `boolean` | `true` | Continue when plugin errors |
| `enableHotReload` | `boolean` | `false` | Enable hot reload (dev) |
| `hotReloadInterval` | `number` | `1000` | Hot reload interval (ms) |
| `resourceLimits` | `ResourceLimits` | - | Resource limits (optional) |

**Example**:

```typescript
const pluginManager = new PluginManager(container, {
  autoActivate: true,
  enableHotReload: true,
});
```

#### Convenience Methods

| Method | Description |
|--------|-------------|
| `use(plugin)` | Auto register → install → activate |
| `bootstrap()` | Batch start all registered plugins |
| `shutdown()` | Graceful shutdown (reverse order) |

#### Lifecycle Methods

| Method | Description |
|--------|-------------|
| `register(plugin, options?)` | Register (options.replace to replace) |
| `install(name)` | Install (auto-resolve deps) |
| `activate(name)` | Activate (check deps) |
| `deactivate(name)` | Deactivate |
| `uninstall(name)` | Uninstall (auto cleanup) |

#### Query Methods

| Method | Description |
|--------|-------------|
| `getPlugin(name)` | Get plugin object |
| `getState(name)` | Get plugin state |
| `getRegisteredPlugins()` | Get all registered names |
| `getConfig(name)` | Get config |
| `getDebugInfo(name?)` | Get debug info |
| `getDependencyGraph()` | Get dependency graph |

#### Config Methods

| Method | Description |
|--------|-------------|
| `setConfig(name, config)` | Set config |
| `updateConfig(name, partial)` | Partial update |

#### Load Methods

| Method | Description |
|--------|-------------|
| `loadFromFile(path)` | Load from file |
| `loadFromDirectory(dir)` | Load from directory |

#### Event Methods

| Method | Description |
|--------|-------------|
| `on(event, listener)` | Add listener |
| `off(event, listener)` | Remove listener |
| `emit(event, ...args)` | Emit event |

#### Trigger Methods

| Method | Description |
|--------|-------------|
| `triggerInit()` | Trigger onInit |
| `triggerStart()` | Trigger onStart |
| `triggerStop()` | Trigger onStop (reverse) |
| `triggerShutdown()` | Trigger onShutdown (reverse) |
| `triggerRequest(ctx)` | Trigger onRequest |
| `triggerResponse(ctx)` | Trigger onResponse |
| `triggerError(error, ctx?)` | Trigger onError |
| `triggerRoute(routes)` | Trigger onRoute |
| `triggerBuild(options)` | Trigger onBuild |
| `triggerBuildComplete(result)` | Trigger onBuildComplete |
| `triggerSocket(ctx)` | Trigger onSocket |
| `triggerSocketClose(ctx)` | Trigger onSocketClose |
| `triggerHealthCheck()` | Trigger onHealthCheck |
| `triggerHotReload(files)` | Trigger onHotReload |

#### Other Methods

| Method | Description |
|--------|-------------|
| `validateDependencies(name?)` | Validate deps (circular/missing) |
| `stopHotReload()` | Stop hot reload |
| `dispose()` | Clean all resources |

### Plugin Interface

```typescript
interface Plugin<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
  // Required
  name: string;
  version: string;

  // Optional
  dependencies?: string[];
  config?: TConfig;
  validateConfig?: ConfigValidator<TConfig>;
  onConfigUpdate?: (newConfig: TConfig) => Promise<void> | void;

  // App-level hooks (optional, triggered by Manager.trigger*)
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

### PluginState Type

```typescript
type PluginState =
  | "registered"
  | "installed"
  | "active"
  | "inactive"
  | "uninstalled";
```

### Utility Functions

| Function | Description |
|----------|-------------|
| `detectCircularDependency(plugins)` | Detect circular deps |
| `detectMissingDependencies(plugins)` | Detect missing deps |
| `topologicalSort(plugins, names)` | Topological sort |
| `loadPluginFromFile(path)` | Load from file |

---

## 🔧 Advanced Config

### Resource Limits

```typescript
interface ResourceLimits {
  maxMemory?: number; // MB (optional)
  maxCpu?: number; // CPU % (optional)
  timeout?: number; // ms (optional)
}

const pluginManager = new PluginManager(container, {
  resourceLimits: {
    maxMemory: 512,
    timeout: 5000,
  },
});
```

### Plugin Replacement

```typescript
// Replace existing plugin with same name
pluginManager.register(newPlugin, { replace: true });

// Listen for replace event
pluginManager.on("plugin:replaced", (name, oldPlugin, newPlugin) => {
  console.log(`Plugin ${name} replaced`);
});
```

---

## 🚀 Performance

- **Dependency resolution**: Topological sort for load order
- **Error isolation**: Plugin errors don't affect others
- **Hot reload**: File watch for dev
- **Service management**: Auto cleanup on uninstall
- **Config cache**: Runtime config caching

---

## 📊 Test Report

| Metric | Value |
|--------|-------|
| Test date | 2026-01-30 |
| Test files | 12 |
| Total tests | 157 |
| Pass rate | 100% |
| Duration | ~6s |

**Coverage**:

- ✅ All public API methods (38)
- ✅ All app-level hooks (14)
- ✅ Edge cases (13)
- ✅ Error handling (10)
- ✅ use/bootstrap/shutdown
- ✅ Plugin replacement

See [TEST_REPORT.md](./TEST_REPORT.md) for details.

---

## 📝 Notes

1. **Service container**: Requires `@dreamer/service` ServiceContainer.

2. **State management**: State transitions must follow order (registered → installed → active → inactive → uninstalled); auto rollback on failure.

3. **Dependencies**: Auto-resolved on install; activation checks deps; circular/missing detected.

4. **Config**: Runtime overrides initial; validation and update hooks on change.

5. **Errors**: `continueOnError: true` (default) catches and logs; query via `getDebugInfo`; `plugin:error` emitted.

6. **Hot reload**: Dev only; file changes auto-reload; deactivate before reinstall.

7. **Service cleanup**: Auto-removed on uninstall.

8. **Type safety**: Full TypeScript support including generic config.

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

## 📄 License

MIT License - see [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
