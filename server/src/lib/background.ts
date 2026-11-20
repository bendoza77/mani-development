import type { Logger } from "pino";

/**
 * Work that runs after the response has been sent (password-reset and notice emails).
 * `drain()` waits for all of it, so shutdown doesn't cut an email off and tests don't leak
 * work into the next test.
 */
export type BackgroundTasks = {
  run(task: () => Promise<void>): void;
  drain(): Promise<void>;
};

export function createBackgroundTasks(logger: Logger): BackgroundTasks {
  const pending = new Set<Promise<void>>();
  return {
    run(task) {
      const promise: Promise<void> = task()
        .catch((error: unknown) => logger.error({ err: error }, "background task failed"))
        .finally(() => pending.delete(promise));
      pending.add(promise);
    },
    async drain() {
      // Tasks may start other tasks, so keep waiting until none are left.
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}
