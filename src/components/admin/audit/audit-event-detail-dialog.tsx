"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EnrichedAuditLog } from "@/actions/admin/audit.action";
import { AuditStatus } from "@/generated/prisma/enums";
import { formatBSTDate } from "@/lib/date";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  User,
  Calendar,
  Globe,
  Monitor,
  FileCode,
  Tag,
  Clock,
  Phone,
  Building2,
} from "lucide-react";

interface AuditEventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: EnrichedAuditLog | null;
}

export function AuditEventDetailDialog({
  open,
  onOpenChange,
  log,
}: AuditEventDetailDialogProps) {
  const [copiedId, setCopiedId] = React.useState(false);
  const [copiedJson, setCopiedJson] = React.useState(false);

  if (!log) return null;

  const isSuccess = log.status === AuditStatus.SUCCESS;

  const handleCopyId = () => {
    navigator.clipboard.writeText(log.id).then(() => {
      setCopiedId(true);
      toast.success("Audit Log ID copied");
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(
      log.parsedDetails || log.details || {},
      null,
      2,
    );
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopiedJson(true);
      toast.success("Event details copied as JSON");
      setTimeout(() => setCopiedJson(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[min(90vh,760px)] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        {/* Header Banner */}
        <div className="shrink-0 bg-muted/40 p-5 pb-4 border-b border-border/60">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`size-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    isSuccess
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  }`}
                >
                  {isSuccess ? (
                    <ShieldCheck className="size-5" />
                  ) : (
                    <ShieldAlert className="size-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-bold text-foreground">
                      {log.action.replace(/_/g, " ")}
                    </DialogTitle>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isSuccess
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Immutable security log record &bull; ID:{" "}
                    <span className="font-mono">{log.id}</span>
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyId}
                className="rounded-xl text-xs h-8 px-2.5 gap-1.5 shrink-0 border-border/80 hover:bg-muted cursor-pointer"
              >
                {copiedId ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{copiedId ? "Copied" : "Copy ID"}</span>
              </Button>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {/* Actor & Attribution Card */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-primary" />
              Actor Attribution &amp; Station Desk
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10.5px] text-muted-foreground">
                  Acting Performer:
                </span>
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                    {log.performerName
                      ? log.performerName.slice(0, 2).toUpperCase()
                      : "SYS"}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {log.performerName || "System / Root Administrator"}
                    </p>
                    {log.performerPhone && (
                      <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                        <Phone className="size-2.5" />
                        {log.performerPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10.5px] text-muted-foreground">
                  Department Station / Desk:
                </span>
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
                    <Building2 className="size-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {log.userRole || "System Root"}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {log.userId || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamp & Target Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
              <span className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground" />
                Event Timestamp (BST):
              </span>
              <p className="font-bold text-foreground font-mono">
                {formatBSTDate(log.createdAt)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                UTC: {new Date(log.createdAt).toISOString()}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-1">
              <span className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                <Tag className="size-3 text-muted-foreground" />
                Target Entity:
              </span>
              <p className="font-bold text-foreground">
                {log.entity || "System Core"}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate">
                Entity ID: {log.entityId || "N/A"}
              </p>
            </div>
          </div>

          {/* Network & Security Footprint */}
          <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-3.5 text-blue-500" />
              Network &amp; Client Footprint
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                <span className="text-[10px] text-muted-foreground">
                  IP Address:
                </span>
                <p className="font-mono font-semibold text-foreground truncate">
                  {log.ipAddress || "127.0.0.1"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/40 border border-border/60 sm:col-span-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Monitor className="size-2.5" />
                  User Agent / Environment:
                </span>
                <p
                  className="font-mono text-[10.5px] text-foreground truncate"
                  title={log.userAgent || "Unknown"}
                >
                  {log.userAgent || "System Client"}
                </p>
              </div>
            </div>
          </div>

          {/* Event Payload Details (Syntax-Highlighted JSON) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileCode className="size-3.5 text-amber-500" />
                Event Payload &amp; Structured Details
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyJson}
                className="h-7 text-[10.5px] font-semibold text-primary gap-1 px-2 hover:bg-primary/10 cursor-pointer"
              >
                {copiedJson ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{copiedJson ? "Copied JSON" : "Copy Payload"}</span>
              </Button>
            </div>

            <pre className="p-3.5 rounded-xl bg-muted/70 border border-border/80 font-mono text-[11px] overflow-x-auto text-foreground max-h-48 leading-relaxed">
              {JSON.stringify(log.parsedDetails || log.details || {}, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-semibold h-9 px-4 border-border/80 hover:bg-muted cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
