"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuditAction, AuditStatus, Role } from "@/generated/prisma/enums";
import type { AuditLogFilterParams } from "@/actions/admin/audit.action";
import {
  Search,
  RotateCcw,
  Download,
  Filter,
  FileSpreadsheet,
  FileCode,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PerformerOption {
  id: string;
  name: string;
  phone: string;
}

interface AuditFilterBarProps {
  filters: AuditLogFilterParams;
  onFilterChange: (newFilters: Partial<AuditLogFilterParams>) => void;
  onReset: () => void;
  onExport: (format: "csv" | "json") => void;
  isExporting?: boolean;
  performers: PerformerOption[];
}

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
] as const;

const AUDIT_STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: AuditStatus.SUCCESS, label: "Success Only" },
  { value: AuditStatus.FAILURE, label: "Security Failures" },
] as const;

const AUDIT_ACTION_OPTIONS = [
  { value: "ALL", label: "All Actions" },
  { value: AuditAction.LOGIN_SUCCESS, label: "Login Success" },
  { value: AuditAction.LOGIN_FAILURE, label: "Login Failure" },
  { value: AuditAction.LOGOUT, label: "Logout" },
  { value: AuditAction.ROOM_CREATE, label: "Room Created" },
  { value: AuditAction.ROOM_UPDATE, label: "Room Updated" },
  { value: AuditAction.ROOM_STATUS_CHANGE, label: "Room State Changed" },
  { value: AuditAction.ROOM_DELETE, label: "Room Deleted" },
  { value: AuditAction.PERFORMER_CREATE, label: "Staff Created" },
  { value: AuditAction.PERFORMER_DELETE, label: "Staff Removed" },
  { value: AuditAction.USER_PASSWORD_RESET, label: "Password Reset" },
  { value: AuditAction.USER_SESSIONS_REVOKED, label: "Sessions Revoked" },
  { value: AuditAction.USER_UPDATE, label: "User Update" },
] as const;

const ROLE_OPTIONS = [
  { value: "ALL", label: "All Stations" },
  { value: Role.ADMIN, label: "ADMIN" },
  { value: Role.DOCTOR, label: "DOCTOR" },
  { value: Role.RECEPTIONIST, label: "RECEPTIONIST" },
  { value: Role.HANDLER, label: "HANDLER" },
  { value: Role.CASHIER, label: "CASHIER" },
] as const;

export function AuditFilterBar({
  filters,
  onFilterChange,
  onReset,
  onExport,
  isExporting = false,
  performers,
}: AuditFilterBarProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.action) ||
    Boolean(filters.status) ||
    Boolean(filters.role) ||
    Boolean(filters.performerId) ||
    (Boolean(filters.dateRange) && filters.dateRange !== "all");

  return (
    <div className="space-y-3 p-4 rounded-2xl border border-border/80 bg-card/60 shadow-xs backdrop-blur-sm">
      {/* Top row: Search + Export + Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={filters.search || ""}
            onChange={(e) =>
              onFilterChange({ search: e.target.value, page: 1 })
            }
            placeholder="Search by performer, role, IP, details, entity ID..."
            className="pl-8 text-xs rounded-xl h-9 bg-background border-border/80"
          />
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="rounded-xl text-xs font-semibold h-8 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </Button>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isExporting}
                  className="rounded-xl text-xs font-semibold h-8 px-3 gap-1.5 border-border/80 bg-background hover:bg-muted cursor-pointer shadow-xs"
                >
                  {isExporting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  <span>Export</span>
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-xl shadow-xl border-border/80 p-1"
            >
              <DropdownMenuLabel className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Download Audit Trail
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onExport("csv")}
                className="text-xs font-semibold gap-2 rounded-lg cursor-pointer py-1.5"
              >
                <FileSpreadsheet className="size-4 text-emerald-500" />
                <span>Download as CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onExport("json")}
                className="text-xs font-semibold gap-2 rounded-lg cursor-pointer py-1.5"
              >
                <FileCode className="size-4 text-blue-500" />
                <span>Download as JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bottom row: Filter Chips & Selectors */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
        <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground mr-1">
          <Filter className="size-3" />
          <span>Filters:</span>
        </div>

        {/* Date Range Selector */}
        <Select
          items={DATE_RANGE_OPTIONS}
          value={filters.dateRange || "all"}
          onValueChange={(val) =>
            onFilterChange({
              dateRange: (val || "all") as AuditLogFilterParams["dateRange"],
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-8 rounded-xl border border-border/80 bg-background text-xs font-medium w-[125px] shadow-xs">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Selector */}
        <Select
          items={AUDIT_STATUS_OPTIONS}
          value={filters.status || "ALL"}
          onValueChange={(val) =>
            onFilterChange({
              status: val && val !== "ALL" ? (val as AuditStatus) : undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-8 rounded-xl border border-border/80 bg-background text-xs font-medium w-[130px] shadow-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {AUDIT_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Type Selector */}
        <Select
          items={AUDIT_ACTION_OPTIONS}
          value={filters.action || "ALL"}
          onValueChange={(val) =>
            onFilterChange({
              action: val && val !== "ALL" ? (val as AuditAction) : undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-8 rounded-xl border border-border/80 bg-background text-xs font-medium w-[160px] shadow-xs truncate">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {AUDIT_ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Station Role Selector */}
        <Select
          items={ROLE_OPTIONS}
          value={filters.role || "ALL"}
          onValueChange={(val) =>
            onFilterChange({
              role: val && val !== "ALL" ? (val as Role) : undefined,
              page: 1,
            })
          }
        >
          <SelectTrigger className="h-8 rounded-xl border border-border/80 bg-background text-xs font-medium w-[130px] shadow-xs">
            <SelectValue placeholder="Station" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Performer Selector */}
        {performers.length > 0 && (
          <Select
            items={[
              { value: "ALL", label: "All Performers" },
              ...performers.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.phone.slice(-4)})`,
              })),
            ]}
            value={filters.performerId || "ALL"}
            onValueChange={(val) =>
              onFilterChange({
                performerId: val && val !== "ALL" ? val : undefined,
                page: 1,
              })
            }
          >
            <SelectTrigger className="h-8 rounded-xl border border-border/80 bg-background text-xs font-medium w-[160px] shadow-xs truncate">
              <SelectValue placeholder="Performer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Performers</SelectItem>
              {performers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.phone.slice(-4)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
