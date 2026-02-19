# @dreamer/plugin

> A plugin management system compatible with Deno and Bun, providing complete
> plugin registration, lifecycle management, dependency resolution, config
> management, hot reload, and more.

> [English](./README.md) (root) | [中文 (Chinese)](./docs/zh-CN/README.md)

[![JSR](https://jsr.io/badges/@dreamer/plugin)](https://jsr.io/@dreamer/plugin)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests: 157 passed](https://img.shields.io/badge/Tests-157%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

**Changelog**: [English](./docs/en-US/CHANGELOG.md) |
[中文 (Chinese)](./docs/zh-CN/CHANGELOG.md)

### [1.0.1] - 2026-02-19

- **Changed**: i18n translation method `$t` → `$tr`; docs reorganized to
  `docs/en-US/` and `docs/zh-CN/`; license explicitly Apache-2.0.

---

## 🎯 Overview

A plugin management system for managing application plugins and extensions. The
plugin system relies on `@dreamer/service` to register services provided by
plugins, while keeping responsibilities separate: service handles service
management, plugin handles plugin lifecycle management.

**Design principle**: The Manager is responsible for plugin lifecycle management
(install, activate, deactivate, uninstall); plugins only need to implement event
response hooks (onInit, onRequest, etc.).

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

## 🌍 Environment compatibility

| Environment    | Version requirement              | Status                                                                                       |
| -------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| **Deno**       | 2.5+                             | ✅ Fully supported                                                                           |
| **Bun**        | 1.0+                             | ✅ Fully supported                                                                           |
| **Server**     | -                                | ✅ Supported (compatible with Deno and Bun runtimes; plugin system is a server-side pattern) |
| **Client**     | -                                | ❌ Not supported (browser environment; plugin system is a server-side concept)               |
| **Dependency** | `@dreamer/service@^1.0.0-beta.1` | 📦 Required for registering services provided by plugins                                     |

**Note**: @dreamer/plugin is a server-side-only package and does not provide a
client sub-package.

---

## ✨ Features

- **Plugin registration and loading**:
  - Manual registration of plugin objects
  - Load plugins from file (supports default export and named export)
  - Load plugins in batch from a directory
  - Plugin metadata management (name, version, dependencies, etc.)

- **Full lifecycle management** (Manager is responsible; plugins only respond to
  events):
  - install: update state, resolve dependencies
  - activate: update state, check dependencies
  - deactivate: update state
  - uninstall: update state, clean up resources
  - State management and transition validation
  - Convenience methods: use(), bootstrap(), shutdown()
  - Plugin replacement: register({ replace: true })

- **Dependency management**:
  - Plugin dependency declaration
  - Topological sort (automatically compute load order)
  - Circular dependency detection
  - Missing dependency detection
  - Dependency validation utilities

- **Config management**:
  - Plugin config storage (runtime config overrides initial config)
  - Config validation (optional validation function)
  - Config hot update (update config at runtime)
  - Config update hook (onConfigUpdate)

- **Event system**:
  - Lifecycle events (plugin:registered, plugin:installed, plugin:activated,
    etc.)
  - Application-level event hooks (full list below)
  - Manager provides trigger* methods to invoke hooks of all activated plugins
  - Custom event support
  - Event pub/sub pattern
  - Multiple listener support

- **Application-level event hooks** (plugins only need to implement these hooks;
  Manager is responsible for triggering):
  - **Lifecycle**: onInit, onStart, onStop, onShutdown
  - **HTTP request**: onRequest, onResponse, onError
  - **Routing**: onRoute (dynamically modify routes)
  - **Build**: onBuild, onBuildComplete
  - **Socket**: onSocket, onSocketClose (supports both WebSocket and Socket.IO)
  - **Health check**: onHealthCheck
  - **Hot reload**: onHotReload (development only)

- **Error isolation**:
  - Plugin errors do not affect other plugins
  - Error logging and reporting
  - Error event emission (plugin:error)
  - Error info query

- **Development support**:
  - Plugin hot reload (development; watch file changes)
  - Plugin debugging utilities (getDebugInfo, getDependencyGraph)
  - Resource limit interface (interface defined)

- **Adapter pattern**:
  - Unified plugin interface (Plugin)
  - Switch plugins at runtime
  - Automatic plugin service management

---

## 🎯 Use cases

- **Application feature extension**: Extend application features via the plugin
  system
- **Modular architecture**: Split the application into multiple plugin modules
- **Third-party plugin integration**: Integrate plugins developed by third
  parties
- **Plugin-based application development**: Build a pluggable application
  architecture
- **Microservice plugin management**: Manage plugin components in microservices
- **Development hot reload**: Automatically reload plugins during development

---

## 🚀 Quick start

### Basic usage

```typescript
import { ServiceContainer } from "@dreamer/service";
import { PluginManager } from "@dreamer/plugin";

// Create service container
const container = new ServiceContainer();

// Create plugin manager
const pluginManager = new PluginManager(container);

// Define plugin (only need to implement event hooks; no lifecycle hooks required)
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  // Init hook (invoked when application starts)
  async onInit(container) {
    console.log("Auth plugin initialized");
  },
  // Request handling hook
  async onRequest(ctx) {
    // Check authentication
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

// Option 1: Use convenience method (recommended)
await pluginManager.use(authPlugin); // auto register → install → activate

// Trigger application init
await pluginManager.triggerInit();

// Graceful shutdown
await pluginManager.shutdown();
```

### Manual lifecycle management

```typescript
// Option 2: Manual lifecycle management (for fine-grained control)
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
pluginManager.activate("auth-plugin");

// Trigger application init
await pluginManager.triggerInit();

// Deactivate and uninstall
pluginManager.deactivate("auth-plugin");
await pluginManager.uninstall("auth-plugin");
```

---

## 🎨 Usage examples

### Plugin dependency management

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

// Define plugin that depends on database-plugin
const authPlugin = {
  name: "auth-plugin",
  version: "1.0.0",
  dependencies: ["database-plugin"], // Declare dependency
  async onInit(container) {
    // Dependency plugins are installed and activated first; onInit is called in dependency order
    console.log("Auth plugin initialized");
  },
};

// Register plugins (order does not matter; Manager handles dependency order)
pluginManager.register(databasePlugin);
pluginManager.register(authPlugin);

// Option 1: Use bootstrap() for batch startup
await pluginManager.bootstrap(); // Auto install, activate, trigger onInit in dependency order

// Option 2: Manual install (dependencies are installed first)
await pluginManager.install("auth-plugin"); // database-plugin is installed first
pluginManager.activate("database-plugin"); // Must activate dependency first
pluginManager.activate("auth-plugin");
```

### Plugin config management

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Define plugin with config
const cachePlugin = {
  name: "cache-plugin",
  version: "1.0.0",
  config: {
    maxSize: 1000,
    ttl: 3600,
    enabled: true,
  },
  // Config validation function
  validateConfig(config) {
    return config.maxSize > 0 && config.ttl > 0;
  },
  // Config update hook (invoked when config is hot-updated)
  async onConfigUpdate(newConfig) {
    console.log("Config updated:", newConfig);
    // Can re-initialize services here
  },
  // Init hook
  async onInit(container) {
    const config = this.config || { maxSize: 1000, ttl: 3600 };
    console.log("Cache plugin initialized, config:", config);
  },
};

await pluginManager.use(cachePlugin);

// Get plugin config
const config = pluginManager.getConfig("cache-plugin");
console.log(config); // { maxSize: 1000, ttl: 3600, enabled: true }

// Update plugin config
pluginManager.setConfig("cache-plugin", {
  maxSize: 2000,
  ttl: 7200,
  enabled: true,
});

// Partial config update
pluginManager.updateConfig("cache-plugin", {
  maxSize: 3000,
});
```

### Load plugin from file

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Load plugin from single file
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");

// Load all plugins from directory
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
  // Request handling hook
  async onRequest(ctx) {
    // Check authentication
    const token = ctx.headers.get("Authorization");
    if (!token && ctx.path.startsWith("/api/")) {
      return new Response("Unauthorized", { status: 401 });
    }
  },
};

export default plugin; // or export const plugin = { ... };
```

### Event system

#### Plugin lifecycle events

The plugin manager emits lifecycle events; you can listen via the `on` method:

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

// Register and install plugin
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
await pluginManager.activate("auth-plugin");
```

#### Application-level event hooks

Plugins can implement application-level event hooks to respond to application
lifecycle and request handling:

```typescript
import type { Plugin } from "@dreamer/plugin";
import type { HttpContext } from "@dreamer/server";
import type { ServiceContainer } from "@dreamer/service";

const myPlugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",

  // Application init complete (after all plugins are installed and activated)
  async onInit(container: ServiceContainer) {
    console.log("Application initialized");
  },

  // When application starts
  async onStart(container: ServiceContainer) {
    console.log("Application started");
  },

  // Before request handling (can access req, res)
  async onRequest(ctx: HttpContext, container: ServiceContainer) {
    console.log(`Request received: ${ctx.method} ${ctx.path}`);
    // Can access ctx.request, ctx.response, ctx.headers, etc.
  },

  // After request handling (can access req, res)
  async onResponse(ctx: HttpContext, container: ServiceContainer) {
    console.log(`Request completed: ${ctx.method} ${ctx.path}`);
    // Can access ctx.response, etc.
  },

  // Before build starts
  async onBuild(
    options: { mode: "dev" | "prod"; target?: "client" | "server" },
    container: ServiceContainer,
  ) {
    console.log(`Build starting: ${options.mode}`);
  },

  // After build completes
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

  // When application stops
  async onStop(container: ServiceContainer) {
    console.log("Application stopped");
  },

  // When application shuts down
  async onShutdown(container: ServiceContainer) {
    console.log("Application shut down");
  },
};
```

**Supported event hooks**:

| Hook                | When triggered                                       | Return value                                                  |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| **onInit**          | Application init complete (after all plugins active) | void                                                          |
| **onStart**         | Application server starts listening                  | void                                                          |
| **onStop**          | Application graceful stop                            | void                                                          |
| **onShutdown**      | Application final shutdown                           | void                                                          |
| **onRequest**       | Before HTTP request handling                         | `Response \| void` (return Response to skip further handling) |
| **onResponse**      | After HTTP request handling                          | void                                                          |
| **onError**         | When an error occurs                                 | `Response \| void` (return custom error response)             |
| **onRoute**         | When routes are registered                           | `RouteDefinition[]` (modified route list)                     |
| **onBuild**         | Before build starts                                  | void                                                          |
| **onBuildComplete** | After build completes                                | void                                                          |
| **onSocket**        | Socket connection established (WebSocket/Socket.IO)  | void                                                          |
| **onSocketClose**   | Socket connection closed                             | void                                                          |
| **onHealthCheck**   | When health check runs                               | `HealthStatus`                                                |
| **onHotReload**     | Hot reload complete (development)                    | void                                                          |

**Manager trigger\* methods** (invoke hooks of all activated plugins):

```typescript
// Application framework should call these at the appropriate time
await pluginManager.triggerInit();      // After all plugins activated
await pluginManager.triggerStart();     // When server starts listening
await pluginManager.triggerStop();      // On graceful stop (reverse order)
await pluginManager.triggerShutdown(); // On final shutdown (reverse order)

// HTTP request lifecycle
const response = await pluginManager.triggerRequest(ctx);  // If Response returned, skip rest
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

1. Only **activated** plugins respond to application-level events
2. Errors in event hooks are caught and logged (when `continueOnError: true`,
   other plugins are not affected)
3. `onStop` and `onShutdown` run in reverse order (last activated stops first)
4. When `onRequest` returns a `Response`, subsequent plugins' `onRequest` are
   not run
5. `onHealthCheck` aggregates health status from all plugins
6. All event hooks are optional; plugins may implement only the events they need
7. **Socket hooks must be triggered manually**: the `@dreamer/dweb` framework no
   longer bundles WebSocket/Socket.IO support; you must implement it and call
   `triggerSocket`/`triggerSocketClose` yourself (see example below)

#### Socket hook manual trigger example

The `@dreamer/dweb` framework has removed built-in WebSocket support. To use the
`onSocket` hook, you need to create your own Socket.IO server and trigger it
manually:

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

      // Manually trigger onSocket hook
      await pluginManager.triggerSocket(ctx);

      socket.on("disconnect", async () => {
        // Manually trigger onSocketClose hook
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

### Hot reload (development)

```typescript
import { PluginManager } from "@dreamer/plugin";

// Enable hot reload
const pluginManager = new PluginManager(container, {
  enableHotReload: true,
  hotReloadInterval: 1000, // Check every 1 second
});

// Load plugin from file (will watch for file changes)
await pluginManager.loadFromFile("./plugins/auth-plugin.ts");

// When file changes, plugin is reloaded automatically
// If plugin was active, it is deactivated first, then reinstalled and activated
```

### Debug utilities

```typescript
import { PluginManager } from "@dreamer/plugin";

const pluginManager = new PluginManager(container);

// Register and install plugin
pluginManager.register(authPlugin);
await pluginManager.install("auth-plugin");
await pluginManager.activate("auth-plugin");

// Get debug info for a single plugin
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

// Get debug info for all plugins
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

### Error isolation

```typescript
import { PluginManager } from "@dreamer/plugin";

// Configure error handling options
const pluginManager = new PluginManager(container, {
  continueOnError: true, // When event hook errors, continue with other plugins
});

// Register plugin that throws
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
    console.log("Normal plugin initialized");
  },
};

await pluginManager.use(errorPlugin);
await pluginManager.use(normalPlugin);

// Trigger init (error-plugin fails, but normal-plugin succeeds)
await pluginManager.triggerInit();

// Query error info
const debugInfo = pluginManager.getDebugInfo("error-plugin");
console.log(debugInfo.error); // Error: Init failed
```

---

## 📚 API reference

### PluginManager class

Plugin manager class; provides plugin registration, lifecycle management, event
system, etc.

#### Constructor

```typescript
new PluginManager(
  container: ServiceContainer,
  options?: PluginManagerOptions
)
```

Creates a new plugin manager instance.

**Parameters**:

| Parameter   | Type                   | Description                                                  |
| ----------- | ---------------------- | ------------------------------------------------------------ |
| `container` | `ServiceContainer`     | Service container instance (for registering plugin services) |
| `options`   | `PluginManagerOptions` | Optional configuration                                       |

**Options**:

| Option              | Type             | Default | Description                                |
| ------------------- | ---------------- | ------- | ------------------------------------------ |
| `autoActivate`      | `boolean`        | `false` | Whether to auto-activate installed plugins |
| `continueOnError`   | `boolean`        | `true`  | Whether to continue when a plugin errors   |
| `enableHotReload`   | `boolean`        | `false` | Whether to enable hot reload (development) |
| `hotReloadInterval` | `number`         | `1000`  | Hot reload watch interval (ms)             |
| `resourceLimits`    | `ResourceLimits` | -       | Resource limits (optional)                 |

**Example**:

```typescript
const pluginManager = new PluginManager(container, {
  autoActivate: true,
  enableHotReload: true,
});
```

#### Convenience methods

| Method        | Description                                                                  |
| ------------- | ---------------------------------------------------------------------------- |
| `use(plugin)` | Auto register → install → activate plugin                                    |
| `bootstrap()` | Start all registered plugins in dependency order                             |
| `shutdown()`  | Gracefully shut down all plugins (deactivate and uninstall in reverse order) |

#### Lifecycle methods

| Method                       | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `register(plugin, options?)` | Register plugin (options.replace to replace existing) |
| `install(name)`              | Install plugin (resolves dependencies)                |
| `activate(name)`             | Activate plugin (checks dependencies are active)      |
| `deactivate(name)`           | Deactivate plugin                                     |
| `uninstall(name)`            | Uninstall plugin (auto cleans up services)            |

#### Query methods

| Method                   | Description                     |
| ------------------------ | ------------------------------- |
| `getPlugin(name)`        | Get plugin object               |
| `getState(name)`         | Get plugin state                |
| `getRegisteredPlugins()` | Get all registered plugin names |
| `getConfig(name)`        | Get plugin config               |
| `getDebugInfo(name?)`    | Get plugin debug info           |
| `getDependencyGraph()`   | Get dependency graph            |

#### Config methods

| Method                        | Description                    |
| ----------------------------- | ------------------------------ |
| `setConfig(name, config)`     | Set plugin config              |
| `updateConfig(name, partial)` | Partially update plugin config |

#### Load methods

| Method                   | Description                     |
| ------------------------ | ------------------------------- |
| `loadFromFile(path)`     | Load plugin from file           |
| `loadFromDirectory(dir)` | Load all plugins from directory |

#### Event methods

| Method                 | Description             |
| ---------------------- | ----------------------- |
| `on(event, listener)`  | Register event listener |
| `off(event, listener)` | Remove event listener   |
| `emit(event, ...args)` | Emit event              |

#### Trigger methods (invoke hooks of activated plugins)

| Method                         | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `triggerInit()`                | Trigger onInit hook                         |
| `triggerStart()`               | Trigger onStart hook                        |
| `triggerStop()`                | Trigger onStop hook (reverse order)         |
| `triggerShutdown()`            | Trigger onShutdown hook (reverse order)     |
| `triggerRequest(ctx)`          | Trigger onRequest hook                      |
| `triggerResponse(ctx)`         | Trigger onResponse hook                     |
| `triggerError(error, ctx?)`    | Trigger onError hook                        |
| `triggerRoute(routes)`         | Trigger onRoute hook                        |
| `triggerBuild(options)`        | Trigger onBuild hook                        |
| `triggerBuildComplete(result)` | Trigger onBuildComplete hook                |
| `triggerSocket(ctx)`           | Trigger onSocket hook (WebSocket/Socket.IO) |
| `triggerSocketClose(ctx)`      | Trigger onSocketClose hook                  |
| `triggerHealthCheck()`         | Trigger onHealthCheck hook                  |
| `triggerHotReload(files)`      | Trigger onHotReload hook                    |

#### Other methods

| Method                        | Description                           |
| ----------------------------- | ------------------------------------- |
| `validateDependencies(name?)` | Validate dependencies (cycle/missing) |
| `stopHotReload()`             | Stop hot reload                       |
| `dispose()`                   | Clean up all resources                |

### Plugin interface

Plugin interface; defines the basic shape and event hooks of a plugin.

```typescript
interface Plugin<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
  // Required
  name: string; // Plugin name (unique id)
  version: string; // Plugin version

  // Optional
  dependencies?: string[]; // Plugin dependency list
  config?: TConfig; // Initial plugin config
  validateConfig?: ConfigValidator<TConfig>; // Config validation function
  onConfigUpdate?: (newConfig: TConfig) => Promise<void> | void; // Config update hook

  // Application-level event hooks (optional; triggered by Manager.trigger*)
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

### PluginState type

Plugin state type.

```typescript
type PluginState =
  | "registered" // Registered
  | "installed" // Installed
  | "active" // Active
  | "inactive" // Inactive
  | "uninstalled"; // Uninstalled
```

### Utility functions

| Function                             | Description                   |
| ------------------------------------ | ----------------------------- |
| `detectCircularDependency(plugins)`  | Detect circular dependencies  |
| `detectMissingDependencies(plugins)` | Detect missing dependencies   |
| `topologicalSort(plugins, names)`    | Topological sort (load order) |
| `loadPluginFromFile(path)`           | Load plugin from file         |

---

## 🔧 Advanced configuration

### Resource limits

```typescript
interface ResourceLimits {
  maxMemory?: number; // Memory limit (MB, optional)
  maxCpu?: number; // CPU limit (%, optional)
  timeout?: number; // Timeout (ms, optional)
}

const pluginManager = new PluginManager(container, {
  resourceLimits: {
    maxMemory: 512,
    timeout: 5000,
  },
});
```

### Plugin replacement

```typescript
// Use replace option to replace existing plugin with same name
pluginManager.register(newPlugin, { replace: true });

// Listen for replace event
pluginManager.on("plugin:replaced", (name, oldPlugin, newPlugin) => {
  console.log(`Plugin ${name} replaced`);
});
```

---

## 🚀 Performance

- **Dependency resolution**: Topological sort for optimal load order
- **Error isolation**: Plugin errors do not affect other plugins; improves
  stability
- **Hot reload**: Development supports file watching and auto plugin reload
- **Service management**: Auto management of plugin-registered services; cleanup
  on uninstall
- **Config cache**: Runtime config cached to reduce repeated computation

---

## 📊 Test report

| Metric      | Value      |
| ----------- | ---------- |
| Test date   | 2026-01-30 |
| Test files  | 12         |
| Total cases | 157        |
| Pass rate   | 100%       |
| Duration    | ~6s        |

**Coverage**:

- ✅ All public API methods (38)
- ✅ All application-level event hooks (14)
- ✅ Edge cases (13)
- ✅ Error handling (10)
- ✅ Convenience methods (use/bootstrap/shutdown)
- ✅ Plugin replacement

Full test report: [TEST_REPORT.md](./docs/en-US/TEST_REPORT.md).

---

## 📝 Notes

1. **Service container dependency**: The plugin system depends on
   `@dreamer/service` to register services provided by plugins; a
   ServiceContainer instance must be provided.

2. **Plugin state management**: Plugin state transitions must follow the order
   (registered → installed → active → inactive → uninstalled); failed
   transitions are rolled back automatically.

3. **Dependency management**:
   - Plugin dependencies are resolved and installed automatically on install
   - Activating a plugin checks that its dependencies are already active
   - Circular and missing dependencies are detected and an error is thrown

4. **Config management**:
   - Runtime config overrides initial plugin config
   - Config updates trigger validation and update hooks
   - Validation failure throws an error

5. **Error handling**:
   - By default (`continueOnError: true`), plugin errors are caught and logged
     and do not affect other plugins
   - Error info can be queried via `getDebugInfo`
   - Errors emit the `plugin:error` event

6. **Hot reload**:
   - For development only; not recommended in production
   - Plugins are reloaded automatically when files change
   - Active plugins are deactivated first, then reinstalled and activated

7. **Service cleanup**: Uninstalling a plugin automatically removes all services
   it registered; no manual cleanup needed.

8. **Type safety**: Full TypeScript types, including generic config types.

---

## 🤝 Contributing

Issues and Pull Requests are welcome.

---

## 📄 License

Apache License 2.0 - see [LICENSE](./LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
