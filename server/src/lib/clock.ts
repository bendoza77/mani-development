/** The current time, injectable so tests can move it forward (session expiry, lockouts, reset links). */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
