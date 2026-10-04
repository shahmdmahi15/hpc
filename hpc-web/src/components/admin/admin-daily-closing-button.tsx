"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { AdminDailyClosingDialog } from "@/components/admin/admin-daily-closing-dialog";

interface AdminDailyClosingButtonProps {
  data: {
    todayAppointmentsCount: number;
    todayConsultationCount: number;
    todayTherapyCount: number;
    todayCollected: number;
    todayDue: number;
    totalLifetimeRevenue: number;
    userCount: number;
    activeSessionCount: number;
  };
}

export function AdminDailyClosingButton({ data }: AdminDailyClosingButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 font-semibold cursor-pointer border-emerald-600/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
      >
        <Calculator className="size-4 text-emerald-600" />
        <span>Daily Z-Report</span>
      </Button>

      <AdminDailyClosingDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        data={data}
      />
    </>
  );
}
