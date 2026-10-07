"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES, type RoleConfig } from "@/components/login/role-config";
import { PasswordResetDialog } from "@/components/admin/users/password-reset-dialog";
import { RevokeSessionsDialog } from "@/components/admin/users/revoke-sessions-dialog";
import { CreatePerformerDialog } from "@/components/admin/users/create-performer-dialog";
import { CreateAccountDialog } from "@/components/admin/users/create-account-dialog";
import { DeletePerformerDialog } from "@/components/admin/users/delete-performer-dialog";
import { deleteUserAccountAction } from "@/actions/admin/user.action";
import { Role } from "@/generated/prisma/enums";
import { formatBSTShortDate } from "@/lib/date";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  Shield,
  Stethoscope,
  KeyRound,
  Lock,
  Search,
  Calendar,
  Copy,
  Check,
  UserPlus,
  Phone,
  Mail,
  Trash2,
  Building2,
  UserCheck,
  Sparkles,
  ArrowRight,
  Banknote,
  Pencil,
} from "lucide-react";
import { EditDoctorFeeDialog } from "@/components/admin/users/edit-doctor-fee-dialog";

export interface UserAccountData {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  consultationFee?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  activeSessionCount: number;
  totalSessionCount: number;
  lastAccessAt: Date | string | null;
  performers: {
    id: string;
    name: string;
    email?: string | null;
    whatsapp?: string;
    phone: string;
    pin: string;
  }[];
}

interface UserManagementViewProps {
  users: UserAccountData[];
}

export function UserManagementView({ users }: UserManagementViewProps) {
  const [userList, setUserList] = React.useState<UserAccountData[]>(users);

  React.useEffect(() => {
    setUserList(users);
  }, [users]);

  const [activeTab, setActiveTab] = React.useState<"accounts" | "desks">("accounts");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [selectedDoctorForFee, setSelectedDoctorForFee] =
    React.useState<UserAccountData | null>(null);
  const [selectedUserForReset, setSelectedUserForReset] = React.useState<{
    id: string;
    role: Role;
  } | null>(null);
  const [selectedUserForRevoke, setSelectedUserForRevoke] = React.useState<{
    id: string;
    role: Role;
    activeSessionCount: number;
  } | null>(null);
  const [createAccountOpen, setCreateAccountOpen] = React.useState(false);
  const [createPerformerOpen, setCreatePerformerOpen] = React.useState(false);
  const [defaultPerformerUserId, setDefaultPerformerUserId] = React.useState<string | null>(null);
  const [performerToDelete, setPerformerToDelete] = React.useState<{
    id: string;
    name: string;
    phone: string;
    roleLabel?: string;
  } | null>(null);

  const handleDoctorFeeSuccess = (doctorId: string, newFee: number) => {
    setUserList((prev) =>
      prev.map((u) =>
        u.id === doctorId ? { ...u, consultationFee: newFee } : u,
      ),
    );
  };

  // Split users into independent practitioner/admin accounts and station desk accounts
  const individualAccounts = React.useMemo(() => {
    return userList.filter((u) => u.role === Role.ADMIN || u.role === Role.DOCTOR);
  }, [userList]);

  const deskStationAccounts = React.useMemo(() => {
    return userList.filter(
      (u) =>
        u.role === Role.RECEPTIONIST ||
        u.role === Role.HANDLER ||
        u.role === Role.CASHIER,
    );
  }, [userList]);

  // Total active sessions tally
  const totalActiveSessions = React.useMemo(() => {
    return userList.reduce((acc, u) => acc + u.activeSessionCount, 0);
  }, [userList]);

  // Filter individual accounts by search
  const filteredAccounts = React.useMemo(() => {
    if (!searchQuery.trim()) return individualAccounts;
    const q = searchQuery.toLowerCase();
    return individualAccounts.filter(
      (u) =>
        u.role.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.whatsapp && u.whatsapp.toLowerCase().includes(q)),
    );
  }, [individualAccounts, searchQuery]);

  // Filter desk stations by search
  const filteredDesks = React.useMemo(() => {
    if (!searchQuery.trim()) return deskStationAccounts;
    const q = searchQuery.toLowerCase();
    return deskStationAccounts.filter(
      (u) =>
        u.role.toLowerCase().includes(q) ||
        u.performers.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.whatsapp && p.whatsapp.toLowerCase().includes(q)) ||
            (p.email && p.email.toLowerCase().includes(q)),
        ),
    );
  }, [deskStationAccounts, searchQuery]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      toast.success("Account ID copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDeleteAccount = async (account: UserAccountData) => {
    if (!confirm(`Are you sure you want to delete the ${account.role} account for ${account.name || account.email}?`)) {
      return;
    }
    const res = await deleteUserAccountAction(account.id);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------- */}
      {/* 1. Header & Architecture Notice                      */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                <Users className="size-3.5" />
                Access &amp; Identity Control
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10.5px] font-bold">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {totalActiveSessions} Active Session{totalActiveSessions === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[10.5px] font-semibold">
                <ShieldCheck className="size-3" />
                4-Digit Staff PIN Security
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Users &amp; Staff Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Independent accounts for Admins &amp; Doctors • Shared Station Desks with 4-digit PIN verification for Receptionists, Handlers, and Cashiers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateAccountOpen(true)}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs bg-sky-600 hover:bg-sky-700 text-white"
            >
              <UserPlus className="size-3.5" />
              <span>Add Admin / Doctor</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                setDefaultPerformerUserId(null);
                setCreatePerformerOpen(true);
              }}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              <UserCheck className="size-3.5" />
              <span>Add Desk Performer</span>
            </Button>

            <Link
              href="/admin"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
            >
              <span>Back</span>
            </Link>
          </div>
        </div>

        {/* System Architecture Explanation Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5">
              <div className="size-7 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                <Stethoscope className="size-3.5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="font-bold text-sky-900 dark:text-sky-200">
                  Individual Accounts: ADMIN &amp; DOCTOR
                </h2>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Multiple independent accounts allowed. Log in directly with personal Email/WhatsApp and password. No performers needed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="size-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="size-3.5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="font-bold text-amber-900 dark:text-amber-200">
                  Shared Desks: RECEPTIONIST, HANDLER, CASHIER
                </h2>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Single shared desk account. Rotating staff members authorize actions at the desk using their personal 4-digit security PIN.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. Navigation Tabs & Search Bar                     */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/80 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("accounts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "accounts"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="size-3.5 text-sky-500" />
            <span>Admins &amp; Doctors ({individualAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("desks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "desks"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-3.5 text-amber-500" />
            <span>Station Desks &amp; Performers ({deskStationAccounts.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "accounts"
                ? "Search by name, email, whatsapp..."
                : "Search desk or staff performer..."
            }
            className="pl-8 text-xs rounded-xl h-9 bg-card border-border/80"
          />
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. Tab 1: Admins & Doctors (Independent Accounts)   */}
      {/* ---------------------------------------------------- */}
      {activeTab === "accounts" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((user) => {
              const roleConfig: RoleConfig =
                ROLES.find((r) => r.value === user.role) || ROLES[0];
              const RoleIcon = roleConfig.icon;
              const isOnline = user.activeSessionCount > 0;

              return (
                <Card
                  key={user.id}
                  className="relative overflow-hidden border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between rounded-2xl"
                >
                  <div>
                    {/* Top Row */}
                    <CardHeader className="p-4 pb-3 border-b border-border/60">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${roleConfig.color}`}
                          >
                            <RoleIcon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold text-foreground leading-tight truncate">
                              {user.name || roleConfig.defaultLabel}
                            </CardTitle>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                              {user.role}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isOnline
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-muted/80 text-muted-foreground border border-border"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                            }`}
                          />
                          {isOnline ? `${user.activeSessionCount} Active` : "Offline"}
                        </span>
                      </div>
                    </CardHeader>

                    {/* Account Contact & Credentials */}
                    <CardContent className="p-4 space-y-2 text-xs">
                      {user.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="size-3.5 shrink-0 text-sky-500" />
                          <span className="font-mono text-foreground truncate select-all">
                            {user.email}
                          </span>
                        </div>
                      )}

                      {user.whatsapp && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="size-3.5 shrink-0 text-emerald-500" />
                          <span className="font-mono text-foreground select-all">
                            {user.whatsapp}
                          </span>
                        </div>
                      )}

                      {user.role === Role.DOCTOR && (
                        <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between mt-1">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                              <Banknote className="size-3.5" />
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-none">
                                Default Consultation Fee
                              </div>
                              <div className="text-xs sm:text-sm font-black text-foreground font-mono mt-0.5">
                                ৳{(user.consultationFee ?? 1000).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedDoctorForFee(user)}
                            className="h-6.5 px-2 text-[10.5px] rounded-lg border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15 font-bold cursor-pointer gap-1"
                          >
                            <Pencil className="size-2.5" />
                            <span>Set Fee</span>
                          </Button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border/40 text-[10.5px] text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          Added {formatBSTShortDate(user.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(user.id)}
                          className="font-mono text-[9.5px] hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === user.id ? (
                            <Check className="size-2.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-2.5" />
                          )}
                          <span>ID: {user.id.slice(-6)}</span>
                        </button>
                      </div>
                    </CardContent>
                  </div>

                  {/* Account Actions */}
                  <div className="p-3 pt-0 flex items-center justify-between gap-1.5 border-t border-border/40 mt-auto bg-muted/10">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setSelectedUserForReset({ id: user.id, role: user.role })
                        }
                        className="rounded-lg h-7 text-[11px] gap-1 cursor-pointer"
                      >
                        <KeyRound className="size-3 text-amber-500" />
                        <span>Reset Password</span>
                      </Button>

                      {user.role === Role.DOCTOR && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setSelectedDoctorForFee(user)}
                          className="rounded-lg h-7 text-[11px] gap-1 cursor-pointer border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 font-bold"
                          title="Set Doctor Default Consultation Fee"
                        >
                          <Banknote className="size-3 text-sky-500" />
                          <span>Fee: ৳{(user.consultationFee ?? 1000).toLocaleString()}</span>
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {user.activeSessionCount > 0 && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setSelectedUserForRevoke({
                              id: user.id,
                              role: user.role,
                              activeSessionCount: user.activeSessionCount,
                            })
                          }
                          className="rounded-lg h-7 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Revoke Active Sessions"
                        >
                          Revoke
                        </Button>
                      )}

                      {/* Can delete non-primary accounts */}
                      {individualAccounts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleDeleteAccount(user)}
                          className="rounded-lg h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Account"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredAccounts.length === 0 && (
            <div className="p-8 text-center border rounded-2xl bg-card text-muted-foreground text-xs space-y-2">
              <p>No doctor or admin accounts found matching your search.</p>
              <Button
                size="sm"
                onClick={() => setCreateAccountOpen(true)}
                className="rounded-xl text-xs gap-1.5"
              >
                <UserPlus className="size-3.5" />
                <span>Add Doctor Account</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. Tab 2: Station Desks & Multi-Staff Performers    */}
      {/* ---------------------------------------------------- */}
      {activeTab === "desks" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredDesks.map((desk) => {
              const roleConfig: RoleConfig =
                ROLES.find((r) => r.value === desk.role) || ROLES[0];
              const RoleIcon = roleConfig.icon;
              const isOnline = desk.activeSessionCount > 0;

              return (
                <Card
                  key={desk.id}
                  className="border-border/80 bg-card shadow-xs rounded-2xl flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Desk Card Header */}
                    <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`size-9 rounded-xl border flex items-center justify-center shrink-0 ${roleConfig.color}`}
                          >
                            <RoleIcon className="size-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold text-foreground leading-tight">
                              {roleConfig.defaultLabel} Desk
                            </CardTitle>
                            <p className="text-[10px] text-muted-foreground">
                              Shared Physical Station
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOnline
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                            }`}
                          />
                          {isOnline ? "Station Online" : "Station Idle"}
                        </span>
                      </div>
                    </CardHeader>

                    {/* Desk Performers List */}
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground flex items-center gap-1.5">
                          <UserCheck className="size-3.5 text-primary" />
                          Authorized Staff ({desk.performers.length})
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setDefaultPerformerUserId(desk.id);
                            setCreatePerformerOpen(true);
                          }}
                          className="h-6 text-[10.5px] font-semibold text-primary hover:bg-primary/10 gap-1 rounded-lg cursor-pointer"
                        >
                          <UserPlus className="size-3" />
                          <span>Add Staff</span>
                        </Button>
                      </div>

                      {desk.performers.length > 0 ? (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {desk.performers.map((perf) => (
                            <div
                              key={perf.id}
                              className="p-2 rounded-xl border border-border/70 bg-background/60 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-foreground truncate">
                                  {perf.name}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mt-0.5">
                                  <span className="flex items-center gap-0.5 truncate">
                                    <Phone className="size-2.5" />
                                    {perf.whatsapp || perf.phone}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                                    PIN: {perf.pin}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setPerformerToDelete({
                                    id: perf.id,
                                    name: perf.name,
                                    phone: perf.whatsapp || perf.phone,
                                    roleLabel: roleConfig.defaultLabel,
                                  })
                                }
                                className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors cursor-pointer"
                                title="Remove staff member"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center rounded-xl bg-muted/30 border border-dashed border-border/80 text-[11px] text-muted-foreground">
                          No staff performers registered for this desk yet.
                        </div>
                      )}
                    </CardContent>
                  </div>

                  {/* Desk Password & Station Actions */}
                  <div className="p-3 pt-2 border-t border-border/50 bg-muted/10 flex items-center justify-between text-xs">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() =>
                        setSelectedUserForReset({ id: desk.id, role: desk.role })
                      }
                      className="rounded-lg h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <Lock className="size-3 text-muted-foreground" />
                      <span>Station Password</span>
                    </Button>

                    {desk.activeSessionCount > 0 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setSelectedUserForRevoke({
                            id: desk.id,
                            role: desk.role,
                            activeSessionCount: desk.activeSessionCount,
                          })
                        }
                        className="rounded-lg h-7 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer"
                      >
                        Terminate Sessions
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. Dialogs: Account Creation, Performer, Reset, etc. */}
      {/* ---------------------------------------------------- */}
      <CreateAccountDialog
        open={createAccountOpen}
        onOpenChange={setCreateAccountOpen}
      />

      <CreatePerformerDialog
        open={createPerformerOpen}
        onOpenChange={setCreatePerformerOpen}
        users={deskStationAccounts.map((u) => ({ id: u.id, role: u.role }))}
        defaultUserId={defaultPerformerUserId}
      />

      {selectedUserForReset && (
        <PasswordResetDialog
          open={!!selectedUserForReset}
          onOpenChange={(open) => !open && setSelectedUserForReset(null)}
          user={selectedUserForReset}
          adminPerformers={[]}
        />
      )}

      {selectedUserForRevoke && (
        <RevokeSessionsDialog
          open={!!selectedUserForRevoke}
          onOpenChange={(open) => !open && setSelectedUserForRevoke(null)}
          user={selectedUserForRevoke}
          adminPerformers={[]}
        />
      )}

      {performerToDelete && (
        <DeletePerformerDialog
          open={!!performerToDelete}
          onOpenChange={(open) => !open && setPerformerToDelete(null)}
          performer={performerToDelete}
          adminPerformers={[]}
        />
      )}

      {selectedDoctorForFee && (
        <EditDoctorFeeDialog
          open={Boolean(selectedDoctorForFee)}
          onOpenChange={(open) => !open && setSelectedDoctorForFee(null)}
          doctor={selectedDoctorForFee}
          onSuccess={handleDoctorFeeSuccess}
        />
      )}
    </div>
  );
}
