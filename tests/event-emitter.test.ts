/**
 * 事件发射器测试
 */

import { describe, expect, it } from "@dreamer/test";
import { EventEmitter } from "../src/event-emitter.ts";

describe("EventEmitter", () => {
  describe("基础功能", () => {
    it("应该创建事件发射器实例", () => {
      const emitter = new EventEmitter();
      expect(emitter).toBeInstanceOf(EventEmitter);
    });

    it("应该注册和触发事件", () => {
      const emitter = new EventEmitter();
      let called = false;

      emitter.on("test", () => {
        called = true;
      });

      emitter.emit("test");
      expect(called).toBe(true);
    });

    it("应该支持多个监听器", () => {
      const emitter = new EventEmitter();
      let callCount = 0;

      emitter.on("test", () => {
        callCount++;
      });

      emitter.on("test", () => {
        callCount++;
      });

      emitter.emit("test");
      expect(callCount).toBe(2);
    });

    it("应该传递事件参数", () => {
      const emitter = new EventEmitter();
      let receivedArgs: unknown[] = [];

      emitter.on("test", (...args) => {
        receivedArgs = args;
      });

      emitter.emit("test", "arg1", "arg2", 123);
      expect(receivedArgs).toEqual(["arg1", "arg2", 123]);
    });
  });

  describe("移除监听器", () => {
    it("应该移除指定的监听器", () => {
      const emitter = new EventEmitter();
      let callCount = 0;

      const listener1 = () => {
        callCount++;
      };
      const listener2 = () => {
        callCount++;
      };

      emitter.on("test", listener1);
      emitter.on("test", listener2);

      emitter.off("test", listener1);
      emitter.emit("test");

      expect(callCount).toBe(1);
    });

    it("应该移除所有监听器", () => {
      const emitter = new EventEmitter();
      let callCount = 0;

      emitter.on("test", () => {
        callCount++;
      });

      emitter.on("test", () => {
        callCount++;
      });

      emitter.removeAllListeners("test");
      emitter.emit("test");

      expect(callCount).toBe(0);
    });

    it("应该移除所有事件的所有监听器", () => {
      const emitter = new EventEmitter();
      let callCount = 0;

      emitter.on("test1", () => {
        callCount++;
      });

      emitter.on("test2", () => {
        callCount++;
      });

      emitter.removeAllListeners();
      emitter.emit("test1");
      emitter.emit("test2");

      expect(callCount).toBe(0);
    });
  });

  describe("监听器管理", () => {
    it("应该返回监听器数量", () => {
      const emitter = new EventEmitter();

      emitter.on("test", () => {});
      expect(emitter.listenerCount("test")).toBe(1);

      emitter.on("test", () => {});
      expect(emitter.listenerCount("test")).toBe(2);

      emitter.off("test", () => {});
      expect(emitter.listenerCount("test")).toBe(2); // 移除不存在的监听器，数量不变
    });

    it("应该返回所有事件名称", () => {
      const emitter = new EventEmitter();

      emitter.on("event1", () => {});
      emitter.on("event2", () => {});
      emitter.on("event3", () => {});

      const eventNames = emitter.eventNames();
      expect(eventNames.length).toBe(3);
      expect(eventNames).toContain("event1");
      expect(eventNames).toContain("event2");
      expect(eventNames).toContain("event3");
    });
  });

  describe("错误处理", () => {
    it("应该处理监听器错误，不影响其他监听器", () => {
      const emitter = new EventEmitter();
      let otherListenerCalled = false;

      const originalError = console.error;
      console.error = () => {}; // 临时抑制错误输出

      try {
        emitter.on("test", () => {
          throw new Error("监听器错误");
        });

        emitter.on("test", () => {
          otherListenerCalled = true;
        });

        emitter.emit("test");
        expect(otherListenerCalled).toBe(true);
      } finally {
        console.error = originalError; // 恢复 console.error
      }
    });
  });
});
