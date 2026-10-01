import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { StandaloneAnalysisForm } from "@/components/lead-actions";
import { LinkButton, PageHeader, Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Website prüfen" };
export const dynamic = "force-dynamic";

export default async function NewAnalysisPage() {
  await requireSessionContext();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Website prüfen"
        description="Einzelprüfung ohne Lead-Bezug – für eine schnelle erste Einschätzung."
        actions={<LinkButton href="/analysen" variant="ghost">Zurück</LinkButton>}
      />

      <Panel>
        <PanelBody>
          <StandaloneAnalysisForm />
        </PanelBody>
      </Panel>

      <Panel className="mt-3">
        <PanelHeader>
          <PanelTitle>Was geprüft wird</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <ul className="grid gap-x-6 gap-y-0.5 text-[12.5px] text-slate-600 sm:grid-cols-2">
            <li>Erreichbarkeit, HTTPS, Weiterleitungen, Antwortzeit</li>
            <li>Titel, Meta-Description, H1, Canonical, Sprache</li>
            <li>Viewport-Meta-Tag für mobile Darstellung</li>
            <li>robots.txt, sitemap.xml, Open Graph, strukturierte Daten</li>
            <li>Interne/externe Links und Stichprobe auf Erreichbarkeit</li>
            <li>Bilder ohne Alt-Text und auffällig grosse Bilddateien</li>
            <li>Hinweise auf CMS und auf eine Webagentur</li>
            <li>Impressum wird geprüft, wenn die Startseite nichts zeigt</li>
          </ul>
        </PanelBody>
      </Panel>
    </div>
  );
}
