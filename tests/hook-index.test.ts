/**
 * PluginManager 钩子索引：只遍历实现了该钩子的已激活插件，且保持注册顺序。
 */

import { ServiceContainer } from "@dreamer/service";
import { describe, expect, it } from "@dreamer/test";
import { PluginManager } from "../src/mod.ts";
import type { Plugin } from "../src/types.ts";

function namesOf(manager: PluginManager, hook: string): string[] {
  return manager.getActivePluginsWithHook(hook).map((p) => p.name);
}

describe("PluginManager hook index", () => {
  it("getActivePluginsWithHook 不含未实现该钩子的插件", async () => {
    const manager = new PluginManager(new ServiceContainer());
    const seen: string[] = [];
    await manager.use({
      name: "no-hook",
      version: "1.0.0",
      onInit() {
        seen.push("no-hook-init");
      },
    });
    await manager.use({
      name: "has-request",
      version: "1.0.0",
      onRequest() {
        seen.push("has-request");
      },
    });

    expect(namesOf(manager, "onRequest")).toEqual(["has-request"]);
    expect(namesOf(manager, "onInit")).toEqual(["no-hook"]);
    expect(namesOf(manager, "onResponse")).toEqual([]);
  });

  it("有钩子的插件保持注册顺序，无钩子的插件不被 triggerRequest 调用", async () => {
    const manager = new PluginManager(new ServiceContainer());
    const called: string[] = [];
    const mk = (name: string, withHook: boolean): Plugin => ({
      name,
      version: "1.0.0",
      ...(withHook
        ? {
          onRequest() {
            called.push(name);
          },
        }
        : {
          onInit() {
            called.push(`${name}-init`);
          },
        }),
    });
    await manager.use(mk("a", true));
    await manager.use(mk("b", false));
    await manager.use(mk("c", true));

    expect(namesOf(manager, "onRequest")).toEqual(["a", "c"]);

    const ctx = {
      request: new Request("http://example.com/t"),
      path: "/t",
      method: "GET",
      url: new URL("http://example.com/t"),
      headers: new Headers(),
    };
    await manager.triggerRequest(ctx);
    expect(called).toEqual(["a", "c"]);
  });

  it("停用后从索引移除；再激活时仍按注册顺序而非激活顺序", async () => {
    const manager = new PluginManager(new ServiceContainer());
    await manager.use({
      name: "first",
      version: "1.0.0",
      onRequest() {},
    });
    await manager.use({
      name: "second",
      version: "1.0.0",
      onRequest() {},
    });

    manager.deactivate("first");
    expect(namesOf(manager, "onRequest")).toEqual(["second"]);

    manager.activate("first");
    expect(namesOf(manager, "onRequest")).toEqual(["first", "second"]);
  });

  it("卸载后不再出现在索引中", async () => {
    const manager = new PluginManager(new ServiceContainer());
    await manager.use({
      name: "gone",
      version: "1.0.0",
      onRequest() {},
    });
    await manager.use({
      name: "stay",
      version: "1.0.0",
      onRequest() {},
    });
    await manager.uninstall("gone");
    expect(namesOf(manager, "onRequest")).toEqual(["stay"]);
  });

  it("replace 注册后在重新激活前不应出现在索引中", () => {
    const manager = new PluginManager(new ServiceContainer());
    const original: Plugin = {
      name: "swap",
      version: "1.0.0",
      onRequest() {},
    };
    manager.register(original);
    // 未激活时索引为空
    expect(namesOf(manager, "onRequest")).toEqual([]);
  });
});
