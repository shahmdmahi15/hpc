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
  Users,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doctor Panel | Health And Pain Care Center",
  description: "Clinical pain management and doctor workspace",
};

export default async function DoctorDashboardPage() {
  const session = await requireAuth([Role.DOCTOR]);

  const mockCases = [
    {
      id: "P-1042",
      name: "Eleanor Vance",
      condition: "Chronic Lumbar Radiculopathy",
      painScore: 7,
      status: "Under Therapy",
      time: "09:30 AM",
    },
    {
      id: "P-1043",
      name: "David Kim",
      condition: "Cervical Spondylosis",
      painScore: 4,
      status: "Follow-up",
      time: "10:45 AM",
    },
    {
      id: "P-1044",
      name: "Maria Garcia",
      condition: "Post-Surgical Neuropathy",
      painScore: 8,
      status: "Urgent Review",
      time: "11:30 AM",
    },
    {
      id: "P-1045",
      name: "Robert Taylor",
      condition: "Myofascial Pain Syndrome",
      painScore: 3,
      status: "Completed",
      time: "02:15 PM",
    },
  ];

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Doctor &amp; Clinical Workspace"
      badgeText="Pain Care Department"
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Today&apos;s Patients
            </span>
            <Users className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold mt-2">12</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            4 morning &bull; 8 afternoon
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Active Pain Plans
            </span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2">28</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Ongoing physiotherapy &amp; blocks
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              High Pain Flags
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-2">3</p>
          <span className="text-[11px] text-amber-500 font-medium mt-1">
            VAS Score &ge; 7/10
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Avg. Improvement
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2">64%</p>
          <span className="text-[11px] text-emerald-500 font-medium mt-1">
            Post-therapy relief
          </span>
        </Card>
      </div>

      {/* Patient Case Queue */}
      <Card className="shadow-md border-border bg-card/90">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">
              Today&apos;s Pain Management Schedule
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Scheduled clinical examinations and interventional pain therapy
              consultations
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 font-semibold">Time</th>
                  <th className="pb-3 font-semibold">Patient ID &amp; Name</th>
                  <th className="pb-3 font-semibold">Diagnosis / Condition</th>
                  <th className="pb-3 font-semibold">Pain Score (VAS)</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mockCases.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.time}
                    </td>
                    <td className="py-3">
                      <span className="font-semibold text-foreground">
                        {c.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground font-mono">
                        {c.id}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {c.condition}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          c.painScore >= 7
                            ? "bg-red-500/10 text-red-500 border border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        }`}
                      >
                        {c.painScore} / 10
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-muted">
                        {c.status}
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
