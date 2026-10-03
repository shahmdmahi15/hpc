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
  let initialQueue: any[] = [];
  let initialDate = new Date().toISOString().split("T")[0];
  let currentUser: { role: any } | null = null;

  try {
    const [initialDataResult, sessionDataResult] = await Promise.allSettled([
      getLiveQueueAction(),
      getCurrentSession(),
    ]);

    if (
      initialDataResult.status === "fulfilled" &&
      initialDataResult.value?.success &&
      Array.isArray(initialDataResult.value.queue)
    ) {
      initialQueue = initialDataResult.value.queue;
      if (initialDataResult.value.date) {
        initialDate = initialDataResult.value.date;
      }
    }

    if (
      sessionDataResult.status === "fulfilled" &&
      sessionDataResult.value?.user?.role
    ) {
      currentUser = { role: sessionDataResult.value.user.role };
    }
  } catch (error) {
    console.error("[HomePage load error fallback]:", error);
  }

  return (
    <WaitingRoomLiveQueueView
      initialQueue={initialQueue}
      initialDate={initialDate}
      currentUser={currentUser}
    />
  );
}
