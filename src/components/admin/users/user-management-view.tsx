"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES, type RoleConfig } from "@/components/login/role-config";
import { PasswordResetDialog } from "@/components/admin/users/password-reset-dialog";
import { RevokeSessionsDialog } from "@/components/admin/users/revoke-sessions-dialog";
import { CreatePerformerDialog } from "@/components/admin/users/create-performer-dialog";
import { DeletePerformerDialog } from "@/components/admin/users/delete-performer-dialog";
import { Role } from "@/generated/prisma/enums";
import { formatBSTShortDate } from "@/lib/date";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Search,
  Calendar,
  Copy,
  Check,
  UserPlus,
  Phone,
  Trash2,
} from "lucide-react";

export interface UserAccountData {
  id: string;
  role: Role;
  createdAt: Date | string;
  updatedAt: Date | string;
  activeSessionCount: number;
  totalSessionCount: number;
  lastAccessAt: Date | string | null;
  performers: { id: string; name: string; phone: string }[];
}

interface UserManagementViewProps {
  users: UserAccountData[];
}

export function UserManagementView({ users }: UserManagementViewProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [selectedUserForReset, setSelectedUserForReset] = React.useState<{
    id: string;
    role: Role;
  } | null>(null);
  const [selectedUserForRevoke, setSelectedUserForRevoke] = React.useState<{
    id: string;
    role: Role;
    activeSessionCount: number;
  } | null>(null);
  const [createPerformerOpen, setCreatePerformerOpen] = React.useState(false);
  const [defaultPerformerUserId, setDefaultPerformerUserId] = React.useState<
    string | null
  >(null);
  const [performerToDelete, setPerformerToDelete] = React.useState<{
    id: string;
    name: string;
    phone: string;
    roleLabel?: string;
  } | null>(null);

  // Extract all registered admin performers for authorization workflows
  const adminPerformers = React.useMemo(() => {
    const adminUser = users.find((u) => u.role === Role.ADMIN);
    return adminUser?.performers || [];
  }, [users]);

  // Total active sessions tally
  const totalActiveSessions = React.useMemo(() => {
    return users.reduce((acc, u) => acc + u.activeSessionCount, 0);
  }, [users]);

  // Filter users by search
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter((u) => {
      const config = ROLES.find((r) => r.value === u.role);
      return (
        u.role.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        config?.defaultLabel.toLowerCase().includes(q) ||
        config?.defaultDesc.toLowerCase().includes(q) ||
        u.performers.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }, [users, searchQuery]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      toast.success("Full User ID copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ---------------------------------------------------- */}
      {/* 1. Header & Architecture Notice                      */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <Users className="size-3.5" />
                Station Credentials Control
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {totalActiveSessions} Active Session
                {totalActiveSessions === 1 ? "" : "s"}
              </span>
              {adminPerformers.length > 1 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10.5px] font-semibold">
                  <ShieldAlert className="size-3" />
                  Multi-Admin Audit Active ({adminPerformers.length} staff)
                </span>
              ) : adminPerformers.length === 1 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10.5px] font-semibold">
                  <ShieldCheck className="size-3" />
                  Acting: {adminPerformers[0].name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/80 text-[10.5px] font-semibold">
                  Root Administrator Mode
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Users &amp; Staff Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Zero-trust role accounts with individual station credentials,
              staff performers, and session invalidation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setDefaultPerformerUserId(null);
                setCreatePerformerOpen(true);
              }}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="size-3.5" />
              <span>Add Performer</span>
            </Button>

            <Link
              href="/admin"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>

        {/* Zero-Trust Architecture Notice Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 text-xs text-foreground">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
              <ShieldCheck className="size-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-teal-900 dark:text-teal-200">
                  Immutable Role Hierarchy &bull; Single-Account Zero Trust
                </h2>
                <span className="px-1.5 py-0.2 rounded-md bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-mono font-bold">
                  role @unique
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11.5px]">
                In Health &amp; Pain Care Center, each station is represented by
                exactly one unique user account (
                <code className="font-mono text-teal-700 dark:text-teal-300 font-semibold">
                  ADMIN, DOCTOR, RECEPTIONIST, HANDLER, CASHIER
                </code>
                ). Roles cannot be reassigned or duplicated, preventing
                unauthorized privilege escalation. Administrators can reset
                passwords or terminate active sessions at any time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Search & Overview Metrics                         */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by role, ID, or station name..."
            className="pl-8 text-xs rounded-xl h-9 bg-card border-border/80"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
          <span>
            Showing {filteredUsers.length} of {users.length} Role Accounts
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Role Accounts Cards Grid                          */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const roleConfig: RoleConfig =
            ROLES.find((r) => r.value === user.role) || ROLES[0];
          const RoleIcon = roleConfig.icon;
          const isOnline = user.activeSessionCount > 0;

          return (
            <Card
              key={user.id}
              className="relative overflow-hidden border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Top Row: Icon, Title & Online Badge */}
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`size-10 rounded-xl border flex items-center justify-center shadow-xs shrink-0 ${roleConfig.color}`}
                      >
                        <RoleIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold text-foreground leading-tight truncate">
                          {roleConfig.defaultLabel}
                        </CardTitle>
                        <p className="text-[10.5px] font-mono text-muted-foreground uppercase tracking-wider font-semibold truncate">
                          ROLE &bull; {user.role}
                        </p>
                      </div>
                    </div>

                    {/* Live Status Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border shrink-0 ${
                        isOnline
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isOnline
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-muted-foreground/50"
                        }`}
                      />
                      <span>
                        {isOnline
                          ? `${user.activeSessionCount} Online`
                          : "Offline"}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                {/* Card Body */}
                <CardContent className="pt-3.5 space-y-3 text-xs">
                  {/* Dedicated Full ID Bar with 1-Click Copy */}
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground select-none shrink-0">
                        ID:
                      </span>
                      <span
                        className="text-foreground font-semibold select-all truncate"
                        title={user.id}
                      >
                        {user.id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyId(user.id)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 cursor-pointer"
                      title="Copy full User ID"
                    >
                      {copiedId === user.id ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground text-[11.5px] leading-relaxed min-h-[2rem] flex items-center">
                    {roleConfig.defaultDesc}
                  </p>

                  {/* Account Metadata Specs */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="p-2.5 rounded-xl border border-border/60 bg-muted/30 space-y-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Role Policy
                      </span>
                      <p className="font-bold text-foreground truncate">
                        Immutable
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl border border-border/60 bg-muted/30 space-y-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Active Logins
                      </span>
                      <p className="font-bold text-foreground">
                        {user.activeSessionCount}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Clinical Performers / Staff */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Users className="size-3" />
                        Assigned Staff ({user.performers?.length || 0})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDefaultPerformerUserId(user.id);
                          setCreatePerformerOpen(true);
                        }}
                        className="text-[10.5px] font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <UserPlus className="size-3" />
                        <span>Add Staff</span>
                      </button>
                    </div>

                    {user.performers && user.performers.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {user.performers.map((p) => (
                          <div
                            key={p.id}
                            className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50 text-[11px] hover:bg-muted/70 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate leading-tight">
                                {p.name}
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="size-2.5 text-muted-foreground/70 shrink-0" />
                                <span>{p.phone}</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPerformerToDelete({
                                  id: p.id,
                                  name: p.name,
                                  phone: p.phone,
                                  roleLabel: roleConfig.defaultLabel,
                                })
                              }
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer shrink-0"
                              title="Remove performer"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-lg bg-muted/20 border border-dashed border-border/70 text-center">
                        <p className="text-[11px] text-muted-foreground">
                          No staff assigned to this desk yet.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Account Age Timestamp */}
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground pt-1 border-t border-border/40">
                    <span
                      className="flex items-center gap-1"
                      suppressHydrationWarning
                    >
                      <Calendar className="size-3" />
                      Created: {formatBSTShortDate(user.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Lock className="size-3 text-emerald-500" />
                      Argon2id Protected
                    </span>
                  </div>
                </CardContent>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedUserForRevoke({
                      id: user.id,
                      role: user.role,
                      activeSessionCount: user.activeSessionCount,
                    })
                  }
                  disabled={user.activeSessionCount === 0}
                  className="rounded-xl text-xs font-semibold h-8 px-2.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-40"
                  title="Terminate all active sessions for this account"
                >
                  Revoke
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setSelectedUserForReset({
                      id: user.id,
                      role: user.role,
                    })
                  }
                  className="rounded-xl text-xs font-semibold h-8 px-3 gap-1.5 cursor-pointer shadow-xs"
                >
                  <KeyRound className="size-3.5" />
                  <span>Reset Password</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. Password Reset Dialog Modal                       */}
      {/* ---------------------------------------------------- */}
      <PasswordResetDialog
        key={`password-reset-${selectedUserForReset?.id || "none"}`}
        open={!!selectedUserForReset}
        onOpenChange={(open) => !open && setSelectedUserForReset(null)}
        user={selectedUserForReset}
        adminPerformers={adminPerformers}
      />

      {/* ---------------------------------------------------- */}
      {/* 5. Revoke Sessions Confirmation Modal                */}
      {/* ---------------------------------------------------- */}
      <RevokeSessionsDialog
        key={`revoke-sessions-${selectedUserForRevoke?.id || "none"}`}
        open={!!selectedUserForRevoke}
        onOpenChange={(open) => !open && setSelectedUserForRevoke(null)}
        user={selectedUserForRevoke}
        adminPerformers={adminPerformers}
      />

      {/* ---------------------------------------------------- */}
      {/* 6. Create Staff Performer Modal                      */}
      {/* ---------------------------------------------------- */}
      <CreatePerformerDialog
        key={`create-performer-${defaultPerformerUserId || "default"}`}
        open={createPerformerOpen}
        onOpenChange={setCreatePerformerOpen}
        users={users.map((u) => ({ id: u.id, role: u.role }))}
        defaultUserId={defaultPerformerUserId}
        adminPerformers={adminPerformers}
      />

      {/* ---------------------------------------------------- */}
      {/* 7. Delete Staff Performer Modal                      */}
      {/* ---------------------------------------------------- */}
      <DeletePerformerDialog
        key={`delete-performer-${performerToDelete?.id || "none"}`}
        open={!!performerToDelete}
        onOpenChange={(open) => !open && setPerformerToDelete(null)}
        performer={performerToDelete}
        adminPerformers={adminPerformers}
      />
    </div>
  );
}
