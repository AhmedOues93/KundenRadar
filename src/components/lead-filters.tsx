import Link from "next/link";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { LEAD_STATUSES } from "@/lib/types";
import { Button, Input, Select, Toolbar, ToolbarField, buttonClasses } from "@/components/ui";

/**
 * Filterleiste als GET-Formular: die Auswahl steht in der URL, ist teilbar und
 * funktioniert ohne JavaScript. Eine Zeile, damit über der Tabelle möglichst
 * wenig vertikaler Platz verloren geht.
 */
export function LeadFilters({
  values,
  cities,
  industries,
  exportHref,
}: {
  values: { search: string; status: string; city: string; industry: string; sort: string };
  cities: string[];
  industries: string[];
  exportHref: string;
}) {
  const hasFilters = Boolean(
    values.search || values.city || values.industry || (values.status && values.status !== "ACTIVE"),
  );

  return (
    <Toolbar>
      <form method="get" action="/leads" className="flex flex-1 flex-wrap items-end gap-x-2 gap-y-1.5">
        <input type="hidden" name="sort" value={values.sort} />

        <ToolbarField label="Suche" className="w-full sm:w-56">
          <Input
            name="search"
            defaultValue={values.search}
            placeholder="Firma, Domain, Ort, Kontakt"
            aria-label="Leads durchsuchen"
          />
        </ToolbarField>

        <ToolbarField label="Status" className="w-36">
          <Select name="status" defaultValue={values.status || "ACTIVE"}>
            <option value="ACTIVE">Aktive</option>
            <option value="ALL">Alle inkl. Archiv</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <ToolbarField label="Ort" className="w-36">
          <Select name="city" defaultValue={values.city}>
            <option value="">Alle</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <ToolbarField label="Branche" className="w-40">
          <Select name="industry" defaultValue={values.industry}>
            <option value="">Alle</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </Select>
        </ToolbarField>

        <Button type="submit" size="md" variant="secondary">
          Filtern
        </Button>
        {hasFilters ? (
          <Link href="/leads" className={buttonClasses("ghost", "md")}>
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
