import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/enums";

export const ROLE_DASHBOARDS: Record<Role, string> = {
  [Role.ADMIN]: "/admin",
  [Role.DOCTOR]: "/doctor",
  [Role.RECEPTIONIST]: "/receptionist",
  [Role.HANDLER]: "/handler",
  [Role.CASHIER]: "/cashier",
};

export const ROLE_ROUTE_PREFIXES: Record<string, Role> = {
  "/admin": Role.ADMIN,
  "/doctor": Role.DOCTOR,
  "/receptionist": Role.RECEPTIONIST,
  "/handler": Role.HANDLER,
  "/cashier": Role.CASHIER,
};

export function getRoleDashboard(role?: Role | string): string {
  if (role && role in ROLE_DASHBOARDS) {
    return ROLE_DASHBOARDS[role as Role];
  }
  return "/login";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionToken =
    request.cookies.get("__Host-SESSION_TOKEN")?.value ||
    request.cookies.get("SESSION_TOKEN")?.value;

  // Check if accessing a protected role route (/admin, /doctor, /receptionist, /handler, /cashier)
  const isProtectedRoleRoute = Object.keys(ROLE_ROUTE_PREFIXES).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // 1. Unauthenticated trying to access a protected role route -> redirect to /login
  if (isProtectedRoleRoute && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff|woff2)$).*)",
  ],
};
