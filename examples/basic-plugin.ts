/**
 * 基础插件示例
 *
 * 演示如何创建和使用一个简单的插件
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager } from "../src/mod.ts";

// 创建一个简单的服务类
class GreetingService {
  greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

// 定义插件
const greetingPlugin: Plugin = {
  name: "greeting-plugin",
  version: "1.0.0",
  async install(container) {
    // 在安装时注册服务
    container.registerSingleton("greetingService", () => new GreetingService());
    console.log("Greeting plugin installed");
  },
  async activate(container) {
    // 在激活时初始化
    const greetingService = container.get<GreetingService>("greetingService");
    console.log(greetingService.greet("World"));
    console.log("Greeting plugin activated");
  },
  async deactivate() {
    console.log("Greeting plugin deactivated");
  },
  async uninstall() {
    console.log("Greeting plugin uninstalled");
  },
};

// 使用插件
async function main() {
  // 创建服务容器
  const container = new ServiceContainer();

  // 创建插件管理器
  const pluginManager = new PluginManager(container);

  // 注册插件
  pluginManager.register(greetingPlugin);

  // 监听插件事件
  pluginManager.on("plugin:installed", (name) => {
    console.log(`Plugin ${name} installed`);
  });

  pluginManager.on("plugin:activated", (name) => {
    console.log(`Plugin ${name} activated`);
  });

  // 安装并激活插件
  await pluginManager.install("greeting-plugin");
  await pluginManager.activate("greeting-plugin");

  // 使用插件提供的服务
  const greetingService = container.get<GreetingService>("greetingService");
  console.log(greetingService.greet("Dreamer"));

  // 停用并卸载插件
  await pluginManager.deactivate("greeting-plugin");
  await pluginManager.uninstall("greeting-plugin");
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
