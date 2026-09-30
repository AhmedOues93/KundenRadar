import Link from "next/link";
import { Button, Input, Label, Select, buttonClasses } from "@/components/ui";
import { INTERESTING_SCORE_THRESHOLD } from "@/lib/queries";

/**
 * Filterleiste der Qualifizierung als GET-Formular: die Auswahl steht in der
 * URL, ist teilbar und funktioniert ohne JavaScript.
 */
export function QualificationFilters({
  values,
  cities,
  industries,
}: {
  values: { score: string; agency: string; analysis: string; industry: string; city: string; search: string };
  cities: string[];
  industries: string[];
}) {
  const hasFilters =
    values.search !== "" ||
    values.industry !== "" ||
    values.city !== "" ||
    (values.score !== "" && values.score !== "ANY") ||
    (values.agency !== "" && values.agency !== "ANY") ||
    (values.analysis !== "" && values.analysis !== "ANY");

  return (
    <form
      method="get"
      action="/qualifizierung"
      className="grid grid-cols-1 gap-2.5 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="sm:col-span-2">
        <Label htmlFor="q-search">Suche</Label>
        <Input id="q-search" name="search" defaultValue={values.search} placeholder="Firma oder Domain" />
      </div>

      <div>
        <Label htmlFor="q-score">Potenzial</Label>
        <Select id="q-score" name="score" defaultValue={values.score || "ANY"}>
          <option value="ANY">Alle</option>
          <option value="HIGH">Hoher Score (ab {INTERESTING_SCORE_THRESHOLD})</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="q-agency">Agenturhinweis</Label>
        <Select id="q-agency" name="agency" defaultValue={values.agency || "ANY"}>
          <option value="ANY">Alle</option>
          <option value="NONE">Kein Agenturhinweis</option>
          <option value="FOUND">Agenturhinweis vorhanden</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="q-analysis">Analyse</Label>
        <Select id="q-analysis" name="analysis" defaultValue={values.analysis || "ANY"}>
          <option value="ANY">Alle</option>
          <option value="MISSING">Noch nicht analysiert</option>
          <option value="DONE">Erfolgreich analysiert</option>
          <option value="FAILED">Analyse fehlgeschlagen</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="q-industry">Branche</Label>
        <Select id="q-industry" name="industry" defaultValue={values.industry}>
          <option value="">Alle Branchen</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="q-city">Ort</Label>
        <Select id="q-city" name="city" defaultValue={values.city}>
          <option value="">Alle Orte</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit" size="sm">
          Filter anwenden
        </Button>
        {hasFilters ? (
          <Link href="/qualifizierung" className={buttonClasses("secondary", "sm")}>
            Zurücksetzen
          </Link>
        ) : null}
      </div>
    </form>
  );
}
