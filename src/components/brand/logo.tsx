import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "full" | "compact" | "icon";
  size?: "sm" | "md" | "lg";
}

export function BrandLogo({
  variant = "full",
  size = "md",
  className,
  ...props
}: LogoProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-12",
  };

  const imageDimensions = {
    sm: 32,
    md: 40,
    lg: 48,
  };

  const imageSizeClasses = {
    sm: "size-8 rounded-lg",
    md: "size-10 rounded-xl",
    lg: "size-12 rounded-2xl",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center select-none",
        variant !== "icon" && "gap-3",
        variant === "icon" && "justify-center",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {/* Brand Logo Image from public/logo.jpg */}
      <div
        className={cn(
          "relative overflow-hidden shrink-0 border border-border/80 shadow-sm bg-white flex items-center justify-center",
          imageSizeClasses[size],
        )}
      >
        <Image
          src="/logo.jpg"
          alt="Health And Pain Care Center Logo"
          width={imageDimensions[size]}
          height={imageDimensions[size]}
          className="size-full object-cover"
          priority
        />
      </div>

      {/* Typography */}
      {variant !== "icon" && (
        <div className="flex flex-col leading-tight text-left">
          <div className="flex items-center gap-1.5 font-bold tracking-tight text-foreground">
            <span className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
              HPC
            </span>
            {variant === "full" && (
              <span className="hidden sm:inline-block text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1 border-l border-border">
                Care Center
              </span>
            )}
          </div>
          {variant === "full" && (
            <span className="text-[11px] font-medium text-muted-foreground tracking-tight line-clamp-1">
              Health And Pain Care Center
            </span>
          )}
        </div>
      )}
    </div>
  );
}
