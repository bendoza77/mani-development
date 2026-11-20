// npm run admin:set-password — emergency password change when email reset isn't possible
// (docs/SECURITY_PLAN.md §2). Signs every device out.
import { adminSetPasswordCommand } from "../modules/auth/admin-cli.js";
import { runAdminScript } from "./terminal.js";

await runAdminScript(adminSetPasswordCommand);
