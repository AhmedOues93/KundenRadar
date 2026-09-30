import type { Metadata } from "next";
import { requireSessionContext } from "@/lib/auth";
import { LeadForm } from "@/components/lead-form";
import { Card, CardBody, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Lead hinzufügen" };
export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  await requireSessionContext();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Lead hinzufügen"
        description="Nur der Firmenname ist verpflichtend. Die Website kann anschliessend analysiert werden."
      />
      <Card>
        <CardBody>
          <LeadForm />
        </CardBody>
      </Card>
    </div>
  );
}
