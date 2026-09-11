import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminTopNav } from "@/components/admin/admin-top-nav";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Administrator Portal | Health And Pain Care Center",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, user } = await verifyAdminLayoutAccessAction();

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground selection:bg-purple-500/20">
      <AdminHeader session={session} user={user} />
      <AdminTopNav />
      <main className="flex-1 w-full max-w-[1700px] mx-auto px-3 sm:px-5 py-2.5 space-y-2.5">
        {children}
      </main>
    </div>
  );
}
