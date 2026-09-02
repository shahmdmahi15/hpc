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
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  KeyRound,
  Keyboard,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import { useI18n } from "@/lib/i18n";
import { ROLES, type RoleConfig } from "@/components/login/role-config";

interface LoginFormProps {
  selectedRole: Role;
  onSelectRole: (role: Role) => void;
  onOpenShortcuts?: () => void;
}

export function LoginForm({
  selectedRole,
  onSelectRole,
  onOpenShortcuts,
}: LoginFormProps) {
  const { t } = useI18n();
  const [state, formAction, isPending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = React.useState(false);
  const [capsLockActive, setCapsLockActive] = React.useState(false);

  // Handle Caps Lock detection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const currentRoleObj: RoleConfig =
    ROLES.find((r) => r.value === selectedRole) || ROLES[0];
  const currentRoleLabel = t(
    currentRoleObj.labelKey,
    currentRoleObj.defaultLabel,
  );

  return (
    <form
      action={formAction}
      suppressHydrationWarning
      className="w-full max-w-full mx-auto"
    >
      <Card
        className={`w-full shadow-2xl border bg-card/95 dark:bg-card/85 backdrop-blur-2xl rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 py-0 gap-0 ${currentRoleObj.cardGlow}`}
      >
        {/* Card Header (Compact & Flush) */}
        <CardHeader className="space-y-1 p-3.5 sm:p-4 text-center border-b border-border/50 bg-muted/20 rounded-t-2xl sm:rounded-t-3xl">
          <div className="flex items-center justify-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ring-2 ring-primary/5 ${currentRoleObj.color}`}
            >
              <Lock className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
              {t("login.title", "Staff Authentication Portal")}
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] text-muted-foreground max-w-md mx-auto leading-tight">
            {t(
              "login.subtitle",
              "Select your departmental role and enter your security credential",
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 p-3.5 sm:p-4">
          {/* General Error Alert */}
          {state?.message && !state.success && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive animate-in fade-in duration-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{state.message}</div>
            </div>
          )}

          {/* 1. Interactive Role Selector Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-muted-foreground">
                {t("login.select_role", "Select Department / Role")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenShortcuts}
                  title="View keyboard hotkeys"
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Keyboard className="h-3 w-3" />
                  <span>Keys (1-5)</span>
                </button>
                <span className="text-[10px] text-muted-foreground/70 font-normal lowercase">
                  {t("login.required", "required")}
                </span>
              </div>
            </div>

            {/* Hidden Input for Form Submission */}
            <input
              type="hidden"
              name="role"
              value={selectedRole}
              suppressHydrationWarning
            />

            {/* Visual Interactive Role Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              {ROLES.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.value;
                const label = t(role.labelKey, role.defaultLabel);
                const description = t(role.descKey, role.defaultDesc);

                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => onSelectRole(role.value)}
                    className={`group relative flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                      role.fullWidthOnSmallGrid ? "sm:col-span-2" : ""
                    } ${
                      isSelected
                        ? `${role.selectedBorder} ${role.selectedBg} ring-2 ${role.selectedRing} shadow-sm`
                        : "border-border/70 bg-background/50 hover:bg-muted/40 hover:border-muted-foreground/30"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 group-hover:scale-105 ${role.color}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground truncate">
                          {label}
                        </span>
                        <div className="flex items-center gap-1">
                          <kbd
                            className={`hidden sm:inline-block px-1.5 py-0.2 rounded border text-[9.5px] font-mono font-bold transition-colors ${
                              isSelected
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border/60 bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            {role.shortcut}
                          </kbd>
                          {isSelected && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                        {description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {state?.fieldErrors?.role && (
              <p className="text-[11px] text-destructive font-medium mt-0.5">
                {state.fieldErrors.role[0]}
              </p>
            )}
          </div>

          {/* 2. Password Input Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-[11px] font-semibold flex items-center gap-1 text-muted-foreground"
              >
                <KeyRound className="h-3 w-3 text-muted-foreground" />
                <span>{t("login.password", "Security Password")}</span>
              </Label>
              <div className="flex items-center gap-1.5">
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded border border-border/60 bg-muted/40 text-[9.5px] font-mono text-muted-foreground">
                  /
                </kbd>
                <span className="text-[10px] text-muted-foreground/70 font-normal">
                  {t("login.password_min", "min 6 characters")}
                </span>
              </div>
            </div>

            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={t(
                  "login.password_placeholder",
                  "Enter authorized password...",
                )}
                required
                autoComplete="current-password"
                disabled={isPending}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                className="h-9 sm:h-9.5 px-3 text-xs pr-9 rounded-xl bg-background/60 border-border/80 focus-visible:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Caps Lock Alert */}
            {capsLockActive && (
              <div className="flex items-center gap-1 text-[10.5px] text-amber-600 dark:text-amber-400 font-medium animate-in fade-in duration-150">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{t("login.caps_lock", "Caps Lock is ON")}</span>
              </div>
            )}

            {state?.fieldErrors?.password && (
              <p className="text-[11px] text-destructive font-medium">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 p-3.5 sm:p-4 pt-0 bg-transparent border-0 rounded-b-2xl sm:rounded-b-3xl">
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className={`w-full h-9 sm:h-9.5 text-xs font-bold active:scale-[0.99] transition-all cursor-pointer rounded-xl ${currentRoleObj.btnGradient}`}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                <span>
                  {t("login.authenticating", "Authenticating Session...")}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                <span>
                  {t("login.signin_as", "Sign In as")} {currentRoleLabel}
                </span>
                <ArrowRight className="ml-1 h-3.5 w-3.5 shrink-0" />
              </>
            )}
          </Button>

          {/* Power User Hint Pill */}
          <div className="flex items-center justify-between w-full text-[9.5px] text-muted-foreground pt-1 border-t border-border/40">
            <span className="truncate">
              Health And Pain Care Center • Encrypted Session
            </span>
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer shrink-0 font-medium"
            >
              <Keyboard className="h-3 w-3" />
              <span className="hidden sm:inline">Shortcuts (1-5, /)</span>
              <kbd className="px-1 py-0.2 rounded border border-border bg-muted/60 text-[9px] font-mono">
                ?
              </kbd>
            </button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
