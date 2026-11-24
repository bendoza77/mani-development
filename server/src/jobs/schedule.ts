import type { Logger } from "pino";

/**
 * Runs `task` now and then every `intervalMs`, never two at once. Errors are logged, not thrown.
 * Returns an async stop function that also waits for a run still in progress, so nothing touches
 * the database after it resolves (graceful shutdown).
 */
export function repeatEvery(
  intervalMs: number,
  task: () => Promise<void>,
  { logger, name }: { logger: Logger; name: string },
): () => Promise<void> {
  let current: Promise<void> | undefined;
  let stopped = false;
  const run = () => {
    if (current || stopped) return;
    current = (async () => {
      try {
        await task();
      } catch (error) {
        logger.error({ err: error }, `${name} failed`);
      } finally {
        current = undefined;
      }
    })();
  };

  run();
  const timer = setInterval(run, intervalMs);
  // Never keeps the process alive on its own.
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await current;
  };
}
