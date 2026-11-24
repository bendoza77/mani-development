// npm run admin:create — creates the admin account (docs/SECURITY_PLAN.md §2).
import { adminCreateCommand } from "../modules/auth/admin-cli.js";
import { runAdminScript } from "./terminal.js";

await runAdminScript(adminCreateCommand);
