import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export function getDatabaseFilePath(): string {
  const connectionString = process.env.DATABASE_URL || "file:./hpc.db";
  const rawPath = connectionString.replace(/^file:/, "");
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath);
}

const initSqlitePragmas = (dbPath: string) => {
  try {
    const rawDb = new Database(dbPath, { timeout: 5000 });
    rawDb.pragma("journal_mode = WAL");
    rawDb.pragma("synchronous = NORMAL");
    rawDb.pragma("foreign_keys = ON");
    rawDb.close();
  } catch (err) {
    console.warn("[SQLite WAL init warning]:", err);
  }
};

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL || "file:./hpc.db";
  const dbPath = getDatabaseFilePath();
  initSqlitePragmas(dbPath);

  const adapter = new PrismaBetterSqlite3({
    url: connectionString,
    timeout: 5000,
  });
  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

/**
 * Safely creates an online SQLite backup without locking active reads/writes.
 */
export async function backupDatabaseToFolder(destDir?: string): Promise<string> {
  const dbPath = getDatabaseFilePath();
  const targetDir = destDir || path.resolve(/*turbopackIgnore: true*/ process.cwd(), "backups");
  if (!fs.existsSync(/*turbopackIgnore: true*/ targetDir)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ targetDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `hpc-backup-${timestamp}.db`;
  const backupFilePath = path.join(targetDir, backupFileName);

  const rawDb = new Database(dbPath, { readonly: true, timeout: 5000 });
  try {
    await rawDb.backup(backupFilePath);
    return backupFilePath;
  } finally {
    rawDb.close();
  }
}

export default prisma;

