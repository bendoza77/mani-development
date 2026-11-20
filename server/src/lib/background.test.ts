import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createBackgroundTasks } from "./background.js";
import { createLogger } from "./logger.js";

const silent = createLogger("silent");
const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createBackgroundTasks", () => {
  it("starts the task without waiting for it", async () => {
    const tasks = createBackgroundTasks(silent);
    let done = false;

    tasks.run(async () => {
      await later(20);
      done = true;
    });

    expect(done).toBe(false);
    await tasks.drain();
    expect(done).toBe(true);
  });

  it("drain also waits for tasks started by other tasks", async () => {
    const tasks = createBackgroundTasks(silent);
    const finished: string[] = [];

    tasks.run(async () => {
      await later(10);
      tasks.run(async () => {
        await later(10);
        finished.push("second");
      });
      finished.push("first");
    });

    await tasks.drain();
    expect(finished).toEqual(["first", "second"]);
  });

  it("logs a failed task instead of throwing", async () => {
    const lines: string[] = [];
    const logger = createLogger("error", new Writable({ write: (chunk, _enc, cb) => (lines.push(String(chunk)), cb()) }));
    const tasks = createBackgroundTasks(logger);

    tasks.run(async () => {
      throw new Error("mail server down");
    });

    await expect(tasks.drain()).resolves.toBeUndefined();
    expect(lines.join("")).toContain("mail server down");
  });

  it("drain resolves at once when nothing is running", async () => {
    await expect(createBackgroundTasks(silent).drain()).resolves.toBeUndefined();
  });
});
