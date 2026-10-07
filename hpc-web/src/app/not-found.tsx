import Link from "next/link";
import { Compass, Home, LogIn, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4 text-foreground">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-lg text-center space-y-6">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 mx-auto flex items-center justify-center">
          <Compass className="size-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-mono font-bold text-muted-foreground border border-border">
            404 • ROUTE NOT FOUND
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Page Does Not Exist
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            The clinical desk or route you are attempting to access does not exist on this Health & Pain Care Center local server.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "default" }),
              "rounded-xl font-bold text-xs sm:text-sm h-10 gap-2 cursor-pointer shadow-xs"
            )}
          >
            <Home className="size-4" />
            <span>Waiting Room</span>
          </Link>

          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-xl font-semibold text-xs sm:text-sm h-10 gap-2 cursor-pointer"
            )}
          >
            <LogIn className="size-4" />
            <span>Staff Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
