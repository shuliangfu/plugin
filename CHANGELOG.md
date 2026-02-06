# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-02-06

### Added

First stable release. Plugin management system for Deno and Bun, compatible with the dweb framework.

#### Registration and Loading

- Manual plugin registration
- Load from file (default export and named export `plugin`)
- Load from directory (batch load)
- Plugin metadata (name, version, dependencies)

#### Lifecycle Management

- **States**: registered → installed → active → inactive → uninstalled
- **Methods**: register(), install(), activate(), deactivate(), uninstall()
- **Convenience**: use() (auto register → install → activate), bootstrap(), shutdown()
- **Replacement**: register({ replace: true }) to replace existing plugin
- State transition validation and rollback

#### Dependency Management

- Plugin dependency declaration
- Topological sort for load order
- Circular dependency detection
- Missing dependency detection
- validateDependencies() utility

#### Config Management

- Plugin config storage (runtime overrides initial)
- Config validation (optional validator)
- Hot config update
- onConfigUpdate hook

#### Event System

- **Lifecycle events**: plugin:registered, plugin:installed, plugin:activated, plugin:deactivated, plugin:uninstalled, plugin:replaced, plugin:error
- **App-level hooks** (triggered by Manager.trigger*):
  - Lifecycle: onInit, onStart, onStop, onShutdown
  - HTTP: onRequest, onResponse, onError
  - Route: onRoute
  - Build: onBuild, onBuildComplete
  - Socket: onSocket, onSocketClose (WebSocket/Socket.IO)
  - Health: onHealthCheck
  - Dev: onHotReload
- Custom events, pub/sub
- on(), off(), emit()

#### Error Isolation

- Plugin errors don't affect other plugins (continueOnError: true)
- Error logging and plugin:error event
- getDebugInfo() for error details

#### Dev Support

- Hot reload (file watch, dev only)
- getDebugInfo(), getDependencyGraph()
- Resource limits interface

#### Utilities

- detectCircularDependency()
- detectMissingDependencies()
- topologicalSort()
- loadPluginFromFile()

#### Environment Compatibility

- Deno 2.5+
- Bun 1.0+
- Server-only (no client subpath)
- Depends on @dreamer/service

#### Testing

- 157 tests, all passing
- 12 test files
- 38 public API methods covered
- 14 app-level hooks covered
- 13 edge cases, 10 error scenarios
