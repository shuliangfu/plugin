# Changelog

[English](./CHANGELOG.md) | [中文 (Chinese)](../zh-CN/CHANGELOG.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.2] - 2026-02-19

### Changed

- **i18n**: i18n now auto-initializes when the plugin module is loaded.
  `initPluginI18n` is no longer exported; callers do not need to call it. The
  translation function `$tr` initializes i18n on first use if not yet
  initialized. Locale is still auto-detected from `LANGUAGE` / `LC_ALL` /
  `LANG`; tests that need a specific locale can import from `./i18n.ts` as
  before (e.g. for `detectLocale` or for calling `$tr` with the `lang`
  parameter).

### Fixed

- **Tests**: Aligned test assertions with the current i18n error messages. In
  `debug.test.ts`, `getDebugInfo("non-existent")` throws using the i18n key
  `errors.pluginNotFound` (message contains "未找到"); the test now accepts
  either "未找到" or "未注册". In `loader.test.ts`, invalid plugin files
  (missing name or version) throw using `errors.pluginMissingNameVersion`
  (message contains "缺少必需属性"); the test now accepts "缺少必需属性",
  "缺少必需的属性", or "不是一个有效的插件模块".

---

## [1.0.1] - 2026-02-19

### Changed

- **i18n**: Renamed translation method from `$t` to `$tr` to avoid conflict with
  global `$t`. Update existing code to use `$tr` for package messages.
- **Docs**: Reorganized documentation into `docs/en-US/` (CHANGELOG,
  TEST_REPORT) and `docs/zh-CN/` (README, CHANGELOG, TEST_REPORT with full
  Chinese translations). Removed root CHANGELOG and TEST_REPORT. Root README
  shortened with links to docs.
- **License**: Explicitly Apache-2.0 in `deno.json` and documentation.

---

## [1.0.0] - 2026-02-06

### Added

First stable release. Plugin management system for Deno and Bun, compatible with
the dweb framework.

#### Registration and Loading

- Manual plugin registration
- Load from file (default export and named export `plugin`)
- Load from directory (batch load)
- Plugin metadata (name, version, dependencies)

#### Lifecycle Management

- **States**: registered → installed → active → inactive → uninstalled
- **Methods**: register(), install(), activate(), deactivate(), uninstall()
- **Convenience**: use() (auto register → install → activate), bootstrap(),
  shutdown()
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

- **Lifecycle events**: plugin:registered, plugin:installed, plugin:activated,
  plugin:deactivated, plugin:uninstalled, plugin:replaced, plugin:error
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
