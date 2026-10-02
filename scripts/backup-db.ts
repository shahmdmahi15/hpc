import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface BackupSummary {
  timestamp: string;
  sourceDbPath: string;
  backupDbPath: string;
  compressedPath?: string;
  fileSizeBytes: number;
  compressedSizeBytes?: number;
  gitPushed: boolean;
  copiedToDestinations: string[];
}

/**
 * Resolves the primary SQLite database file path.
 */
function getDbFilePath(): string {
  const connStr = process.env.DATABASE_URL || "file:./hpc.db";
  const rawPath = connStr.replace(/^file:/, "");
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

/**
 * Formats bytes into human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Prunes older database backups keeping only the latest N files.
 */
function pruneOldBackups(backupDir: string, keepCount: number = 30) {
  try {
    const files = fs.readdirSync(backupDir);
    const dbBackups = files
      .filter((f) => f.startsWith("hpc-backup-") && (f.endsWith(".db") || f.endsWith(".db.gz")))
      .map((f) => ({
        name: f,
        fullPath: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (dbBackups.length > keepCount * 2) {
      const toDelete = dbBackups.slice(keepCount * 2);
      for (const item of toDelete) {
        fs.unlinkSync(item.fullPath);
        console.log(`[Backup Prune] Removed older snapshot: ${item.name}`);
      }
    }
  } catch (err) {
    console.warn("[Backup Prune Warning]:", err);
  }
}

/**
 * Main database snapshot & sync runner.
 */
export async function runDatabaseBackup(options?: {
  pushToGit?: boolean;
  targetDestinations?: string[];
  keepCount?: number;
}): Promise<BackupSummary> {
  const startTime = Date.now();
  const dbPath = getDbFilePath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Primary database file not found at: ${dbPath}`);
  }

  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  const baseName = `hpc-backup-${dateStr}_${timeStr}`;
  const backupDbPath = path.join(backupDir, `${baseName}.db`);
  const latestDbPath = path.join(backupDir, "latest.db");

  console.log(`\n======================================================`);
  console.log(`   HPC CLINICAL MANAGEMENT SYSTEM - OFFLINE SNAPSHOT   `);
  console.log(`======================================================`);
  console.log(`[Source Database]: ${dbPath}`);
  console.log(`[Destination]:     ${backupDbPath}`);

  // 1. Checkpoint WAL and take consistent online backup
  console.log(`\nStep 1: Checkpointing SQLite Write-Ahead Log (WAL)...`);
  const rawDb = new Database(dbPath, { timeout: 10000 });
  try {
    try {
      rawDb.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      console.warn("  WAL checkpoint warning (continuing with live backup):", e);
    }

    console.log(`Step 2: Executing non-blocking SQLite Online Backup...`);
    await rawDb.backup(backupDbPath);
  } finally {
    rawDb.close();
  }

  const stat = fs.statSync(backupDbPath);
  console.log(`✓ Snapshot saved successfully: ${formatBytes(stat.size)}`);

  // Update latest.db for immediate local restore point
  try {
    fs.copyFileSync(backupDbPath, latestDbPath);
  } catch {}

  // 2. Gzip compression (reduces size for Git / NAS / cloud transfer)
  console.log(`\nStep 3: Compressing snapshot with GZIP...`);
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
  const compressionRatio = ((1 - compressedStat.size / stat.size) * 100).toFixed(1);
  console.log(`✓ Compressed archive created: ${formatBytes(compressedStat.size)} (${compressionRatio}% space saved)`);

  // Also update latest.db.gz
  try {
    fs.copyFileSync(compressedPath, path.join(backupDir, "latest.db.gz"));
  } catch {}

  // 3. Multi-destination distribution (NAS / USB / Local shares)
  const copiedToDestinations: string[] = [];
  const configuredDests = [
    ...(options?.targetDestinations || []),
    process.env.BACKUP_NAS_PATH,
    process.env.BACKUP_USB_PATH,
    process.env.BACKUP_EXTRA_DIR,
  ].filter(Boolean) as string[];

  if (configuredDests.length > 0) {
    console.log(`\nStep 4: Distributing snapshot to external targets (NAS / USB)...`);
    for (const dest of configuredDests) {
      try {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const targetRaw = path.join(dest, `${baseName}.db`);
        const targetGz = path.join(dest, `${baseName}.db.gz`);
        fs.copyFileSync(backupDbPath, targetRaw);
        fs.copyFileSync(compressedPath, targetGz);
        copiedToDestinations.push(dest);
        console.log(`  ✓ Synced to: ${dest}`);
      } catch (copyErr) {
        console.warn(`  ✗ Failed to copy to ${dest}:`, copyErr);
      }
    }
  }

  // 4. Git / GitHub Repository backup integration
  let gitPushed = false;
  const shouldPushGit =
    options?.pushToGit ||
    process.env.BACKUP_AUTO_PUSH === "true" ||
    process.argv.includes("--push");

  if (shouldPushGit) {
    console.log(`\nStep 5: Synchronizing database snapshot to GitHub repository...`);
    try {
      // Stage the backups directory
      execSync(`git add backups/`, { stdio: "inherit" });

      const commitMsg = `chore(backup): database snapshot ${dateStr} ${timeStr.replace(/-/g, ":")} [size: ${formatBytes(stat.size)}]`;
      try {
        execSync(`git commit -m "${commitMsg}"`, { stdio: "inherit" });
      } catch (commitErr) {
        console.log("  No changes to commit or commit succeeded.");
      }

      // Check if remote is configured
      const remotes = execSync("git remote", { encoding: "utf-8" }).trim();
      if (remotes.length > 0) {
        console.log(`  Pushing backup commit to git remote...`);
        const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim() || "master";
        execSync(`git push origin ${currentBranch}`, { stdio: "inherit" });
        gitPushed = true;
        console.log(`  ✓ Successfully pushed database backup to GitHub remote!`);
      } else {
        console.log("  Notice: No git remote configured. Local commit created.");
      }
    } catch (gitErr: any) {
      console.warn("  ✗ Git push warning:", gitErr?.message || gitErr);
    }
  }

  // 5. Prune old snapshots
  pruneOldBackups(backupDir, options?.keepCount ?? 30);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`✓ Backup complete in ${durationSec}s!`);
  console.log(`  Raw snapshot:        ${backupDbPath} (${formatBytes(stat.size)})`);
  console.log(`  Compressed archive:  ${compressedPath} (${formatBytes(compressedStat.size)})`);
  console.log(`  GitHub synced:       ${gitPushed ? "YES" : "Local only (run with --push to sync)"}`);
  console.log(`======================================================\n`);

  return {
    timestamp: now.toISOString(),
    sourceDbPath: dbPath,
    backupDbPath,
    compressedPath,
    fileSizeBytes: stat.size,
    compressedSizeBytes: compressedStat.size,
    gitPushed,
    copiedToDestinations,
  };
}

// Run CLI if invoked directly
if (require.main === module || process.argv[1]?.endsWith("backup-db.ts")) {
  runDatabaseBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[FATAL BACKUP ERROR]:", err);
      process.exit(1);
    });
}
