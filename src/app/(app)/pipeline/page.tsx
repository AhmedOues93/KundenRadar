import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import { loadLeads } from "@/lib/queries";
import { PIPELINE_STATUSES } from "@/lib/constants";
import { PipelineBoard } from "@/components/pipeline-board";
import { EmptyState, LinkButton, PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const session = await requireSessionContext();
  const allLeads = await loadLeads(session.organizationId, { status: "ACTIVE", sort: "score" });

  const pipelineStatuses = new Set(PIPELINE_STATUSES);
  const leads = allLeads.filter((lead) => pipelineStatuses.has(lead.status));
  const ausserhalb = allLeads.length - leads.length;

  return (
    <>
      <PageHeader
        title="Pipeline"
        meta={`${leads.length} aktive Leads`}
        actions={
          <>
            <LinkButton href="/qualifizierung">Qualifizierung</LinkButton>
            <LinkButton href="/leads/neu" variant="primary">
              Lead hinzufügen
            </LinkButton>
          </>
        }
      />

      {allLeads.length === 0 ? (
        <Panel>
          <EmptyState
            title="Noch keine Leads in der Pipeline"
            description="Erfasse einen Lead oder starte eine Lead-Suche."
            action={<LinkButton href="/leads/discover">Lead-Suche starten</LinkButton>}
          />
        </Panel>
      ) : (
        <>
          <PipelineBoard leads={leads} />
          {ausserhalb > 0 ? (
            <p className="mt-1.5 text-[11px] text-slate-500">
              {ausserhalb}{" "}
              {ausserhalb === 1 ? "weiterer Lead liegt" : "weitere Leads liegen"} ausserhalb der
              Pipeline (z. B. verloren).{" "}
              <Link href="/leads?status=ALL" className="underline hover:text-slate-900">
                In der Lead-Liste ansehen
              </Link>
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
