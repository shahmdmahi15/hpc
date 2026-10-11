import { verifyAdminLayoutAccessAction } from "@/actions/admin/admin-auth.action";
import { getConnectedDevicesAction } from "@/actions/admin/device-fleet.action";
import { DeviceFleetView } from "@/components/admin/network/device-fleet-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Network & Fleet Management | Admin Portal | HPC",
  description:
    "Realtime surveillance, telemetry, and remote control for all clinic terminals, waiting hall TVs, doctor workstations, and tablet stations.",
};

export default async function AdminNetworkPage() {
  await verifyAdminLayoutAccessAction();
  const res = await getConnectedDevicesAction();

  return (
    <div className="w-full space-y-4">
      <DeviceFleetView
        initialDevices={res.devices || []}
        stats={res.stats || { total: 0, online: 0, offline: 0 }}
      />
    </div>
  );
}
