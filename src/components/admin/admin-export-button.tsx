"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download } from "lucide-react";
import { AdminExportDialog } from "@/components/admin/admin-export-dialog";

export function AdminExportButton() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 font-bold border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer shadow-xs rounded-xl text-xs py-2 px-3.5"
      >
        <FileSpreadsheet className="size-3.5 text-emerald-600" />
        <span>Export CSV Reports</span>
        <Download className="size-3 text-emerald-600 ml-0.5" />
      </Button>

      <AdminExportDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
