import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import { getDatabaseFilePath } from "@/lib/prisma";

export interface DatabaseBackupResult {
  success: boolean;
  message: string;
  timestamp: string;
  backupFileName?: string;
  backupFilePath?: string;
  compressedPath?: string;
  fileSizeBytes?: number;
  compressedSizeBytes?: number;
  gitPushed?: boolean;
}

/**
 * Executes a consistent SQLite online snapshot, compresses it to GZIP,
 * and optionally commits & pushes to a remote GitHub repository.
 */
export async function createDatabaseSnapshot(options?: {
  pushToGit?: boolean;
  destDir?: string;
}): Promise<DatabaseBackupResult> {
  try {
    const dbPath = getDatabaseFilePath();

    if (!fs.existsSync(dbPath)) {
      return {
        success: false,
        message: `Database file not found at: ${dbPath}`,
        timestamp: new Date().toISOString(),
      };
    }

    const backupDir =
      options?.destDir || path.resolve(/*turbopackIgnore: true*/ process.cwd(), "backups");
    if (!fs.existsSync(/*turbopackIgnore: true*/ backupDir)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ backupDir, { recursive: true });
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const baseName = `hpc-backup-${dateStr}_${timeStr}`;
    const backupDbPath = path.join(backupDir, `${baseName}.db`);
    const latestDbPath = path.join(backupDir, "latest.db");

    // 1. Checkpoint WAL & Take Online Non-blocking Backup
    const rawDb = new Database(dbPath, { timeout: 10000 });
    try {
      try {
        rawDb.pragma("wal_checkpoint(TRUNCATE)");
      } catch (e) {
        console.warn("[WAL Checkpoint Warning]:", e);
      }
      await rawDb.backup(backupDbPath);
    } finally {
      rawDb.close();
    }

    const stat = fs.statSync(backupDbPath);

    // Save as latest.db
    try {
      fs.copyFileSync(backupDbPath, latestDbPath);
    } catch {}

    // 2. GZIP compression
    const compressedPath = path.join(backupDir, `${baseName}.db.gz`);
    const gzipStream = zlib.createGzip({ level: 9 });
    const inStream = fs.createReadStream(backupDbPath);
    const outStream = fs.createWriteStream(compressedPath);

    await new Promise<void>((resolve, reject) => {
      inStream.pipe(gzipStream).pipe(outStream);
      outStream.on("finish", resolve);
      outStream.on("error", reject);
    });

    const compressedStat = fs.statSync(compressedPath);

    try {
      fs.copyFileSync(compressedPath, path.join(backupDir, "latest.db.gz"));
    } catch {}

    // 3. Optional Git / GitHub sync
    let gitPushed = false;
    if (options?.pushToGit || process.env.BACKUP_AUTO_PUSH === "true") {
      try {
        execSync(`git add backups/`, { stdio: "pipe" });
        const commitMsg = `chore(backup): database snapshot ${dateStr} ${timeStr.replace(/-/g, ":")}`;
        try {
          execSync(`git commit -m "${commitMsg}"`, { stdio: "pipe" });
        } catch {
          // Nothing new to commit
        }

        const remotes = execSync("git remote", { encoding: "utf-8" }).trim();
        if (remotes.length > 0) {
          const currentBranch =
            execSync("git rev-parse --abbrev-ref HEAD", {
              encoding: "utf-8",
            }).trim() || "master";
          execSync(`git push origin ${currentBranch}`, { stdio: "pipe" });
          gitPushed = true;
        }
      } catch (gitErr: any) {
        console.warn("[Git Backup Sync Warning]:", gitErr?.message || gitErr);
      }
    }

    return {
      success: true,
      message: `Snapshot created successfully (${(stat.size / 1024).toFixed(1)} KB, compressed to ${(compressedStat.size / 1024).toFixed(1)} KB)${gitPushed ? " & pushed to GitHub" : ""}.`,
      timestamp: now.toISOString(),
      backupFileName: `${baseName}.db`,
      backupFilePath: backupDbPath,
      compressedPath,
      fileSizeBytes: stat.size,
      compressedSizeBytes: compressedStat.size,
      gitPushed,
    };
  } catch (error: any) {
    console.error("[Database Snapshot Error]:", error);
    return {
      success: false,
      message: error?.message || "Failed to create database snapshot.",
      timestamp: new Date().toISOString(),
    };
  }
}
