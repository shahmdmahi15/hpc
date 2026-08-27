import { getKioskWaitingRoomData } from "@/actions/kiosk";
import { WaitingRoomDisplay } from "@/components/kiosk/waiting-room-display";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Waiting Room Kiosk | Health And Pain Care Center",
  description:
    "Real-time patient queue, live token announcements, and waiting room scheduling display",
};

export default async function HomePage() {
  const initialData = await getKioskWaitingRoomData();

  return <WaitingRoomDisplay initialData={initialData} />;
}
