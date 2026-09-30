import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { StandaloneAnalysisForm } from "@/components/lead-actions";
import { Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Website analysieren" };
export const dynamic = "force-dynamic";

export default async function NewAnalysisPage() {
  await requireSessionContext();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Website analysieren"
        description="Prüft eine öffentlich erreichbare Website auf technische Grundlagen."
      />
      <Card>
        <CardBody>
          <StandaloneAnalysisForm />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Was geprüft wird</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Erreichbarkeit, HTTPS, Weiterleitungen und Antwortzeit</li>
            <li>Seitentitel, Meta-Description, H1, Canonical und Sprachangabe</li>
            <li>Viewport-Meta-Tag für mobile Darstellung</li>
            <li>robots.txt, sitemap.xml, Open-Graph-Daten, strukturierte Daten</li>
            <li>Interne und externe Links sowie eine Stichprobe auf Erreichbarkeit</li>
            <li>Bilder ohne Alternativtext und auffällig grosse Bilddateien</li>
            <li>Hinweise auf eingesetztes CMS und auf eine Webagentur</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Es wird nicht die gesamte Domain durchsucht. Die Analyse arbeitet mit festen Zeit- und
            Mengenbegrenzungen und lehnt Adressen in privaten oder internen Netzen ab.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
