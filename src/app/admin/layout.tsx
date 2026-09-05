import { cookies } from "next/headers";
import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state");
  const defaultOpen = sidebarCookie ? sidebarCookie.value === "true" : true;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar session={session} user={user} />
      <SidebarInset className="min-h-screen bg-background flex flex-col">
        <AdminHeader session={session} user={user} />
        <main className="flex-1 w-full overflow-x-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
