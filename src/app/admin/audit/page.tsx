import { getAdminAuditPageDataAction } from "@/actions/admin/audit.action";
import { AuditLogsView } from "@/components/admin/audit/audit-logs-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Trail & Compliance Logs | HPC Admin",
  description:
    "Comprehensive security and operational audit trail with actor and desk attribution.",
};

export default async function AdminAuditPage() {
  const { initialResult, performers } = await getAdminAuditPageDataAction();
  return (
    <AuditLogsView initialResult={initialResult} performers={performers} />
  );
}
