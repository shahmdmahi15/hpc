import { getKioskWaitingRoomData } from "@/actions/kiosk";
import { getCurrentSession } from "@/lib/auth";
import { WaitingRoomDisplay } from "@/components/kiosk/waiting-room-display";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Waiting Room Kiosk | Health And Pain Care Center",
  description:
    "Real-time patient queue, live token announcements, and waiting room scheduling display",
};

export default async function HomePage() {
  const [initialData, session] = await Promise.all([
    getKioskWaitingRoomData(),
    getCurrentSession(),
  ]);

  const currentUser = session?.user
    ? {
        name: session.user.name,
        role: session.user.role,
      }
    : null;

  return (
    <WaitingRoomDisplay initialData={initialData} currentUser={currentUser} />
  );
}
