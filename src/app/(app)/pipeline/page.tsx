import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import { loadLeads } from "@/lib/queries";
import { PIPELINE_STATUSES } from "@/lib/constants";
import { PipelineBoard } from "@/components/pipeline-board";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const session = await requireSessionContext();
  const allLeads = await loadLeads(session.organizationId, { status: "ACTIVE", sort: "score" });

  const pipelineStatuses = new Set(PIPELINE_STATUSES);
  const leads = allLeads.filter((lead) => pipelineStatuses.has(lead.status));
  const outsidePipeline = allLeads.length - leads.length;

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Akquise-Status aller aktiven Leads."
        actions={<LinkButton href="/leads/neu" variant="primary">Lead hinzufügen</LinkButton>}
      />

      {allLeads.length === 0 ? (
        <EmptyState
          title="Noch keine Leads in der Pipeline"
          description="Erfasse einen Lead, um ihn hier zu verfolgen."
          action={<LinkButton href="/leads/neu">Lead hinzufügen</LinkButton>}
        />
      ) : (
        <>
          <PipelineBoard leads={leads} />
          {outsidePipeline > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {outsidePipeline}{" "}
              {outsidePipeline === 1 ? "weiterer Lead liegt" : "weitere Leads liegen"} in einem
              Status ausserhalb der Pipeline (z. B. analysiert, verloren).{" "}
              <Link href="/leads?status=ALL" className="underline">
                In der Lead-Liste ansehen
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
