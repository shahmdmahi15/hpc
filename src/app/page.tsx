import { getLiveQueueAction } from "@/actions/receptionist/appointment.action";
import { getCurrentSession } from "@/lib/auth";
import { WaitingRoomLiveQueueView } from "@/components/queue/waiting-room-live-queue-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waiting Hall Live Queue | Health And Pain Care Center",
  description:
    "Real-time checked-in patient queue board with arrival punctuality indicators.",
};

export default async function HomePage() {
  const [initialData, sessionData] = await Promise.all([
    getLiveQueueAction(),
    getCurrentSession(),
  ]);

  const currentUser = sessionData ? { role: sessionData.user.role } : null;

  return (
    <WaitingRoomLiveQueueView
      initialQueue={initialData.queue}
      initialDate={initialData.date}
      currentUser={currentUser}
    />
  );
}
