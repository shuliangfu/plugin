# 插件库示例

本目录包含 `@dreamer/plugin` 库的使用示例。

## 示例列表

### 1. basic-plugin.ts

基础插件示例，演示如何：

- 创建简单的插件
- 注册服务到容器
- 使用插件生命周期钩子
- 监听插件事件

运行方式：

```bash
deno run --allow-all examples/basic-plugin.ts
```

### 2. plugin-with-deps.ts

带依赖的插件示例，演示如何：

- 声明插件依赖
- 处理插件之间的依赖关系
- 自动按依赖顺序安装插件
- 在激活时使用依赖的服务

运行方式：

```bash
deno run --allow-all examples/plugin-with-deps.ts
```

### 3. plugin-config.ts

带配置的插件示例，演示如何：

- 使用插件配置
- 根据配置创建服务
- 在运行时使用配置

运行方式：

```bash
deno run --allow-all examples/plugin-config.ts
```

## 更多示例

更多使用场景和高级功能请参考 [README.md](../README.md)。
