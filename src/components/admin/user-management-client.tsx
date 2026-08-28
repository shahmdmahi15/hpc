"use client";

import * as React from "react";
import { Role } from "@/generated/prisma/enums";
import { revokeUserSessionsAction } from "@/actions/admin/user.action";
import { CreateUserModal } from "@/components/admin/create-user-modal";
import { EditUserModal } from "@/components/admin/edit-user-modal";
import { ResetPasswordModal } from "@/components/admin/reset-password-modal";
import { DeleteUserModal } from "@/components/admin/delete-user-modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  Trash2,
  LogOut,
  ShieldAlert,
  Stethoscope,
  Headphones,
  UserCheck,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

export interface StaffUserItem {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
  activeSessionsCount: number;
}

interface UserManagementClientProps {
  initialUsers: StaffUserItem[];
  currentUserId: string;
}

export function UserManagementClient({
  initialUsers,
  currentUserId,
}: UserManagementClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = React.useState<
    "ALL" | Role
  >("ALL");

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<StaffUserItem | null>(
    null,
  );
  const [resettingUser, setResettingUser] =
    React.useState<StaffUserItem | null>(null);
  const [deletingUser, setDeletingUser] = React.useState<StaffUserItem | null>(
    null,
  );

  // Revoke state
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  // Filter users
  const filteredUsers = initialUsers.filter((user) => {
    const matchesSearch = user.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesRole =
      selectedRoleFilter === "ALL" || user.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate statistics
  const stats = {
    total: initialUsers.length,
    admins: initialUsers.filter((u) => u.role === Role.ADMIN).length,
    doctors: initialUsers.filter((u) => u.role === Role.DOCTOR).length,
    receptionists: initialUsers.filter((u) => u.role === Role.RECEPTIONIST)
      .length,
    handlers: initialUsers.filter((u) => u.role === Role.HANDLER).length,
  };

  const handleRevokeSessions = async (userId: string) => {
    setRevokingId(userId);
    const fd = new FormData();
    fd.append("userId", userId);
    await revokeUserSessionsAction(undefined, fd);
    toast.success("Active sessions revoked successfully.");
    setRevokingId(null);
  };

  const ROLE_BADGE_STYLES: Record<Role, string> = {
    [Role.ADMIN]: "border-red-500/30 bg-red-500/10 text-red-500",
    [Role.DOCTOR]: "border-cyan-500/30 bg-cyan-500/10 text-cyan-500",
    [Role.RECEPTIONIST]:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    [Role.HANDLER]: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  };

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {/* 1. Metric Stat Cards (Compact & High Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 min-w-0">
        {/* Total Staff */}
        <div className="flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground">
              Total Staff
            </span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-black font-mono text-foreground">
              {stats.total}
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">
              Active accounts
            </p>
          </div>
        </div>

        {/* Doctors */}
        <div className="flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-cyan-500">
              Specialists
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
              <Stethoscope className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-black font-mono text-foreground">
              {stats.doctors}
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">
              Pain care doctors
            </p>
          </div>
        </div>

        {/* Receptionists */}
        <div className="flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-500">
              Front Desk
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Headphones className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-black font-mono text-foreground">
              {stats.receptionists}
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">
              Intake & check-in
            </p>
          </div>
        </div>

        {/* Handlers */}
        <div className="flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-amber-500">
              Care Handlers
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-black font-mono text-foreground">
              {stats.handlers}
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">
              Rehab & mobility
            </p>
          </div>
        </div>

        {/* Administrators */}
        <div className="col-span-2 sm:col-span-1 flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-red-500">
              Administrators
            </span>
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
              <ShieldAlert className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1">
            <div className="text-lg sm:text-xl font-black font-mono text-foreground">
              {stats.admins}
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">
              System operators
            </p>
          </div>
        </div>
      </div>

      {/* 2. Search, Filter & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1.5 sm:p-2 rounded-xl border border-border bg-card shadow-xs max-w-full min-w-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff members..."
            className="pl-8 h-7.5 text-xs bg-background/50"
          />
        </div>

        {/* Role Filters & Create Button */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Role Filter Pills */}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border">
            {(
              [
                { label: "All", value: "ALL" },
                { label: "Doctors", value: Role.DOCTOR },
                { label: "Reception", value: Role.RECEPTIONIST },
                { label: "Handlers", value: Role.HANDLER },
                { label: "Admins", value: Role.ADMIN },
              ] as const
            ).map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSelectedRoleFilter(filter.value)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  selectedRoleFilter === filter.value
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Add Staff Member Button */}
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="cursor-pointer gap-1 font-semibold shadow-xs h-7.5 text-xs px-2.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Staff</span>
          </Button>
        </div>
      </div>

      {/* 3. Staff Users Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-2.5 px-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-bold text-foreground">
              Clinic Staff Directory
            </h3>
            <span className="text-[10px] text-muted-foreground ml-1">
              ({filteredUsers.length}{" "}
              {filteredUsers.length === 1 ? "member" : "members"})
            </span>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-foreground">
              No staff members found
            </p>
            <p className="text-xs mt-1">
              Try adjusting your search criteria or add a new team member.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Staff Member</TableHead>
                <TableHead>Department / Role</TableHead>
                <TableHead>Active Sessions</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                return (
                  <TableRow key={user.id}>
                    {/* User Identity */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                            {user.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {user.name}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded border border-primary/20">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            ID: {user.id.slice(0, 10)}...
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Role Badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ROLE_BADGE_STYLES[user.role]}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>

                    {/* Active Sessions */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            user.activeSessionsCount > 0
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-muted-foreground/40"
                          }`}
                        />
                        <span className="text-xs text-foreground font-medium">
                          {user.activeSessionsCount}{" "}
                          {user.activeSessionsCount === 1
                            ? "device"
                            : "devices"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Onboarded Date */}
                    <TableCell
                      suppressHydrationWarning
                      className="text-xs text-muted-foreground"
                    >
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Details */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingUser(user)}
                          title="Edit Staff Member"
                          className="hover:bg-primary/10 hover:text-primary cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        {/* Reset Password */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setResettingUser(user)}
                          title="Reset Password"
                          className="hover:bg-amber-500/10 hover:text-amber-500 cursor-pointer"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>

                        {/* Revoke Sessions */}
                        {user.activeSessionsCount > 0 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRevokeSessions(user.id)}
                            disabled={revokingId === user.id}
                            title="Revoke Active Sessions"
                            className="hover:bg-purple-500/10 hover:text-purple-500 cursor-pointer"
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Delete Account (disabled for self) */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeletingUser(user)}
                          disabled={isCurrentUser}
                          title={
                            isCurrentUser
                              ? "Cannot delete your own active account"
                              : "Delete Staff Account"
                          }
                          className="hover:bg-destructive/10 hover:text-destructive cursor-pointer disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 4. Active Modals */}
      <CreateUserModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <EditUserModal
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />
      <ResetPasswordModal
        user={resettingUser}
        open={!!resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
      />
      <DeleteUserModal
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
      />
    </div>
  );
}
