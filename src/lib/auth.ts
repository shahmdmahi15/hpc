import "server-only";
import crypto from "node:crypto";
import argon2 from "argon2";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import type { User, Session } from "@/generated/prisma/client";

export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-SESSION_TOKEN"
    : "SESSION_TOKEN";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

// ----------------------------------------------------
// Password Hashing & Verification using Argon2id
// ----------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// Secure Session Token Generation & Hashing via node:crypto
// ----------------------------------------------------
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ----------------------------------------------------
// Database Session Management
// ----------------------------------------------------
export async function createSession(
  userId: string,
): Promise<{ token: string; session: Session }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = await prisma.session.create({
    data: {
      token: tokenHash,
      userId,
      expiresAt,
      lastAccessAt: new Date(),
    },
  });

  return { token, session };
}

export async function validateSessionToken(
  token: string,
): Promise<{ user: User; session: Session } | null> {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check if session was revoked or expired
  if (session.revokedAt !== null || Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Rolling refresh if past threshold
  const now = Date.now();
  const needsRefresh =
    session.expiresAt.getTime() - now < SESSION_REFRESH_THRESHOLD_MS;

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      lastAccessAt: new Date(),
      expiresAt: needsRefresh ? new Date(now + SESSION_DURATION_MS) : undefined,
    },
  });

  return { session: updatedSession, user: session.user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// ----------------------------------------------------
// HTTP-Only Cookie Helpers
// ----------------------------------------------------
export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

export async function getCurrentSession(): Promise<{
  user: User;
  session: Session;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await validateSessionToken(token);
}
