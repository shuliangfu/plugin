# Changelog

[English](./CHANGELOG.md) | [中文 (Chinese)](../zh-CN/CHANGELOG.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.1.0] - 2026-07-23

### Added

- **Node.js 22+ compatibility**: Full cross-runtime support for Deno, Bun, and
  Node.js 22+. The plugin system now runs natively on Node.js via `tsx` for
  TypeScript transpilation. Added `package.json` with `engines.node >= 22`,
  `test:node` script (tsx-based), and `tsconfig.json` (Bundler module
  resolution).
- **`setPluginLocale` export**: New exported function in `src/i18n.ts` to
  explicitly lock the i18n locale. Tests that assert on `$tr()` Chinese output
  now call `setPluginLocale("zh-CN")` at module level to deterministically
  reproduce zh-CN behavior regardless of CI/development machine locale (same
  pattern as auth/payment/cache). 6 test files locked: loader, comprehensive,
  mod, config, load-directory, debug.
- **`pathToFileURL` in loader.ts**: `src/loader.ts` now converts file paths to
  `file://` URLs before dynamic `import()`. On Windows, bare paths like
  `D:/...` are misinterpreted by Deno as URL scheme "d" ("Unsupported scheme")
  and by Bun as unresolvable modules; `file:///D:/...` is the cross-runtime
  standard for dynamic file imports.
- **9-job CI matrix**: GitHub Actions workflow (`.github/workflows/ci.yml`)
  with 3 Deno v2.9 + 3 Bun + 3 Node 22 jobs across Linux/macOS/Windows.
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` for early Node 24 validation.
- **Project-local temp directory for tests**: `tests/_test-helpers.ts` exports
  `PLUGIN_TMP_DIR` (project-internal `tests/_tmp_plugins/`) to avoid Bun's
  macOS dynamic-import failure on system temp paths (`/var/folders/.../T/`
  → `/private/var/...` symlink resolution breaks subsequent imports).

### Changed

- **Dependencies bumped**: `@dreamer/i18n` ^1.0.1 → ^1.1.2, `@dreamer/service`
  ^1.0.2 → ^1.1.0, `@dreamer/runtime-adapter` ^1.0.18 → ^1.2.2, `@dreamer/test`
  ^1.0.10 → ^1.2.3. All dependencies now support Node.js 22+.
- **deno.json tasks**: Added `test`, `test:node`, `check`, `lint`, `fmt` tasks.
  `minimumDependencyAge: 0` for faster iteration.
- **`.gitignore`**: Added `package-lock.json` and `tests/_tmp_plugins/`.

### Fixed

- **Bun dynamic import of temp files**: On macOS, Bun resolves `/var` →
  `/private/var` symlink when dynamically importing temp plugin files from the
  system temp directory. The first import succeeds but subsequent imports of
  different temp files fail with "Cannot find module '/private/var/...'".
  Fixed by creating temp files inside the project directory tree
  (`tests/_tmp_plugins/`) instead of the system temp dir.
- **CI locale assertions**: 6 test files (loader, comprehensive, mod, config,
  load-directory, debug) now lock `setPluginLocale("zh-CN")` to ensure Chinese
  `$tr` assertions pass on CI English locale.

### Compatibility

- Deno 2.9+
- Bun 1.3+
- Node.js 22+

### Tests

- Deno: 169 passed, 0 failed
- Bun: 157 passed, 0 failed
- Node.js: 157 passed, 0 failed
- Cross-runtime difference (Deno 169 vs Bun/Node 157) is due to Deno's native
  test runner counting more nested steps.

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
