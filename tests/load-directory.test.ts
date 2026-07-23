/**
 * 从目录加载插件测试
 */

import {
  join,
  makeTempDir,
  remove,
  writeTextFile,
} from "@dreamer/runtime-adapter";
import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { setPluginLocale } from "../src/i18n.ts";
import { PluginManager } from "../src/mod.ts";
import { PLUGIN_TMP_DIR } from "./_test-helpers.ts";

// 锁定中文 locale：本测试断言 $tr 返回中文文案（"加载插件目录失败"），
// 显式锁定 zh-CN 确保在任何 CI/开发机 locale 下确定性通过。
setPluginLocale("zh-CN");

describe("从目录加载插件", () => {
  describe("loadFromDirectory", () => {
    it("应该从目录加载所有插件文件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      // 创建临时目录
      const tempDir = await makeTempDir({ dir: PLUGIN_TMP_DIR });
      const plugin1Path = join(tempDir, "plugin1.ts");
      const plugin2Path = join(tempDir, "plugin2.ts");

      // 创建插件文件
      await writeTextFile(
        plugin1Path,
        `export default { name: "plugin1", version: "1.0.0" };`,
      );
      await writeTextFile(
        plugin2Path,
        `export default { name: "plugin2", version: "2.0.0" };`,
      );

      // 从目录加载
      await manager.loadFromDirectory(tempDir);

      // 验证插件已注册
      expect(manager.getRegisteredPlugins()).toContain("plugin1");
      expect(manager.getRegisteredPlugins()).toContain("plugin2");

      // 清理：递归删除目录
      await remove(tempDir, { recursive: true });
    });

    it("应该只加载 .ts 和 .js 文件", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      // 创建临时目录
      const tempDir = await makeTempDir({ dir: PLUGIN_TMP_DIR });
      const pluginPath = join(tempDir, "plugin.ts");
      const textPath = join(tempDir, "readme.txt");
      const jsonPath = join(tempDir, "config.json");

      // 创建文件
      await writeTextFile(
        pluginPath,
        `export default { name: "plugin", version: "1.0.0" };`,
      );
      await writeTextFile(textPath, "This is a text file");
      await writeTextFile(jsonPath, '{"key": "value"}');

      // 从目录加载
      await manager.loadFromDirectory(tempDir);

      // 验证只有插件文件被加载
      expect(manager.getRegisteredPlugins()).toContain("plugin");
      expect(manager.getRegisteredPlugins().length).toBe(1);

      // 清理：递归删除目录
      await remove(tempDir, { recursive: true });
    });

    it("应该处理加载失败的文件（continueOnError: true）", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: true,
      });

      // 创建临时目录
      const tempDir = await makeTempDir({ dir: PLUGIN_TMP_DIR });
      const validPluginPath = join(tempDir, "valid.ts");
      const invalidPluginPath = join(tempDir, "invalid.ts");

      // 创建文件
      await writeTextFile(
        validPluginPath,
        `export default { name: "valid", version: "1.0.0" };`,
      );
      await writeTextFile(
        invalidPluginPath,
        `export default { version: "1.0.0" };`, // 缺少 name
      );

      // 从目录加载（应该继续加载其他文件）
      await manager.loadFromDirectory(tempDir);

      // 验证有效插件已加载
      expect(manager.getRegisteredPlugins()).toContain("valid");

      // 清理：递归删除目录
      await remove(tempDir, { recursive: true });
    });

    it("应该在 continueOnError: false 时抛出错误", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container, {
        continueOnError: false,
      });

      // 创建临时目录
      const tempDir = await makeTempDir({ dir: PLUGIN_TMP_DIR });
      const validPluginPath = join(tempDir, "valid.ts");
      const invalidPluginPath = join(tempDir, "invalid.ts");

      // 创建文件
      await writeTextFile(
        validPluginPath,
        `export default { name: "valid", version: "1.0.0" };`,
      );
      await writeTextFile(
        invalidPluginPath,
        `export default { version: "1.0.0" };`, // 缺少 name
      );

      // 从目录加载（应该抛出错误）
      try {
        await manager.loadFromDirectory(tempDir);
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      // 清理：递归删除目录
      try {
        await remove(tempDir, { recursive: true });
      } catch {
        // 忽略清理错误
      }
    });

    it("应该处理不存在的目录", async () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      try {
        await manager.loadFromDirectory("/non-existent-directory");
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("加载插件目录失败");
      }
    });
  });
});
