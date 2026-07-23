/**
 * 测试共享助手
 *
 * 提供项目内临时目录，规避 Bun 在 macOS 上对系统 temp 目录（/var/folders/.../T/）
 * 动态 import 的符号链接解析问题：Bun 将 /var 解析为 /private/var 后，首个临时文件
 * import 成功，但后续不同临时文件的 import 会报 "Cannot find module"。
 *
 * 使用项目内目录（tests/_tmp_plugins/）确保 Bun/Deno/Node 三端一致行为。
 */

import { fromFileUrl, join, mkdir } from "@dreamer/runtime-adapter";

/** 项目内临时插件目录（避开系统 temp 的 /var → /private/var 符号链接） */
export const PLUGIN_TMP_DIR = join(
  fromFileUrl(new URL(".", import.meta.url)),
  "_tmp_plugins",
);

// 模块加载时确保临时目录存在（recursive 幂等，多文件导入时安全）
await mkdir(PLUGIN_TMP_DIR, { recursive: true });
