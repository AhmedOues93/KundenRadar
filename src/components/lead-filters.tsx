import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { LEAD_STATUSES } from "@/lib/types";
import { Button, Input, Label, Select, buttonClasses } from "@/components/ui";
import Link from "next/link";

/**
 * Filterleiste als reines GET-Formular: die Auswahl landet in der URL, ist
 * teilbar und funktioniert auch ohne JavaScript.
 */
export function LeadFilters({
  values,
  cities,
  industries,
}: {
  values: { search: string; status: string; city: string; industry: string; sort: string };
  cities: string[];
  industries: string[];
}) {
  const hasFilters = Boolean(
    values.search || values.city || values.industry || (values.status && values.status !== "ACTIVE"),
  );

  return (
    <form
      method="get"
      action="/leads"
      className="grid grid-cols-1 gap-2.5 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="lg:col-span-2">
        <Label htmlFor="filter-search">Suche</Label>
        <Input
          id="filter-search"
          name="search"
          defaultValue={values.search}
          placeholder="Firma, Domain, Ort, Kontakt …"
        />
      </div>

      <div>
        <Label htmlFor="filter-status">Status</Label>
        <Select id="filter-status" name="status" defaultValue={values.status || "ACTIVE"}>
          <option value="ACTIVE">Aktive Leads</option>
          <option value="ALL">Alle inkl. Archiv</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="filter-city">Ort</Label>
        <Select id="filter-city" name="city" defaultValue={values.city}>
          <option value="">Alle Orte</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="filter-industry">Branche</Label>
        <Select id="filter-industry" name="industry" defaultValue={values.industry}>
          <option value="">Alle Branchen</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="filter-sort">Sortierung</Label>
        <Select id="filter-sort" name="sort" defaultValue={values.sort || "score"}>
          <option value="score">Potenzial absteigend</option>
          <option value="created">Neueste zuerst</option>
          <option value="company">Firma A–Z</option>
        </Select>
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit" size="sm">
          Filter anwenden
        </Button>
        {hasFilters ? (
          <Link href="/leads" className={buttonClasses("secondary", "sm")}>
            Zurücksetzen
          </Link>
        ) : null}
      </div>
    </form>
  );
}
