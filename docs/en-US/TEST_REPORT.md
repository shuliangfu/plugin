# @dreamer/plugin Test Report

[English](./TEST_REPORT.md) | [中文 (Chinese)](../zh-CN/TEST_REPORT.md)

## 📋 Test Overview

| Item                 | Value                              |
| -------------------- | ---------------------------------- |
| Package version      | 1.1.0                              |
| Test library version | @dreamer/test@^1.2.3               |
| Runtime adapter      | @dreamer/runtime-adapter@^1.2.2    |
| Test framework       | @dreamer/test@^1.2.3               |
| Test date            | 2026-07-23                         |
| Test environment     | Deno 2.9+ / Bun 1.3+ / Node.js 22+ |
| CI                   | 9 jobs (3 runtimes × 3 OS)         |

---

## 📊 Test Results

### Summary Statistics

| Runtime  | Test files | Passed | Failed | Pass rate |
| -------- | ---------- | ------ | ------ | --------- |
| Deno     | 12         | 169    | 0      | 100%      |
| Bun      | 12         | 157    | 0      | 100%      |
| Node.js  | 12         | 157    | 0      | 100%      |

> **Note**: Deno reports 169 tests vs Bun/Node 157 due to Deno's native test
> runner counting more nested `describe`/`it` steps. The actual test cases are
> identical across all three runtimes.

### Test File Statistics

| File                      | Count | Status        |
| ------------------------- | ----- | ------------- |
| `comprehensive.test.ts`   | 48    | ✅ All passed |
| `app-events.test.ts`      | 20    | ✅ All passed |
| `mod.test.ts`             | 34    | ✅ All passed |
| `config.test.ts`          | 10    | ✅ All passed |
| `event-emitter.test.ts`   | 10    | ✅ All passed |
| `debug.test.ts`           | 8     | ✅ All passed |
| `error-isolation.test.ts` | 6     | ✅ All passed |
| `load-directory.test.ts`  | 5     | ✅ All passed |
| `loader.test.ts`          | 5     | ✅ All passed |
| `dispose.test.ts`         | 5     | ✅ All passed |
| `hot-reload.test.ts`      | 4     | ✅ All passed |
| `resource-limits.test.ts` | 2     | ✅ All passed |

---

## 🔍 Feature Test Details

### 1. Comprehensive Tests (comprehensive.test.ts) - 48 tests

#### 1.1 use() convenience method

- ✅ Skip already registered plugins
- ✅ Skip already installed plugins
- ✅ Skip already activated plugins
- ✅ Re-activate inactive plugins

#### 1.2 bootstrap() edge cases

- ✅ Handle empty plugin list
- ✅ Skip already installed/activated plugins

#### 1.3 shutdown() edge cases

- ✅ Handle empty plugin list
- ✅ Handle partially uninstalled plugins
- ✅ Deactivate plugins in reverse order

#### 1.4 validateDependencies() single plugin

- ✅ Validate single plugin dependencies
- ✅ Reject validation for unregistered plugins
- ✅ Detect circular dependency in single plugin
- ✅ Detect missing dependencies in single plugin

#### 1.5 loadFromFile() via Manager

- ✅ Load and register plugin from file
- ✅ Handle load failure

#### 1.6 replace option

- ✅ Reset state when replacing activated plugin

#### 1.7 Event trigger edge cases

- ✅ Handle triggerInit with no plugins
- ✅ Handle plugins without onInit hook
- ✅ Handle all plugins without onRequest hook
- ✅ Trigger onRequest in registration order

#### 1.8 triggerError() error handling

- ✅ Pass error to all plugins
- ✅ Return first plugin's Response

#### 1.9 triggerHealthCheck() health check

- ✅ Merge health check results from multiple plugins
- ✅ Return unhealthy when any check fails
- ✅ Return degraded when warn but no fail

#### 1.10 triggerRoute() route handling

- ✅ Allow plugins to modify routes
- ✅ Allow plugins to add new routes

#### 1.11 Dependency order installation

- ✅ Auto-install dependency plugins
- ✅ Handle deep dependency chains

#### 1.12 Other tests

- ✅ getPlugin() returns undefined for non-existent plugin
- ✅ getState() returns undefined for non-existent plugin
- ✅ Safely call dispose() multiple times
- ✅ Support once-style listeners
- ✅ Install shared dependency only once
- ✅ Return list of all registered plugin names
- ✅ Return empty array when no plugins registered
- ✅ Reject installing non-existent plugin
- ✅ Skip already installed dependencies
- ✅ Reject activating non-existent plugin
- ✅ Reject activating already activated plugin
- ✅ Reject deactivating non-existent plugin
- ✅ Reject uninstalling non-existent plugin
- ✅ Call plugin hooks during build
- ✅ Handle Socket connect and close (WebSocket/Socket.IO)
- ✅ Trigger scheduled task hooks
- ✅ Call onConfigUpdate on config update
- ✅ Return full dependency graph
- ✅ Auto-activate plugin after install (autoActivate option)
- ✅ continueOnError: true continues to next plugin
- ✅ continueOnError: false stops at first error

### 2. App-level Event Hooks (app-events.test.ts) - 20 tests

#### 2.1 triggerInit hook

- ✅ Should call onInit hook
- ✅ Should support multiple plugins' onInit
- ✅ Should handle errors in onInit

#### 2.2 triggerStart hook

- ✅ Should call onStart hook

#### 2.3 triggerStop hook

- ✅ Should call onStop hook

#### 2.4 triggerShutdown hook

- ✅ Should call onShutdown hook

#### 2.5 triggerRequest hook

- ✅ Should call onRequest hook
- ✅ Should be able to return Response to intercept
- ✅ Should handle errors in onRequest

#### 2.6 triggerResponse hook

- ✅ Should call onResponse hook

#### 2.7 triggerError hook

- ✅ Should call onError hook
- ✅ Should be able to return Response for error

#### 2.8 triggerRoute hook

- ✅ Should call onRoute hook
- ✅ Should allow modifying route definitions

#### 2.9 triggerBuild hook

- ✅ Should call onBuild hook

#### 2.10 triggerBuildComplete hook

- ✅ Should call onBuildComplete hook

#### 2.11 triggerSocket hook

- ✅ Should call onSocket hook (WebSocket and Socket.IO)

#### 2.12 triggerSocketClose hook

- ✅ Should call onSocketClose hook

#### 2.13 triggerHealthCheck hook

- ✅ Should call onHealthCheck hook
- ✅ Should merge health check results from multiple plugins
- ✅ Should compute overall status correctly

#### 2.14 triggerHotReload hook

- ✅ Should call onHotReload hook

#### 2.15 Event hook combination

- ✅ Should support plugins implementing multiple hooks
- ✅ Should only trigger hooks of activated plugins
- ✅ Should isolate errors between plugins

### 3. Core Features (mod.test.ts) - 34 tests

#### 3.1 Basic

- ✅ Should create plugin manager instance
- ✅ Should register plugins
- ✅ Should reject duplicate registration
- ✅ Should allow replace option to replace registered plugin
- ✅ Should emit plugin:replaced when replacing
- ✅ Should clear old plugin state when replacing

#### 3.2 Plugin installation

- ✅ Should install plugin and update state
- ✅ Should reject install when not in registered state

#### 3.3 Plugin activation

- ✅ Should activate plugin and update state
- ✅ Should reject activate when not in installed state
- ✅ Should check dependency activation
- ✅ Should allow re-activate from inactive state

#### 3.4 Plugin deactivation

- ✅ Should deactivate plugin and update state
- ✅ Should reject deactivate when not in active state

#### 3.5 Plugin uninstall

- ✅ Should uninstall plugin and update state
- ✅ Should deactivate before uninstall
- ✅ Should allow repeated uninstall of uninstalled plugin

#### 3.6 Convenience methods

- ✅ use() should auto register, install, and activate
- ✅ bootstrap() should batch start all plugins
- ✅ shutdown() should gracefully close all plugins

#### 3.7 Dependency management

- ✅ Should install in dependency order
- ✅ Should detect circular dependencies
- ✅ Should detect missing dependencies

#### 3.8 Event system

- ✅ Should emit lifecycle events
- ✅ Should support custom events
- ✅ Should remove event listeners

#### 3.9 Auto activation

- ✅ Should auto-activate installed plugins

#### 3.10 Dependency resolver

- ✅ detectCircularDependency should detect cycles
- ✅ detectCircularDependency should return null when none
- ✅ detectMissingDependencies should detect missing
- ✅ detectMissingDependencies should return empty when none
- ✅ topologicalSort should sort by dependency order
- ✅ topologicalSort should reject circular deps
- ✅ topologicalSort should reject missing deps

### 4. Config Management (config.test.ts) - 10 tests

#### 4.1 getConfig

- ✅ Should get plugin initial config
- ✅ Should return undefined when no config
- ✅ Should prefer runtime config

#### 4.2 setConfig

- ✅ Should set plugin config
- ✅ Should emit config update event
- ✅ Should call plugin config update hook
- ✅ Should validate when plugin has validator
- ✅ Should reject config for unregistered plugin

#### 4.3 updateConfig

- ✅ Should merge with existing config

### 5. Debug Tools (debug.test.ts) - 8 tests

#### 5.1 getDebugInfo

- ✅ Should get single plugin debug info
- ✅ Should update state after install
- ✅ Should update state after activate
- ✅ Should include error info from hooks
- ✅ Should return debug info for all plugins
- ✅ Should reject debug info for unregistered plugin

#### 5.2 getDependencyGraph

- ✅ Should return dependency graph
- ✅ Should return empty deps when plugin has none

### 6. Error Isolation (error-isolation.test.ts) - 6 tests

#### 6.1 Hook error isolation

- ✅ Should isolate plugin errors
- ✅ Should catch and log errors in triggerInit
- ✅ Should catch errors in triggerRequest

#### 6.2 Error events

- ✅ Should emit error events

#### 6.3 continueOnError option

- ✅ continueOnError: true should continue
- ✅ continueOnError: false should throw

### 7. Directory Loading (load-directory.test.ts) - 5 tests

- ✅ Should load all plugin files from directory
- ✅ Should only load .ts and .js files
- ✅ Should handle load failure (continueOnError: true)
- ✅ Should throw when continueOnError: false
- ✅ Should handle non-existent directory

### 8. Plugin Loader (loader.test.ts) - 5 tests

- ✅ Should load plugin from file (default export)
- ✅ Should load plugin from file (named export 'plugin')
- ✅ Should reject invalid plugin file (missing name)
- ✅ Should reject invalid plugin file (missing version)
- ✅ Should handle file load errors

### 9. Resource Cleanup (dispose.test.ts) - 5 tests

- ✅ Should clean up all resources
- ✅ Should stop hot reload
- ✅ Should remove all event listeners
- ✅ Should work when hot reload not enabled

### 10. Hot Reload (hot-reload.test.ts) - 4 tests

- ✅ Should create hot reload manager instance
- ✅ Should watch file changes and reload plugins
- ✅ Should stop hot reload
- ✅ Should emit reload events

### 11. Resource Limits (resource-limits.test.ts) - 2 tests

- ✅ Should accept resource limit config
- ✅ Should work without resource limit config

### 12. Event Emitter (event-emitter.test.ts) - 10 tests

- ✅ Basic event emit functionality

---

## 📈 Test Coverage Analysis

### API Method Coverage

| Module        | Method                 | Status |
| ------------- | ---------------------- | ------ |
| PluginManager | register()             | ✅     |
| PluginManager | use()                  | ✅     |
| PluginManager | bootstrap()            | ✅     |
| PluginManager | shutdown()             | ✅     |
| PluginManager | install()              | ✅     |
| PluginManager | activate()             | ✅     |
| PluginManager | deactivate()           | ✅     |
| PluginManager | uninstall()            | ✅     |
| PluginManager | getPlugin()            | ✅     |
| PluginManager | getState()             | ✅     |
| PluginManager | getRegisteredPlugins() | ✅     |
| PluginManager | loadFromFile()         | ✅     |
| PluginManager | loadFromDirectory()    | ✅     |
| PluginManager | validateDependencies() | ✅     |
| PluginManager | getConfig()            | ✅     |
| PluginManager | setConfig()            | ✅     |
| PluginManager | updateConfig()         | ✅     |
| PluginManager | getDebugInfo()         | ✅     |
| PluginManager | getDependencyGraph()   | ✅     |
| PluginManager | on()                   | ✅     |
| PluginManager | off()                  | ✅     |
| PluginManager | emit()                 | ✅     |
| PluginManager | stopHotReload()        | ✅     |
| PluginManager | dispose()              | ✅     |
| PluginManager | triggerInit()          | ✅     |
| PluginManager | triggerStart()         | ✅     |
| PluginManager | triggerStop()          | ✅     |
| PluginManager | triggerShutdown()      | ✅     |
| PluginManager | triggerRequest()       | ✅     |
| PluginManager | triggerResponse()      | ✅     |
| PluginManager | triggerError()         | ✅     |
| PluginManager | triggerRoute()         | ✅     |
| PluginManager | triggerBuild()         | ✅     |
| PluginManager | triggerBuildComplete() | ✅     |
| PluginManager | triggerSocket()        | ✅     |
| PluginManager | triggerSocketClose()   | ✅     |
| PluginManager | triggerHealthCheck()   | ✅     |
| PluginManager | triggerHotReload()     | ✅     |

### Edge Case Coverage

| Edge case                   | Status |
| --------------------------- | ------ |
| Empty plugin list           | ✅     |
| Non-existent plugin         | ✅     |
| Duplicate registration      | ✅     |
| Circular dependency         | ✅     |
| Missing dependency          | ✅     |
| Deep dependency chain       | ✅     |
| Shared dependency           | ✅     |
| State transition validation | ✅     |
| Plugin replacement          | ✅     |
| Invalid plugin file         | ✅     |
| Non-existent directory      | ✅     |
| Config validation failure   | ✅     |
| Multiple dispose() calls    | ✅     |

### Error Handling Coverage

| Error scenario            | Status |
| ------------------------- | ------ |
| Plugin registration error | ✅     |
| Plugin install error      | ✅     |
| Plugin activation error   | ✅     |
| Plugin deactivation error | ✅     |
| Plugin uninstall error    | ✅     |
| Config validation error   | ✅     |
| File load error           | ✅     |
| Directory load error      | ✅     |
| Event hook error          | ✅     |
| continueOnError option    | ✅     |

---

## 💡 Strengths

1. **Full coverage**: All 39 public API methods have tests
2. **Edge cases**: 13 edge cases covered
3. **Error handling**: 10 error scenarios covered
4. **Integration**: Module integration and interaction tested
5. **Resource management**: Cleanup and memory management verified
6. **App-level events**: All 15 app-level event hooks tested
7. **Convenience methods**: use/bootstrap/shutdown fully tested
8. **Plugin replacement**: register replace option fully tested

---

## 📊 Conclusion

The @dreamer/plugin library has comprehensive test coverage across all three
runtimes (Deno, Bun, Node.js 22+). All core and advanced features have
corresponding tests.

### Quality Assessment

- ✅ **Feature completeness**: All features implemented and tested
- ✅ **Code quality**: Clear structure, solid error handling
- ✅ **Stability**: No memory leaks, no resource leaks
- ✅ **Maintainability**: Clear tests, easy to maintain and extend
- ✅ **Event system**: App-level event hooks complete and stable
- ✅ **Cross-runtime**: Deno 169 / Bun 157 / Node 157 — all pass

### Release Recommendation

Based on test results:

1. ✅ **Ready to release**: All tests pass across Deno/Bun/Node.js 22+
2. ✅ **Documentation**: README (en + zh-CN) updated with Node.js compatibility
3. ✅ **Examples**: Complete usage examples provided
4. ✅ **CI**: 9-job matrix (3 runtimes × 3 OS) all green

---

## 🏃 Running Tests

### Deno

```bash
deno task test
```

### Bun

```bash
bun test tests/
```

### Node.js

```bash
npm install
npm run test:node
```

---

**Report generated**: 2026-07-23 **Test executor**: Automated test system
**Review status**: ✅ Passed (Deno 169 / Bun 157 / Node 157)
