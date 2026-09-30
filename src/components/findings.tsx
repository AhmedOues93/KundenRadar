import {
  FINDING_GROUP_LABELS,
  FINDING_GROUP_ORDER,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_TONE,
  scoreBand,
} from "@/lib/constants";
import type { Finding, FindingGroup } from "@/lib/types";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";

/**
 * Stellt die Bewertung nachvollziehbar dar: Gesamtscore, wie er entsteht und
 * jedes Finding mit Bedeutung und Akquise-Relevanz.
 */
export function ScoreSummary({
  score,
  findings,
}: {
  score: number | null;
  findings: Finding[];
}) {
  const band = scoreBand(score);
  const scoring = findings.filter((finding) => finding.points > 0);
  const rawSum = scoring.reduce((sum, finding) => sum + finding.points, 0);
  const capped = rawSum > 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysepotenzial</CardTitle>
        {band ? <Badge tone={band.tone}>{band.label}</Badge> : null}
      </CardHeader>
      <CardBody>
        <div className="flex items-end gap-2">
          <p className="text-4xl font-semibold tabular-nums text-slate-900">{score ?? "–"}</p>
          <p className="pb-1 text-sm text-slate-500">von 100</p>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          Der Wert beschreibt, wie interessant diese Website für eine manuelle Akquise-Prüfung
          erscheint. Er ist keine Aussage darüber, ob die Firma Kunde wird.
        </p>

        {scoring.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              So entsteht der Wert
            </p>
            <ul className="mt-1.5 divide-y divide-slate-100 text-sm">
              {scoring
                .slice()
                .sort((a, b) => b.points - a.points)
                .map((finding) => (
                  <li key={finding.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="text-slate-700">{finding.title}</span>
                    <span className="shrink-0 font-medium tabular-nums text-slate-900">
                      +{finding.points}
                    </span>
                  </li>
                ))}
              <li className="flex items-baseline justify-between gap-3 py-1.5 font-semibold">
                <span className="text-slate-700">Summe</span>
                <span className="tabular-nums text-slate-900">
                  {rawSum}
                  {capped ? " → auf 100 begrenzt" : ""}
                </span>
              </li>
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Es wurden keine punktebringenden Auffälligkeiten festgestellt.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function FindingGroups({ findings }: { findings: Finding[] }) {
  const grouped = new Map<FindingGroup, Finding[]>();
  for (const finding of findings) {
    const list = grouped.get(finding.group) ?? [];
    list.push(finding);
    grouped.set(finding.group, list);
  }

  const severityOrder = { PROBLEM: 0, HINWEIS: 1, INFO: 2, OK: 3 } as const;

  return (
    <div className="space-y-4">
      {FINDING_GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => {
        const items = (grouped.get(group) ?? [])
          .slice()
          .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        const problems = items.filter((item) => item.severity === "PROBLEM").length;

        return (
          <Card key={group}>
            <CardHeader>
              <CardTitle>{FINDING_GROUP_LABELS[group]}</CardTitle>
              <span className="text-xs text-slate-500">
                {problems > 0
                  ? `${problems} ${problems === 1 ? "Problem" : "Probleme"}`
                  : "keine Probleme"}
              </span>
            </CardHeader>
            <ul className="divide-y divide-slate-100">
              {items.map((finding) => (
                <li key={finding.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={FINDING_SEVERITY_TONE[finding.severity]}>
                      {FINDING_SEVERITY_LABELS[finding.severity]}
                    </Badge>
                    <p className="text-sm font-semibold text-slate-900">{finding.title}</p>
                    {finding.points > 0 ? (
                      <span className="text-xs font-medium tabular-nums text-slate-500">
                        +{finding.points} Punkte
                      </span>
                    ) : null}
                  </div>

                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div>
                      <dt className="text-xs font-medium text-slate-400">Bedeutung</dt>
                      <dd className="text-slate-700">{finding.meaning}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-slate-400">Akquise-Relevanz</dt>
                      <dd className="text-slate-700">{finding.salesRelevance}</dd>
                    </div>
                    {finding.detail ? (
                      <div>
                        <dt className="text-xs font-medium text-slate-400">Messwert</dt>
                        <dd className="break-words font-mono text-xs text-slate-600">
                          {finding.detail}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
