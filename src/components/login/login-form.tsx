"use client";

import * as React from "react";
import { useActionState } from "react";
import { loginAction } from "@/actions/login/login.action";
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
  ShieldAlert,
  Stethoscope,
  Headphones,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

import { Role } from "@/generated/prisma/enums";

const ROLES = [
  {
    value: Role.ADMIN,
    label: "Administrator",
    description: "Clinic operations, audit logs, and system controls",
    icon: ShieldAlert,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
  },
  {
    value: Role.DOCTOR,
    label: "Pain Care Specialist",
    description: "Diagnosis, pain treatment plans, and clinical notes",
    icon: Stethoscope,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  },
  {
    value: Role.RECEPTIONIST,
    label: "Front Desk Reception",
    description: "Patient intake, scheduling, and consultations",
    icon: Headphones,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    value: Role.HANDLER,
    label: "Therapy & Care Handler",
    description: "Rehabilitation support, triage, and patient care",
    icon: UserCheck,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
] as const;

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, undefined);
  const [selectedRole, setSelectedRole] = React.useState<Role>(Role.ADMIN);
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form
      action={formAction}
      suppressHydrationWarning
      className="w-full max-w-lg"
    >
      <Card className="w-full shadow-2xl border-border bg-card/85 backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-foreground">
            Staff Portal Sign In
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Select your HPC departmental role and enter your security credential
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* General Error Message */}
          {state?.message && !state.success && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{state.message}</span>
            </div>
          )}

          {/* 1. Role Selection Field */}
          <div className="space-y-3">
            <Label htmlFor="role" className="flex items-center justify-between">
              <span>Select Department / Role</span>
              <span className="text-[10px] text-muted-foreground font-normal lowercase tracking-normal">
                required
              </span>
            </Label>

            {/* Hidden Input for Form Submission */}
            <input
              type="hidden"
              name="role"
              value={selectedRole}
              suppressHydrationWarning
            />

            {/* Visual Interactive Role Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setSelectedRole(role.value)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs"
                        : "border-border bg-background/50 hover:bg-muted/40 hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${role.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground truncate">
                          {role.label}
                        </div>
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0 ml-1"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {role.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {state?.fieldErrors?.role && (
              <p className="text-xs text-destructive font-medium">
                {state.fieldErrors.role[0]}
              </p>
            )}
          </div>

          {/* 2. Password Field */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="flex items-center justify-between"
            >
              <span>Security Password</span>
              <span className="text-[10px] text-muted-foreground font-normal lowercase tracking-normal">
                min 6 characters
              </span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter authorized password..."
                required
                autoComplete="current-password"
                disabled={isPending}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {state?.fieldErrors?.password && (
              <p className="text-xs text-destructive font-medium">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full h-11 font-semibold shadow-lg hover:shadow-primary/25 active:scale-[0.99] transition-all cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating Session...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Sign In as {ROLES.find((r) => r.value === selectedRole)?.label}
              </>
            )}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Health And Pain Care Center &bull; Encrypted Database Session
            Security
          </p>
        </CardFooter>
      </Card>
    </form>
  );
}
