import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";

// The reset token travels in the address fragment, so keep it out of the Referer header too.
export const metadata: Metadata = { title: "Reset password", referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
