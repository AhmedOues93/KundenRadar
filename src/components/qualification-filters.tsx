import Link from "next/link";
import { Button, Input, Select, Toolbar, ToolbarField, buttonClasses } from "@/components/ui";
import { INTERESTING_SCORE_THRESHOLD } from "@/lib/queries";

export function QualificationFilters({
  values,
  cities,
  industries,
  exportHref,
}: {
  values: {
    score: string;
    agency: string;
    analysis: string;
    industry: string;
    city: string;
    search: string;
  };
  cities: string[];
  industries: string[];
  exportHref: string;
}) {
  const hasFilters =
    Boolean(values.search || values.industry || values.city) ||
    ![values.score, values.agency, values.analysis].every((value) => !value || value === "ANY");

  return (
    <Toolbar>
      <form
        method="get"
        action="/qualifizierung"
        className="flex flex-1 flex-wrap items-end gap-x-2 gap-y-1.5"
      >
        <ToolbarField label="Suche" className="w-full sm:w-48">
          <Input name="search" defaultValue={values.search} placeholder="Firma oder Domain" />
        </ToolbarField>

        <ToolbarField label="Potenzial" className="w-32">
          <Select name="score" defaultValue={values.score || "ANY"}>
            <option value="ANY">Alle</option>
            <option value="HIGH">ab {INTERESTING_SCORE_THRESHOLD}</option>
          </Select>
        </ToolbarField>

        <ToolbarField label="Agenturhinweis" className="w-36">
          <Select name="agency" defaultValue={values.agency || "ANY"}>
            <option value="ANY">Alle</option>
            <option value="NONE">Kein Hinweis</option>
            <option value="FOUND">Hinweis vorhanden</option>
          </Select>
        </ToolbarField>

        <ToolbarField label="Analyse" className="w-40">
          <Select name="analysis" defaultValue={values.analysis || "ANY"}>
            <option value="ANY">Alle</option>
            <option value="MISSING">Noch nicht analysiert</option>
            <option value="DONE">Erfolgreich</option>
            <option value="FAILED">Fehlgeschlagen</option>
          </Select>
        </ToolbarField>

        <ToolbarField label="Branche" className="w-36">
          <Select name="industry" defaultValue={values.industry}>
            <option value="">Alle</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <ToolbarField label="Ort" className="w-32">
          <Select name="city" defaultValue={values.city}>
            <option value="">Alle</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <Button type="submit" variant="secondary">
          Filtern
        </Button>
        {hasFilters ? (
          <Link href="/qualifizierung" className={buttonClasses("ghost", "md")}>
            Zurücksetzen
          </Link>
        ) : null}
      </form>

      <a href={exportHref} className={buttonClasses("secondary", "md")} download>
        CSV-Export
      </a>
    </Toolbar>
  );
}
