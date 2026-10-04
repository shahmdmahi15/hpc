import { checkLoginSessionAction } from "@/actions/login/login.action";
import { redirect } from "next/navigation";
import { LoginView } from "@/components/login/login-view";
import type { Metadata } from "next";

import { getRoleDashboard } from "@/proxy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff Authentication Portal | Health And Pain Care Center",
  description:
    "Secure role-based staff authentication portal with Argon2id cryptographic protection for Health And Pain Care Center (HPC)",
};

export default async function LoginPage() {
  const current = await checkLoginSessionAction();

  if (current) {
    redirect(getRoleDashboard(current.role));
  }

  return <LoginView />;
}
