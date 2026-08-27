"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  updateProfileInfoAction,
  updatePasswordAction,
} from "@/actions/profile/profile.action";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";

import { UserSessionsManager } from "@/components/sessions/user-sessions-manager";

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    role: Role;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [infoState, infoFormAction, isInfoPending] = useActionState(
    updateProfileInfoAction,
    undefined,
  );

  const [pwState, pwFormAction, isPwPending] = useActionState(
    updatePasswordAction,
    undefined,
  );

  const [showCurrentPw, setShowCurrentPw] = React.useState(false);
  const [showNewPw, setShowNewPw] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Profile Information Card */}
        <form
          action={infoFormAction}
          suppressHydrationWarning
          className="flex flex-col"
        >
          <Card className="h-full shadow-lg border-border bg-card/85 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <User className="h-4 w-4" />
                <span>Profile Details</span>
              </div>
              <CardTitle className="text-xl font-bold">
                Personal Information
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Update your public display name associated with your staff
                account
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {infoState?.message && (
                <div
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${
                    infoState.success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {infoState.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{infoState.message}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={user.name}
                  required
                  disabled={isInfoPending}
                />
                {infoState?.fieldErrors?.name && (
                  <p className="text-xs text-destructive font-medium">
                    {infoState.fieldErrors.name[0]}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                variant="default"
                disabled={isInfoPending}
                className="cursor-pointer"
              >
                {isInfoPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  "Save Profile Changes"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>

        {/* 2. Change Password Card */}
        <form
          action={pwFormAction}
          suppressHydrationWarning
          className="flex flex-col"
        >
          <Card className="h-full shadow-lg border-border bg-card/85 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <KeyRound className="h-4 w-4" />
                <span>Password &amp; Security</span>
              </div>
              <CardTitle className="text-xl font-bold">
                Change Password
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Ensure your staff authentication credentials remain strong and
                unique
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {pwState?.message && (
                <div
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${
                    pwState.success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}
                >
                  {pwState.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  )}
                  <span>{pwState.message}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPw ? "text" : "password"}
                    placeholder="Enter current password..."
                    required
                    disabled={isPwPending}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showCurrentPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {pwState?.fieldErrors?.currentPassword && (
                  <p className="text-xs text-destructive font-medium">
                    {pwState.fieldErrors.currentPassword[0]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPw ? "text" : "password"}
                    placeholder="Enter new password (min. 8 characters)..."
                    required
                    disabled={isPwPending}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showNewPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {pwState?.fieldErrors?.newPassword && (
                  <p className="text-xs text-destructive font-medium">
                    {pwState.fieldErrors.newPassword[0]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password..."
                  required
                  disabled={isPwPending}
                />
                {pwState?.fieldErrors?.confirmPassword && (
                  <p className="text-xs text-destructive font-medium">
                    {pwState.fieldErrors.confirmPassword[0]}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                variant="default"
                disabled={isPwPending}
                className="cursor-pointer"
              >
                {isPwPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>

      {/* 3. Self Session Management Section */}
      <UserSessionsManager />
    </div>
  );
}
