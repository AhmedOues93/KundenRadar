import {
  FINDING_GROUP_LABELS,
  FINDING_GROUP_ORDER,
  FINDING_SEVERITY_LABELS,
  FINDING_SEVERITY_TONE,
  scoreBand,
} from "@/lib/constants";
import type { Finding, FindingGroup } from "@/lib/types";
import { Badge, Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER = { PROBLEM: 0, HINWEIS: 1, INFO: 2, OK: 3 } as const;

/**
 * Herleitung des Scores: Gesamtwert und jede Position, die dazu beiträgt.
 * Bewusst als Aufstellung – der Wert muss nachrechenbar sein.
 */
export function ScoreSummary({ score, findings }: { score: number | null; findings: Finding[] }) {
  const band = scoreBand(score);
  const scoring = findings.filter((finding) => finding.points > 0);
  const summe = scoring.reduce((total, finding) => total + finding.points, 0);
  const gedeckelt = summe > 100;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Analysepotenzial</PanelTitle>
        {band ? <Badge tone={band.tone}>{band.label}</Badge> : null}
      </PanelHeader>
      <PanelBody>
        <p className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-semibold leading-none tabnum text-slate-900">
            {score ?? "–"}
          </span>
          <span className="text-[11px] text-slate-500">von 100</span>
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
          Beschreibt, wie interessant diese Website für eine manuelle Akquise-Prüfung erscheint –
          keine Aussage darüber, ob die Firma Kunde wird.
        </p>

        {scoring.length > 0 ? (
          <table className="mt-2.5 w-full text-[12.5px]">
            <caption className="mb-1 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400">
              So entsteht der Wert
            </caption>
            <tbody>
              {scoring
                .slice()
                .sort((a, b) => b.points - a.points)
                .map((finding) => (
                  <tr key={finding.id} className="border-b border-[var(--kr-line)] last:border-b-0">
                    <td className="py-1 pr-2 text-slate-700">{finding.title}</td>
                    <td className="w-10 py-1 text-right tabnum font-medium text-slate-900">
                      +{finding.points}
                    </td>
                  </tr>
                ))}
              <tr className="border-t border-slate-300">
                <td className="pt-1 pr-2 font-semibold text-slate-700">Summe</td>
                <td className="pt-1 text-right tabnum font-semibold text-slate-900">
                  {summe}
                  {gedeckelt ? <span className="ml-1 text-[10px] font-normal text-slate-400">→ 100</span> : null}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="mt-2 text-[12.5px] text-slate-500">
            Keine punktebringenden Auffälligkeiten festgestellt.
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}

/** Findings nach Gruppen, für Vertriebsmitarbeiter aufbereitet. */
export function FindingGroups({ findings }: { findings: Finding[] }) {
  const grouped = new Map<FindingGroup, Finding[]>();
  for (const finding of findings) {
    const list = grouped.get(finding.group) ?? [];
    list.push(finding);
    grouped.set(finding.group, list);
  }

  return (
    <div className="space-y-3">
      {FINDING_GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => {
        const items = (grouped.get(group) ?? [])
          .slice()
          .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
        const probleme = items.filter((item) => item.severity === "PROBLEM").length;

        return (
          <Panel key={group}>
            <PanelHeader>
              <PanelTitle>{FINDING_GROUP_LABELS[group]}</PanelTitle>
              <span className={cn("text-[11px]", probleme > 0 ? "text-rose-700" : "text-slate-400")}>
                {probleme > 0
                  ? `${probleme} ${probleme === 1 ? "Problem" : "Probleme"}`
                  : "keine Probleme"}
              </span>
            </PanelHeader>
            <ul className="divide-y divide-[var(--kr-line)]">
              {items.map((finding) => (
                <li key={finding.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <Badge tone={FINDING_SEVERITY_TONE[finding.severity]}>
                      {FINDING_SEVERITY_LABELS[finding.severity]}
                    </Badge>
                    <p className="text-[13px] font-semibold text-slate-900">{finding.title}</p>
                    {finding.points > 0 ? (
                      <span className="tabnum text-[11px] font-medium text-slate-400">
                        +{finding.points}
                      </span>
                    ) : null}
                    {finding.detail ? (
                      <span className="ml-auto truncate font-mono text-[11px] text-slate-500">
                        {finding.detail}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-700">
                    {finding.meaning}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                    <span className="font-medium text-slate-600">Akquise-Relevanz: </span>
                    {finding.salesRelevance}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
