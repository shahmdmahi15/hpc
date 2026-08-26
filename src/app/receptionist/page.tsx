import { requireAuth } from "@/lib/guard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Calendar, Users, Clock, CheckCircle2, UserPlus } from "lucide-react";
import { Role } from "@/generated/prisma/enums";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Receptionist Panel | Health And Pain Care Center",
  description: "Front desk intake, scheduling, and patient reception",
};

export default async function ReceptionistDashboardPage() {
  const session = await requireAuth([Role.RECEPTIONIST]);

  const mockIntake = [
    {
      id: "APT-301",
      patient: "Arthur Morgan",
      doctor: "Dr. Marcus Chen",
      time: "09:00 AM",
      status: "Checked In",
      type: "New Consultation",
    },
    {
      id: "APT-302",
      patient: "Samantha Bright",
      doctor: "Dr. Marcus Chen",
      time: "09:45 AM",
      status: "In Waiting Room",
      type: "Therapy Follow-up",
    },
    {
      id: "APT-303",
      patient: "Lucas Bennett",
      doctor: "Dr. Sarah Jenkins",
      time: "10:30 AM",
      status: "Confirmed",
      type: "Pain Block Procedure",
    },
    {
      id: "APT-304",
      patient: "Grace Hopper",
      doctor: "Dr. Marcus Chen",
      time: "11:15 AM",
      status: "Confirmed",
      type: "Evaluation",
    },
  ];

  return (
    <DashboardLayout
      user={session.user}
      headerTitle="Front Desk &amp; Reception"
      badgeText="Patient Intake Hub"
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Scheduled Today
            </span>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2">24</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            Appointments booked
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Waiting Room
            </span>
            <Users className="h-4 w-4 text-cyan-500" />
          </div>
          <p className="text-2xl font-bold mt-2">5</p>
          <span className="text-[11px] text-cyan-500 font-medium mt-1">
            Avg. wait time: 8 mins
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              New Patients
            </span>
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold mt-2">7</p>
          <span className="text-[11px] text-muted-foreground mt-1">
            First-time visits today
          </span>
        </Card>

        <Card className="p-4 shadow-sm border-border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Intake Completed
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2">12</p>
          <span className="text-[11px] text-emerald-500 font-medium mt-1">
            Forms &amp; vitals processed
          </span>
        </Card>
      </div>

      {/* Reception Queue Table */}
      <Card className="shadow-md border-border bg-card/90">
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            Front Desk Intake &amp; Queue Management
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Real-time patient check-ins and appointment arrivals for Health And
            Pain Care Center
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 font-semibold">Booking ID</th>
                  <th className="pb-3 font-semibold">Patient Name</th>
                  <th className="pb-3 font-semibold">Assigned Doctor</th>
                  <th className="pb-3 font-semibold">Scheduled Time</th>
                  <th className="pb-3 font-semibold">Visit Purpose</th>
                  <th className="pb-3 font-semibold">Check-In Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mockIntake.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 font-mono text-[11px] text-muted-foreground">
                      {item.id}
                    </td>
                    <td className="py-3 font-semibold text-foreground">
                      {item.patient}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {item.doctor}
                    </td>
                    <td className="py-3 font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.time}
                    </td>
                    <td className="py-3 text-muted-foreground">{item.type}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.status === "Checked In"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : item.status === "In Waiting Room"
                              ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
                              : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {item.status}
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
