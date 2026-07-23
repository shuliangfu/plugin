# 变更日志

[English](../en-US/CHANGELOG.md) | 中文 (Chinese)

本文档记录 @dreamer/plugin 的所有重要变更。格式基于
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循
[Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [1.1.0] - 2026-07-23

### 新增

- **Node.js 22+ 兼容**：完整支持 Deno、Bun、Node.js 22+ 三端运行。插件系统
  通过 `tsx` 进行 TypeScript 转译，在 Node.js 上原生运行。新增 `package.json`
  （`engines.node >= 22`、基于 tsx 的 `test:node` 脚本）与 `tsconfig.json`
  （Bundler 模块解析）。
- **`setPluginLocale` 导出**：`src/i18n.ts` 新增显式锁定 i18n locale 的导出
  函数。断言 `$tr()` 中文文案的测试在模块级调用 `setPluginLocale("zh-CN")`，
  确保在任意 CI/开发机 locale 下确定性复现 zh-CN 行为（同 auth/payment/cache
  模式）。
- **9 作业 CI 矩阵**：GitHub Actions 工作流（`.github/workflows/ci.yml`），
  3 Deno v2.9 + 3 Bun + 3 Node 22，跨 Linux/macOS/Windows。
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` 提前验证 Node 24。
- **项目内测试临时目录**：`tests/_test-helpers.ts` 导出 `PLUGIN_TMP_DIR`
  （项目内 `tests/_tmp_plugins/`），规避 Bun 在 macOS 上对系统 temp 路径
  （`/var/folders/.../T/` → `/private/var/...` 符号链接解析）的动态 import
  失败。

### 变更

- **依赖升级**：`@dreamer/i18n` ^1.0.1 → ^1.1.2、`@dreamer/service`
  ^1.0.2 → ^1.1.0、`@dreamer/runtime-adapter` ^1.0.18 → ^1.2.2、
  `@dreamer/test` ^1.0.10 → ^1.2.3。所有依赖均已支持 Node.js 22+。
- **deno.json tasks**：新增 `test`、`test:node`、`check`、`lint`、`fmt` 任务。
  `minimumDependencyAge: 0` 加速迭代。
- **`.gitignore`**：新增 `package-lock.json` 与 `tests/_tmp_plugins/`。

### 修复

- **Bun 动态 import 临时文件**：macOS 上 Bun 动态 import 系统 temp 目录中的
  临时插件文件时，将 `/var` 解析为 `/private/var` 符号链接。首个 import 成功，
  但后续不同临时文件的 import 报 "Cannot find module '/private/var/...'"。
  修复为在项目目录树内（`tests/_tmp_plugins/`）创建临时文件。
- **CI locale 断言**：5 个测试文件（loader、comprehensive、mod、config、
  load-directory）锁定 `setPluginLocale("zh-CN")`，确保中文 `$tr` 断言在
  CI 英文 locale 下通过。

### 兼容性

- Deno 2.9+
- Bun 1.3+
- Node.js 22+

### 测试

- Deno：169 通过，0 失败
- Bun：157 通过，0 失败
- Node.js：157 通过，0 失败
- 跨运行时差异（Deno 169 vs Bun/Node 157）是因为 Deno 原生测试运行器统计
  更多嵌套步骤。

---

## [1.0.2] - 2026-02-19

### 变更

- **i18n**：i18n 在插件模块加载时自动初始化。`initPluginI18n`
  不再对外导出，调用方 无需再调用。翻译函数 `$tr`
  在首次使用时若尚未初始化会自动初始化。语言仍从 `LANGUAGE` / `LC_ALL` / `LANG`
  自动检测；测试若需指定语言可继续从 `./i18n.ts` 导入（如使用 `detectLocale`
  或带 `lang` 参数调用 `$tr`）。

### 修复

- **测试**：与当前 i18n 错误文案对齐。`debug.test.ts` 中
  `getDebugInfo("non-existent")` 使用 i18n 键
  `errors.pluginNotFound`（文案含「未找到」），断言改为接受「未找到」或
  「未注册」。`loader.test.ts` 中无效插件文件（缺少 name 或 version）使用
  `errors.pluginMissingNameVersion`（文案含「缺少必需属性」），断言改为接受
  「缺少必需属性」「缺少必需的属性」或「不是一个有效的插件模块」。

---

## [1.0.1] - 2026-02-19

### 变更

- **i18n**：翻译方法由 `$t` 重命名为 `$tr`，避免与全局 `$t`
  冲突。请将现有代码中本包消息改为使用 `$tr`。
- **文档**：文档结构调整为 `docs/en-US/`（CHANGELOG、TEST_REPORT）与
  `docs/zh-CN/`（README、CHANGELOG、TEST_REPORT 全文中文）。根目录
  CHANGELOG、TEST_REPORT 已移除，根目录 README 精简并链接至 docs。
- **许可证**：在 `deno.json` 及文档中明确为 Apache-2.0。

---

## [1.0.0] - 2026-02-06

### 新增

首个稳定版。兼容 Deno 与 Bun 的插件管理系统，与 dweb 框架兼容。

#### 注册与加载

- 手动注册插件
- 从文件加载（默认导出与命名导出 `plugin`）
- 从目录加载（批量）
- 插件元数据（名称、版本、依赖）

#### 生命周期管理

- **状态**：registered → installed → active → inactive → uninstalled
- **方法**：register()、install()、activate()、deactivate()、uninstall()
- **便捷**：use()（自动 register → install → activate）、bootstrap()、shutdown()
- **替换**：register({ replace: true }) 替换已有插件
- 状态转换校验与回滚

#### 依赖管理

- 插件依赖声明
- 拓扑排序确定加载顺序
- 循环依赖检测
- 缺失依赖检测
- validateDependencies() 工具

#### 配置管理

- 插件配置存储（运行时覆盖初始值）
- 配置校验（可选校验器）
- 配置热更新
- onConfigUpdate 钩子

#### 事件系统

- **生命周期事件**：plugin:registered、plugin:installed、plugin:activated、plugin:deactivated、plugin:uninstalled、plugin:replaced、plugin:error
- **应用级钩子**（由 Manager.trigger* 触发）：
  - 生命周期：onInit、onStart、onStop、onShutdown
  - HTTP：onRequest、onResponse、onError
  - 路由：onRoute
  - 构建：onBuild、onBuildComplete
  - Socket：onSocket、onSocketClose（WebSocket/Socket.IO）
  - 健康：onHealthCheck
  - 开发：onHotReload
- 自定义事件、发布/订阅
- on()、off()、emit()

#### 错误隔离

- 插件错误不影响其他插件（continueOnError: true）
- 错误日志与 plugin:error 事件
- getDebugInfo() 获取错误详情

#### 开发支持

- 热加载（文件监听，仅开发环境）
- getDebugInfo()、getDependencyGraph()
- 资源限制接口

#### 工具

- detectCircularDependency()
- detectMissingDependencies()
- topologicalSort()
- loadPluginFromFile()

#### 环境兼容

- Deno 2.5+
- Bun 1.0+
- 仅服务端（无客户端子路径）
- 依赖 @dreamer/service

#### 测试

- 157 个测试，全部通过
- 12 个测试文件
- 38 个公开 API 方法覆盖
- 14 个应用级钩子覆盖
- 13 个边界情况、10 个错误场景
