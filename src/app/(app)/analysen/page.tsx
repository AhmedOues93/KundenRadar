import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import { loadAnalyses } from "@/lib/queries";
import { AnalysisStatusBadge, ScoreBadge } from "@/components/badges";
import {
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { displayUrl, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Analysen" };
export const dynamic = "force-dynamic";

export default async function AnalysesPage() {
  const session = await requireSessionContext();
  const analyses = await loadAnalyses(session.organizationId, { limit: 100 });

  return (
    <>
      <PageHeader
        title="Analysen"
        description="Alle durchgeführten Website-Analysen dieser Organisation."
        actions={
          <LinkButton href="/analysen/neu" variant="primary">
            Website analysieren
          </LinkButton>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {analyses.length} {analyses.length === 1 ? "Analyse" : "Analysen"}
          </CardTitle>
        </CardHeader>

        {analyses.length === 0 ? (
          <EmptyState
            title="Noch keine Analysen"
            description="Analysiere eine Website, um technische Findings und ein Analysepotenzial zu erhalten."
            action={<LinkButton href="/analysen/neu">Website analysieren</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {analyses.map((analysis) => (
              <li key={analysis.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/analysen/${analysis.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {analysis.domain ?? displayUrl(analysis.requested_url, 40)}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2">
                    <AnalysisStatusBadge status={analysis.status} />
                    {analysis.status === "SUCCESS" ? (
                      <ScoreBadge score={analysis.score} />
                    ) : null}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDateTime(analysis.created_at)}
                  {analysis.http_status ? ` · HTTP ${analysis.http_status}` : ""}
                  {analysis.response_time_ms ? ` · ${analysis.response_time_ms} ms` : ""}
                </p>
                {analysis.error_message ? (
                  <p className="mt-1 text-sm text-rose-700">{analysis.error_message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
