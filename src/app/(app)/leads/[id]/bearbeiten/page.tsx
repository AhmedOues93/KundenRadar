import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSessionContext } from "@/lib/auth";
import { loadLead } from "@/lib/queries";
import { LeadForm } from "@/components/lead-form";
import { LinkButton, PageHeader, Panel, PanelBody } from "@/components/ui";

export const metadata: Metadata = { title: "Lead bearbeiten" };
export const dynamic = "force-dynamic";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionContext();
  const { id } = await params;
  const lead = await loadLead(session.organizationId, id);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Lead bearbeiten"
        meta={lead.company_name}
        actions={<LinkButton href={`/leads/${lead.id}`} variant="ghost">Zurück</LinkButton>}
      />
      <Panel>
        <PanelBody>
          <LeadForm lead={lead} />
        </PanelBody>
      </Panel>
    </div>
  );
}
