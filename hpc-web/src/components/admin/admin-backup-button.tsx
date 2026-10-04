"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Database, GitBranch, Loader2, CheckCircle2 } from "lucide-react";
import { triggerDatabaseSnapshotAction } from "@/actions/admin/backup.action";
import { toast } from "sonner";

export function AdminBackupButton() {
  const [isBackingUp, setIsBackingUp] = React.useState(false);

  const handleBackup = async (pushToGit: boolean) => {
    setIsBackingUp(true);
    try {
      toast.info("Generating consistent offline SQLite snapshot...");
      const res = await triggerDatabaseSnapshotAction(pushToGit);
      if (res.success) {
        toast.success(res.message, {
          description: `Saved to backups/${res.backupFileName}${res.gitPushed ? " and pushed to GitHub repository!" : ""}`,
        });
      } else {
        toast.error(res.message || "Failed to create snapshot.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred during backup.");
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isBackingUp}
      onClick={() => handleBackup(true)}
      className="h-8.5 text-xs font-semibold gap-1.5 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 shadow-xs cursor-pointer"
      title="Create offline database snapshot and sync to GitHub repository"
    >
      {isBackingUp ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <GitBranch className="size-3.5 text-purple-600 dark:text-purple-400" />
      )}
      <span>Sync Snapshot to GitHub</span>
    </Button>
  );
}
