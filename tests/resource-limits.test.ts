/**
 * 资源限制测试
 *
 * 注意：资源限制功能目前只是接口定义，实际限制逻辑尚未实现
 */

import { describe, expect, it } from "@dreamer/test";
import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager, type ResourceLimits } from "../src/mod.ts";

describe("资源限制", () => {
  describe("资源限制配置", () => {
    it("应该接受资源限制配置", () => {
      const container = new ServiceContainer();
      const resourceLimits: ResourceLimits = {
        maxMemory: 100, // 100MB
        maxCpu: 50, // 50%
        timeout: 5000, // 5秒
      };

      const manager = new PluginManager(container, {
        resourceLimits,
      });

      expect(manager).toBeInstanceOf(PluginManager);
      // 注意：资源限制的实际执行逻辑尚未实现
      // 这里只是测试配置可以被接受
    });

    it("应该在没有资源限制配置时正常工作", () => {
      const container = new ServiceContainer();
      const manager = new PluginManager(container);

      const plugin: Plugin = {
        name: "test-plugin",
        version: "1.0.0",
      };

      manager.register(plugin);
      expect(manager.getState("test-plugin")).toBe("registered");
    });
  });
});
