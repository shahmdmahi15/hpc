import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Role } from "@/generated/prisma/enums";

export const ROLE_DASHBOARDS: Record<Role, string> = {
  [Role.ADMIN]: "/admin",
  [Role.DOCTOR]: "/doctor",
  [Role.RECEPTIONIST]: "/receptionist",
  [Role.HANDLER]: "/handler",
};

export const PROTECTED_ROUTES = [
  "/admin",
  "/doctor",
  "/receptionist",
  "/handler",
];

export function getRoleDashboard(role: Role | string): string {
  return ROLE_DASHBOARDS[role as Role] || "/";
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isAllowedForRole(
  pathname: string,
  role: Role | string,
): boolean {
  if (role === Role.ADMIN) return true; // Admin has full access to all panels
  if (pathname === "/doctor" || pathname.startsWith("/doctor/"))
    return role === Role.DOCTOR;
  if (pathname === "/receptionist" || pathname.startsWith("/receptionist/"))
    return role === Role.RECEPTIONIST;
  if (pathname === "/handler" || pathname.startsWith("/handler/"))
    return role === Role.HANDLER;
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return role === Role.ADMIN;
  return true;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionToken =
    request.cookies.get("__Host-SESSION_TOKEN")?.value ||
    request.cookies.get("SESSION_TOKEN")?.value;

  // If accessing protected dashboard routes without session cookie -> redirect to /login
  if (isProtectedRoute(pathname) && !sessionToken) {
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
