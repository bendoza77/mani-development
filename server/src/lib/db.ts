import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export type Database = {
  prisma: PrismaClient;
  /** Resolves when the database answers `SELECT 1` within the time limit; rejects otherwise. */
  ping(timeoutMs?: number): Promise<void>;
  disconnect(): Promise<void>;
};

/** One Prisma client per process, through the pg driver adapter required by Prisma 7. */
export function createDatabase(databaseUrl: string): Database {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    max: 10,
    // Give up on a connection attempt that hangs, so a stuck database can't pile up sockets.
    connectionTimeoutMillis: 5_000,
  });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    async ping(timeoutMs = 2_000) {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`database did not answer within ${timeoutMs} ms`)), timeoutMs);
      });
      try {
        await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
    disconnect: () => prisma.$disconnect(),
  };
}
