"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { resetUserPasswordAction } from "@/actions/admin/user.action";
import {
  AdminPerformerSelect,
  type AdminPerformer,
} from "@/components/admin/users/admin-performer-select";
import type { Role } from "@/generated/prisma/enums";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  Wand2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface PasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    role: Role;
  } | null;
  adminPerformers?: AdminPerformer[];
}

/**
 * Generates a high-entropy, 14-character secure password.
 */
function generateRandomPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "@#%&*+!?";
  const all = upper + lower + numbers + symbols;

  let pwd = "";
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < 14; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return pwd
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export function PasswordResetDialog({
  open,
  onOpenChange,
  user,
  adminPerformers = [],
}: PasswordResetDialogProps) {
  const [selectedPerformerId, setSelectedPerformerId] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [revokeSessions, setRevokeSessions] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Password strength calculation - must be called before any early return
  const strengthScore = React.useMemo(() => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  }, [newPassword]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedPerformerId("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setRevokeSessions(true);
      setCopied(false);
      setErrorMessage(null);
    }
    onOpenChange(nextOpen);
  };

  if (!user) return null;

  const strengthLabels = [
    "Very Weak",
    "Weak",
    "Fair",
    "Strong",
    "Super Secure",
  ];
  const strengthColors = [
    "bg-destructive",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-emerald-500",
    "bg-teal-500",
  ];

  const handleGenerate = () => {
    const generated = generateRandomPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setErrorMessage(null);

    // Auto copy to clipboard
    navigator.clipboard.writeText(generated).then(() => {
      setCopied(true);
      toast.success("Generated secure password & copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleCopy = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword).then(() => {
      setCopied(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (adminPerformers && adminPerformers.length > 1 && !selectedPerformerId) {
      setErrorMessage(
        "Please select which administrator staff member is authorizing this password reset.",
      );
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", user.id);
      if (selectedPerformerId) {
        formData.set("performerId", selectedPerformerId);
      }
      formData.set("newPassword", newPassword);
      formData.set("confirmPassword", confirmPassword);
      formData.set("revokeSessions", revokeSessions ? "true" : "false");

      const res = await resetUserPasswordAction(undefined, formData);

      if (res.success) {
        toast.success(res.message);
        handleOpenChange(false);
      } else {
        setErrorMessage(res.message);
        toast.error(res.message);
      }
    });
  };

  const isSubmitDisabled =
    isPending ||
    !newPassword ||
    !confirmPassword ||
    (adminPerformers && adminPerformers.length > 1 && !selectedPerformerId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[min(90vh,760px)] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-border/80">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {/* Header Banner */}
          <div className="shrink-0 bg-muted/40 p-5 pb-4 border-b border-border/60">
            <DialogHeader>
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Reset Account Password
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Updating credentials for the immutable{" "}
                    <span className="font-bold text-foreground">
                      {user.role}
                    </span>{" "}
                    role.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Mandatory Admin Performer Selection */}
            <AdminPerformerSelect
              adminPerformers={adminPerformers}
              selectedPerformerId={selectedPerformerId}
              onSelectPerformerId={setSelectedPerformerId}
              disabled={isPending}
              label="Authorizing Administrator"
            />

            {/* New Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="newPassword" className="text-xs font-semibold">
                  New Password
                </Label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <Wand2 className="size-3" />
                  <span>Generate Strong Password</span>
                </button>
              </div>

              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter at least 8 characters"
                  className="pr-20 rounded-xl text-xs h-9"
                  required
                  minLength={8}
                  disabled={isPending}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {newPassword && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Strength Meter Bar */}
              {newPassword && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      Strength: {strengthLabels[Math.min(strengthScore, 4)]}
                    </span>
                    <span>{newPassword.length} chars</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-full flex-1 rounded-full transition-all ${
                          strengthScore >= lvl
                            ? strengthColors[Math.min(strengthScore - 1, 4)]
                            : "bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <Label
                htmlFor="confirmPassword"
                className="text-xs font-semibold"
              >
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="pr-9 rounded-xl text-xs h-9"
                  required
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Session Revocation Checkbox */}
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="revokeSessions"
                checked={revokeSessions}
                onCheckedChange={(c) => setRevokeSessions(!!c)}
                className="rounded-md mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="revokeSessions"
                  className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1"
                >
                  <span>Terminate all active sessions</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    (Recommended)
                  </span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Forces immediate logout across all devices currently logged in
                  with this role.
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Dialog Action Buttons */}
          <div className="shrink-0 px-6 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
              className="rounded-xl text-xs font-semibold h-9 px-4 border-border/80 hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitDisabled}
              className="rounded-xl text-xs font-semibold gap-1.5 shadow-sm h-9 px-4 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Hashing with Argon2id...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
