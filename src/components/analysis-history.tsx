import Link from "next/link";
import { scoreBand } from "@/lib/constants";
import { sparklinePath, sparklineScale, type AnalysisHistory } from "@/lib/analysis-history";
import { EmptyState, PanelBody } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

const WIDTH = 240;
const HEIGHT = 44;

/**
 * Analyse-Verlauf eines Leads: Score über die Zeit, Veränderung seit dem
 * letzten Lauf und welche Findings dazwischen behoben oder neu entstanden sind.
 */
export function AnalysisHistoryPanel({
  history,
  leadId,
}: {
  history: AnalysisHistory;
  leadId: string;
}) {
  if (history.points.length === 0) {
    return (
      <EmptyState
        compact
        title="Noch kein Verlauf"
        description={
          history.failedCount > 0
            ? "Bisher gibt es nur fehlgeschlagene Analysen für diesen Lead."
            : "Sobald zwei Analysen vorliegen, erscheint hier die Entwicklung."
        }
      />
    );
  }

  const letzter = history.points[history.points.length - 1]!;
  const path = sparklinePath(history.points, WIDTH, HEIGHT);
  const band = scoreBand(letzter.score);

  return (
    <PanelBody className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold leading-none tabnum text-slate-900">
              {letzter.score}
            </span>
            <span className="text-[11px] text-slate-500">von 100</span>
            {letzter.delta !== null && letzter.delta !== 0 ? (
              <span
                className={cn(
                  "ml-1 rounded px-1 py-px text-[11px] font-medium tabnum",
                  // Ein sinkender Wert bedeutet: technisch besser geworden.
                  letzter.delta < 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700",
                )}
                title="Veränderung gegenüber der vorherigen Analyse"
              >
                {letzter.delta > 0 ? "+" : ""}
                {letzter.delta}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {band?.label} · {history.points.length}{" "}
            {history.points.length === 1 ? "Analyse" : "Analysen"}
            {history.failedCount > 0 ? ` · ${history.failedCount} fehlgeschlagen` : ""}
          </p>
        </div>

        {path ? (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-11 w-full max-w-[240px] shrink-0"
            role="img"
            aria-label={`Verlauf des Analysepotenzials: ${history.points.map((p) => p.score).join(", ")}`}
          >
            <path d={path} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" />
            {history.points.map((point, index) => {
              const scale = sparklineScale(history.points, WIDTH, HEIGHT);
              const letzter = index === history.points.length - 1;
              return (
                <circle
                  key={point.analysisId}
                  cx={scale.x(index)}
                  cy={scale.y(point.score)}
                  r={letzter ? 3 : 2}
                  fill={letzter ? "#0f172a" : "#cbd5e1"}
                />
              );
            })}
          </svg>
        ) : null}
      </div>

      {history.changes.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400">
            Veränderung seit der vorherigen Analyse
          </p>
          <ul className="flex flex-wrap gap-1">
            {history.changes.slice(0, 8).map((change) => (
              <li
                key={`${change.kind}-${change.id}`}
                className={cn(
                  "rounded px-1.5 py-px text-[11px]",
                  change.kind === "BEHOBEN"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800",
                )}
              >
                {change.kind === "BEHOBEN" ? "behoben: " : "neu: "}
                {change.title}
                <span className="ml-1 opacity-60">
                  {change.kind === "BEHOBEN" ? "−" : "+"}
                  {change.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : history.previous ? (
        <p className="text-[12px] text-slate-500">
          Gegenüber der vorherigen Analyse hat sich an den bewerteten Punkten nichts geändert.
        </p>
      ) : null}

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400">
          Läufe
        </p>
        <ul className="divide-y divide-[var(--kr-line)] text-[12.5px]">
          {[...history.points].reverse().slice(0, 6).map((point) => (
            <li key={point.analysisId} className="flex items-center justify-between gap-3 py-1">
              <Link
                href={`/analysen/${point.analysisId}`}
                className="truncate text-slate-600 hover:text-blue-700 hover:underline"
              >
                {formatDateTime(point.at)}
              </Link>
              <span className="flex items-center gap-2 tabnum">
                <span className="font-medium text-slate-900">{point.score}</span>
                {point.delta !== null && point.delta !== 0 ? (
                  <span className={point.delta < 0 ? "text-emerald-700" : "text-rose-700"}>
                    {point.delta > 0 ? "+" : ""}
                    {point.delta}
                  </span>
                ) : (
                  <span className="text-slate-300">–</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/analysen?lead=${leadId}`}
        className="inline-block text-[11.5px] text-slate-500 hover:text-slate-900 hover:underline"
      >
        Alle Analysen dieses Leads
      </Link>
    </PanelBody>
  );
}
