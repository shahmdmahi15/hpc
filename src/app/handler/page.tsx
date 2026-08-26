import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Activity,
  Users,
  ClipboardCheck,
  Clock,
  HeartPulse,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Care Handler Panel | Health And Pain Care Center",
  description: "Rehabilitation support, triage, and physical care logistics",
};

export default async function HandlerDashboardPage() {
  const session = await requireAuth([Role.HANDLER]);

  const mockTasks = [
    {
      id: "TSK-501",
      task: "Assisted Gait Training & Lumbar Support",
      patient: "Eleanor Vance",
      room: "Rehab Studio 2",
      time: "09:30 AM",
      status: "In Progress",
    },
    {
      id: "TSK-502",
      task: "Post-Injection Cryotherapy Setup",
      patient: "Lucas Bennett",
      room: "Pain Procedure Suite 1",
      time: "10:45 AM",
      status: "Scheduled",
    },
    {
      id: "TSK-503",
      task: "TENS Electrotherapy Application",
      patient: "Maria Garcia",
      room: "Physio Bay 4",
      time: "11:30 AM",
      status: "Scheduled",
    },
    {
      id: "TSK-504",
      task: "Mobility Wheelchair Transfer",
      patient: "Robert Taylor",
      room: "Discharge Bay",
      time: "02:00 PM",
      status: "Pending",
    },
  ];

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Therapy &amp; Care Handler Hub"
      badgeText="Rehabilitation &amp; Logistics"
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Assigned Tasks
            </span>
            <ClipboardCheck className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-2">16</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Today&apos;s therapy &amp; transport
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Active Sessions
            </span>
            <Activity className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold mt-2">3</p>
          <span className="text-[11px] text-cyan-500 font-medium mt-1">
            Undergoing rehab exercises
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Assisted Patients
            </span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2">9</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Safely guided through care
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Completion Rate
            </span>
            <HeartPulse className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2">98%</p>
          <span className="text-[11px] text-emerald-500 font-medium mt-1">
            On-time care delivery
          </span>
        </Card>
      </div>

      {/* Task Schedule Table */}
      <Card className="shadow-md border-border bg-card/90">
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            Physical Therapy &amp; Care Logistics Schedule
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Assigned physical support tasks, therapy room preparations, and
            patient care handling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 font-semibold">Time</th>
                  <th className="pb-3 font-semibold">Care Task Description</th>
                  <th className="pb-3 font-semibold">Patient</th>
                  <th className="pb-3 font-semibold">Room / Location</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mockTasks.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.time}
                    </td>
                    <td className="py-3 font-semibold text-foreground">
                      {t.task}
                    </td>
                    <td className="py-3 text-muted-foreground">{t.patient}</td>
                    <td className="py-3 font-mono text-[11px] text-muted-foreground">
                      {t.room}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.status === "In Progress"
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            : t.status === "Scheduled"
                              ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                              : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
