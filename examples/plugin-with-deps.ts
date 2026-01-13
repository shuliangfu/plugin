/**
 * 带依赖的插件示例
 *
 * 演示如何处理插件之间的依赖关系
 */

import { ServiceContainer } from "@dreamer/service";
import { type Plugin, PluginManager } from "../src/mod.ts";

// 数据库服务（基础服务）
class DatabaseService {
  connect(): void {
    console.log("Database connected");
  }

  disconnect(): void {
    console.log("Database disconnected");
  }
}

// 用户服务（依赖数据库服务）
class UserService {
  constructor(private db: DatabaseService) {}

  createUser(name: string): void {
    console.log(`User ${name} created`);
  }
}

// 数据库插件（基础插件）
const databasePlugin: Plugin = {
  name: "database-plugin",
  version: "1.0.0",
  async install(container) {
    container.registerSingleton("databaseService", () => new DatabaseService());
    console.log("Database plugin installed");
  },
  async activate(container) {
    const db = container.get<DatabaseService>("databaseService");
    db.connect();
    console.log("Database plugin activated");
  },
  async deactivate(container) {
    const db = container.get<DatabaseService>("databaseService");
    db.disconnect();
    console.log("Database plugin deactivated");
  },
};

// 用户插件（依赖数据库插件）
const userPlugin: Plugin = {
  name: "user-plugin",
  version: "1.0.0",
  dependencies: ["database-plugin"], // 声明依赖
  async install(container) {
    // 注意：此时 database-plugin 可能还未安装，所以不能直接使用
    // 在 activate 阶段使用依赖的服务更安全
    container.registerSingleton("userService", () => {
      const db = container.get<DatabaseService>("databaseService");
      return new UserService(db);
    });
    console.log("User plugin installed");
  },
  async activate(container) {
    const userService = container.get<UserService>("userService");
    userService.createUser("Alice");
    console.log("User plugin activated");
  },
  async deactivate() {
    console.log("User plugin deactivated");
  },
};

// 使用插件
async function main() {
  const container = new ServiceContainer();
  const pluginManager = new PluginManager(container);

  // 注册插件（顺序不重要，依赖会自动解析）
  pluginManager.register(userPlugin);
  pluginManager.register(databasePlugin);

  // 安装 user-plugin（会自动先安装 database-plugin）
  console.log("Installing user-plugin...");
  await pluginManager.install("user-plugin");

  // 激活插件（需要先激活依赖）
  console.log("\nActivating plugins...");
  await pluginManager.activate("database-plugin");
  await pluginManager.activate("user-plugin");

  // 使用服务
  console.log("\nUsing services...");
  const userService = container.get<UserService>("userService");
  userService.createUser("Bob");

  // 清理
  console.log("\nCleaning up...");
  await pluginManager.deactivate("user-plugin");
  await pluginManager.deactivate("database-plugin");
  await pluginManager.uninstall("user-plugin");
  await pluginManager.uninstall("database-plugin");
}

// 运行示例
if (import.meta.main) {
  main().catch(console.error);
}
