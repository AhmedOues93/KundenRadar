import type { Metadata } from "next";
import Link from "next/link";
import { requireSessionContext } from "@/lib/auth";
import { loadAnalyses, loadLead } from "@/lib/queries";
import { AnalysisStatusBadge, ScoreCell } from "@/components/badges";
import {
  Blank,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  Table,
  TableWrap,
  Td,
  Th,
  Thead,
  Toolbar,
  Tr,
  buttonClasses,
} from "@/components/ui";
import { displayUrl, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Analysen" };
export const dynamic = "force-dynamic";

export default async function AnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; status?: string }>;
}) {
  const session = await requireSessionContext();
  const params = await searchParams;

  const [analyses, lead] = await Promise.all([
    loadAnalyses(session.organizationId, { leadId: params.lead, limit: 200 }),
    params.lead ? loadLead(session.organizationId, params.lead) : Promise.resolve(null),
  ]);

  const gefiltert =
    params.status === "FAILED"
      ? analyses.filter((analysis) => analysis.status !== "SUCCESS")
      : analyses;

  const fehler = analyses.filter((analysis) => analysis.status !== "SUCCESS").length;

  return (
    <>
      <PageHeader
        title="Analysen"
        meta={`${gefiltert.length} ${gefiltert.length === 1 ? "Lauf" : "Läufe"}${fehler > 0 ? ` · ${fehler} ohne Ergebnis` : ""}`}
        description={lead ? `Gefiltert auf ${lead.company_name}.` : undefined}
        actions={
          <LinkButton href="/analysen/neu" variant="primary">
            Website prüfen
          </LinkButton>
        }
      />

      <Panel>
        <Toolbar>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/analysen"
              className={buttonClasses(!params.status && !params.lead ? "primary" : "secondary", "sm")}
            >
              Alle
            </Link>
            <Link
              href="/analysen?status=FAILED"
              className={buttonClasses(params.status === "FAILED" ? "primary" : "secondary", "sm")}
            >
              Ohne Ergebnis
            </Link>
            {lead ? (
              <Link href={`/leads/${lead.id}`} className={buttonClasses("ghost", "sm")}>
                Zum Lead: {lead.company_name}
              </Link>
            ) : null}
          </div>
        </Toolbar>

        {gefiltert.length === 0 ? (
          <EmptyState
            title="Keine Analysen"
            description="Analysiere eine Website, um technische Findings und ein Analysepotenzial zu erhalten."
            action={<LinkButton href="/analysen/neu">Website prüfen</LinkButton>}
          />
        ) : (
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Domain</Th>
                  <Th align="right">Potenzial</Th>
                  <Th>Status</Th>
                  <Th align="right" className="hidden sm:table-cell">
                    HTTP
                  </Th>
                  <Th align="right" className="hidden md:table-cell">
                    Antwortzeit
                  </Th>
                  <Th className="hidden lg:table-cell">Hinweis</Th>
                  <Th align="right">Zeitpunkt</Th>
                </tr>
              </Thead>
              <tbody>
                {gefiltert.map((analysis) => (
                  <Tr key={analysis.id}>
                    <Td className="max-w-[20rem]">
                      <Link
                        href={`/analysen/${analysis.id}`}
                        className="block truncate font-medium text-slate-900 hover:text-blue-700 hover:underline"
                      >
                        {analysis.domain ?? displayUrl(analysis.requested_url, 40)}
                      </Link>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {analysis.status === "SUCCESS" ? (
                        <ScoreCell score={analysis.score} />
                      ) : (
                        <Blank />
                      )}
                    </Td>
                    <Td>
                      <AnalysisStatusBadge status={analysis.status} />
                    </Td>
                    <Td align="right" className="hidden text-slate-600 sm:table-cell">
                      {analysis.http_status ?? <Blank />}
                    </Td>
                    <Td align="right" className="hidden text-slate-600 md:table-cell">
                      {analysis.response_time_ms ? `${analysis.response_time_ms} ms` : <Blank />}
                    </Td>
                    <Td className="hidden max-w-[24rem] lg:table-cell">
                      {analysis.error_message ? (
                        <span className="block truncate text-[12px] text-rose-700">
                          {analysis.error_message}
                        </span>
                      ) : analysis.agency_hint?.found ? (
                        <span className="block truncate text-[12px] text-violet-700">
                          Agenturhinweis
                          {analysis.agency_hint.agencyName
                            ? `: ${analysis.agency_hint.agencyName}`
                            : ""}
                        </span>
                      ) : (
                        <Blank />
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-slate-500">
                      {formatDateTime(analysis.created_at)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
