"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLES, type RoleConfig } from "@/components/login/role-config";
import { createPerformerAction } from "@/actions/admin/performer.action";
import type { Role } from "@/generated/prisma/enums";
import { toast } from "sonner";
import {
  UserPlus,
  Phone,
  User as UserIcon,
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  AdminPerformerSelect,
  type AdminPerformer,
} from "@/components/admin/users/admin-performer-select";

interface RoleUserOption {
  id: string;
  role: Role;
}

interface CreatePerformerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: RoleUserOption[];
  defaultUserId?: string | null;
  adminPerformers?: AdminPerformer[];
}

export function CreatePerformerDialog({
  open,
  onOpenChange,
  users,
  defaultUserId,
  adminPerformers = [],
}: CreatePerformerDialogProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string>(
    () => defaultUserId || users[0]?.id || "",
  );
  const [selectedAdminPerformerId, setSelectedAdminPerformerId] =
    React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[] | undefined>
  >({});
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Reset form when dialog closes or defaultUserId changes
  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setPhone("");
      setSelectedAdminPerformerId("");
      setFieldErrors({});
      setGeneralError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (adminPerformers.length > 1 && !selectedAdminPerformerId) {
      setGeneralError(
        "Please select the administrator authorizing this staff member creation.",
      );
      return;
    }

    if (!selectedUserId) {
      setGeneralError("Please choose a department desk.");
      return;
    }

    if (!name.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        name: ["Please enter the staff member's name."],
      }));
      return;
    }

    if (!phone.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        phone: ["Please enter the staff member's phone number."],
      }));
      return;
    }

    const formData = new FormData();
    formData.append("userId", selectedUserId);
    formData.append("name", name.trim());
    formData.append("phone", phone.trim());
    if (selectedAdminPerformerId) {
      formData.append("adminPerformerId", selectedAdminPerformerId);
    }

    startTransition(async () => {
      const result = await createPerformerAction(undefined, formData);

      if (result.success) {
        toast.success("Staff performer created", {
          description: result.message,
        });
        handleClose(false);
      } else {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        if (result.message) {
          setGeneralError(result.message);
          toast.error("Failed to add performer", {
            description: result.message,
          });
        }
      }
    });
  };

  // Find current selected role configuration
  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedRoleConfig: RoleConfig | undefined = selectedUser
    ? ROLES.find((r) => r.value === selectedUser.role)
    : undefined;

  const isSubmitDisabled =
    isPending ||
    !name.trim() ||
    !phone.trim() ||
    !selectedUserId ||
    (adminPerformers.length > 1 && !selectedAdminPerformerId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[min(90vh,760px)] flex flex-col p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Header Banner */}
          <div className="shrink-0 bg-muted/40 p-5 pb-4 border-b border-border/60">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                  <UserPlus className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Add Staff Performer
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Register a staff member who operates at this department
                    desk.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Form Content - Scrollable if screen is short */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {generalError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            {/* Authorizing Admin Staff Selector */}
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={selectedAdminPerformerId}
              onSelectPerformerId={setSelectedAdminPerformerId}
              disabled={isPending}
              label="Authorizing Administrator"
              error={fieldErrors.adminPerformerId?.[0]}
            />

            {/* Department Desk Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" />
                Department Station / Desk
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {users.map((u) => {
                  const cfg = ROLES.find((r) => r.value === u.role);
                  const Icon = cfg?.icon || Building2;
                  const label = cfg?.defaultLabel || u.role;
                  const isSelected = u.id === selectedUserId;

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 font-semibold shadow-xs"
                          : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`size-7 rounded-lg border flex items-center justify-center shrink-0 ${
                          isSelected && cfg
                            ? cfg.color
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-foreground">
                          {label}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase truncate">
                          {u.role}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.userId && (
                <p className="text-[11px] text-destructive font-medium">
                  {fieldErrors.userId[0]}
                </p>
              )}
            </div>

            {/* 2-Column Name & Phone Inputs for Compact Height */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Performer Name Input */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="performer-name"
                  className="text-xs font-bold text-foreground flex items-center gap-1.5"
                >
                  <UserIcon className="size-3.5 text-muted-foreground" />
                  Staff Full Name
                </Label>
                <Input
                  id="performer-name"
                  type="text"
                  placeholder={
                    selectedRoleConfig?.defaultLabel === "Doctor"
                      ? "e.g. Dr. Tariqul Islam"
                      : "e.g. Amina Begum"
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  className="h-9 text-xs rounded-xl"
                  autoFocus
                />
                {fieldErrors.name ? (
                  <p className="text-[11px] text-destructive font-medium">
                    {fieldErrors.name[0]}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Official name displayed on patient records.
                  </p>
                )}
              </div>

              {/* Performer Phone Input */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="performer-phone"
                  className="text-xs font-bold text-foreground flex items-center gap-1.5"
                >
                  <Phone className="size-3.5 text-muted-foreground" />
                  Contact Phone Number
                </Label>
                <Input
                  id="performer-phone"
                  type="tel"
                  placeholder="e.g. 01712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                  className="h-9 text-xs rounded-xl font-mono"
                />
                {fieldErrors.phone ? (
                  <p className="text-[11px] text-destructive font-medium">
                    {fieldErrors.phone[0]}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Used to switch profile at station desk.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Dialog Action Buttons */}
          <div className="shrink-0 px-6 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleClose(false)}
              disabled={isPending}
              className="rounded-xl text-xs font-semibold cursor-pointer h-9 px-4 border-border/80 hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitDisabled}
              className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer shadow-sm h-9 px-4"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Add Performer</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
