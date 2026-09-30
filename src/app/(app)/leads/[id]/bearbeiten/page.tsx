import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSessionContext } from "@/lib/auth";
import { loadLead } from "@/lib/queries";
import { LeadForm } from "@/components/lead-form";
import { Card, CardBody, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Lead bearbeiten" };
export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSessionContext();
  const { id } = await params;
  const lead = await loadLead(session.organizationId, id);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Lead bearbeiten" description={lead.company_name} />
      <Card>
        <CardBody>
          <LeadForm lead={lead} />
        </CardBody>
      </Card>
    </div>
  );
}
