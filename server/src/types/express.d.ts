import type { ActiveSession } from "../modules/auth/session.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAdmin: the signed-in admin's live session. */
      session?: ActiveSession;
    }
  }
}

export {};
