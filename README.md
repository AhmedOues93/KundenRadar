# KundenRadar

Interne Web-Anwendung für Webagenturen: potenzielle Neukunden erfassen, deren
Websites technisch analysieren, interessante Firmen qualifizieren und den
Akquise-Prozess bis zum gewonnenen Kunden verfolgen.

Enthalten sind:

* **Phase 1** – mandantenfähige Basis mit Authentifizierung, Lead-Verwaltung,
  deterministischer Website-Analyse, regelbasierter Bewertung,
  Agentur-Erkennung und Akquise-Pipeline.
* **Phase 2** – automatische Lead-Suche nach Region und Branche über
  OpenStreetMap, Duplikaterkennung, Auswahl und Import, kontrollierte
  Stapel-Analyse und eine Qualifizierungsansicht.

---

## Tech Stack

| Bereich       | Wahl                                              |
| ------------- | ------------------------------------------------- |
| Framework     | Next.js 15 (App Router), React 19                 |
| Sprache       | TypeScript (strict, `noUncheckedIndexedAccess`)   |
| Datenbank     | Supabase / PostgreSQL mit Row Level Security      |
| Auth          | Supabase Auth (E-Mail + Passwort, Cookie-Session) |
| Styling       | Tailwind CSS v4                                   |
| Validierung   | Zod                                               |
| Tests         | Vitest                                            |

Keine kostenpflichtige AI- oder externe Analyse-API. Alle Kernfunktionen sind
deterministisch: dieselbe Website ergibt denselben Score.

---

## Einrichtung

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Die App startet und baut auch **ohne** Supabase-Zugangsdaten – die geschützten
Seiten zeigen dann einen Einrichtungshinweis statt eines Fehlers.

### Supabase vorbereiten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. Migrationen der Reihe nach im SQL-Editor ausführen:
   - `supabase/migrations/0001_init.sql` – Tabellen, Enums, Trigger
   - `supabase/migrations/0002_rls.sql` – Row Level Security
   - `supabase/migrations/0003_bootstrap_organization.sql` – Onboarding-Funktion
   - `supabase/migrations/0004_discovery.sql` – Lead-Suche (Phase 2)
   - `supabase/migrations/0005_single_organization_guard.sql` – Onboarding
     einmalig machen
3. `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local` eintragen.
4. Konto über `/login?registrieren=1` anlegen, danach unter `/onboarding` die
   Organisation erstellen.

Der `SUPABASE_SERVICE_ROLE_KEY` ist in Phase 1 **nicht erforderlich**. Er wird
nur serverseitig gelesen (`src/lib/supabase/admin.ts` ist mit `server-only`
markiert) und gelangt nie in den Browser.

### Skripte

```bash
npm run dev        # Entwicklungsserver
npm run build      # Produktionsbuild
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test       # Vitest
```

---

## Architektur

```
src/
  app/
    (app)/            geschützte Routen: Dashboard, Leads, Analysen, Pipeline, Einstellungen
    login/            Anmeldung und Registrierung
    onboarding/       erste Organisation anlegen
  components/         UI-Primitive und fachliche Komponenten
  lib/
    discovery/        Lead-Suche (Kern von Phase 2)
      types.ts        Provider-Abstraktion `LeadDiscoveryProvider`
      industries.ts   Branchenkatalog mit OSM-Abbildung
      osm-mapping.ts  Overpass-Abfrage und Element-Abbildung (rein)
      overpass-provider.ts  OpenStreetMap-Quelle, Transport injizierbar
      registry.ts     Registry der verfügbaren Datenquellen
      dedupe.ts       Duplikaterkennung (rein)
      import.ts       Importplanung und Lead-Abbildung (rein)
      queries.ts      Lesezugriffe auf Läufe und Treffer
    analysis/         Website-Analyse (Kern von Phase 1)
      batch.ts        kontrollierte Stapel-Analyse
      url-guard.ts    SSRF-Schutz: Normalisierung, IP-/Hostname-Prüfung, DNS
      fetcher.ts      HTTP mit Limits, manuellen Redirects und Revalidierung
      html.ts         HTML-Auslesen ohne DOM-Abhängigkeit
      metrics.ts      Messwerte aus HTML (rein, ohne Netzwerk)
      agency.ts       Agentur-Erkennung V1
      score.ts        regelbasierte Bewertung
      run.ts          Orchestrierung
    actions/          Server Actions (Auth, Leads, Analyse)
    queries.ts        Lesezugriffe für Server-Komponenten
    auth.ts           Session- und Organisationskontext
  middleware.ts       Session-Refresh und Routenschutz
supabase/migrations/  versionierte SQL-Migrationen
tests/                Vitest-Suiten
```

**Server/Client-Trennung:** Datenzugriff, Analyse und Mutationen laufen
ausschliesslich serverseitig (Server-Komponenten und Server Actions).
Client-Komponenten kümmern sich nur um Interaktion – Formularzustand, Drag &
Drop, aufklappbare Navigation.

---

## Mandantenfähigkeit

Das Datenmodell ist von Anfang an auf mehrere Agenturen ausgelegt:

```
organizations ──┬── organization_members ── auth.users / profiles
                ├── leads ──┬── website_analyses
                │           ├── lead_notes
                │           └── lead_activities
                ├── website_analyses (auch ohne Lead-Bezug)
                ├── lead_discovery_runs ── lead_discovery_candidates
                └── lead_source_metadata (Herkunft eines Leads)
```

Jeder fachliche Datensatz trägt eine `organization_id`. Rollen: `OWNER`,
`ADMIN`, `MEMBER`.

Die RLS-Policies setzen auf zwei `SECURITY DEFINER`-Funktionen auf,
`is_org_member(uuid)` und `is_org_admin(uuid)`, damit die Policy auf
`organization_members` nicht rekursiv wird. Jeder Zugriff ist auf
Organisationen begrenzt, in denen der Nutzer Mitglied ist. Zusätzlich filtert
jede Query im Anwendungscode noch einmal auf `organization_id` – Defense in
Depth, falls eine Policy einmal zu weit gefasst wird.

---

## Website-Analyse V1

Ein Benutzer gibt eine öffentliche URL an; die Analyse läuft serverseitig.
Geprüft wird:

- **Technik** – HTTP-Status, HTTPS, Weiterleitungskette, Antwortzeit,
  CMS-/Generator-Hinweise
- **SEO** – Titel, Meta-Description, Canonical, robots.txt, sitemap.xml,
  Open Graph, strukturierte Daten (JSON-LD, Microdata, RDFa)
- **Mobile** – Viewport-Meta-Tag
- **Barrierefreiheit** – `lang`-Attribut, Bilder ohne `alt`
- **Content/Struktur** – H1, interne/externe Links, Stichprobe auf nicht
  erreichbare Links, auffällig grosse Bilddateien, HTML-Umfang
- **Agenturhinweise** – siehe unten

### Kein Crawler

Es wird die Startseite geladen, dazu `robots.txt` und `sitemap.xml`, sowie eine
begrenzte Stichprobe von Links und Bildern per `HEAD`. Alle Grenzen stehen an
einer Stelle in `LIMITS` (`src/lib/analysis/fetcher.ts`) und sind unter
*Einstellungen* in der App sichtbar:

| Grenze                  | Wert    |
| ----------------------- | ------- |
| Timeout pro Anfrage     | 8 s     |
| Gesamtbudget je Analyse | 25 s    |
| Weiterleitungen         | max. 5  |
| Gelesenes HTML          | 1,5 MB  |
| Geprüfte Links          | max. 8  |
| Geprüfte Bilder         | max. 8  |

Der Response-Body wird streamend gelesen und bei Erreichen der Grenze
abgebrochen, damit eine sehr grosse Seite den Server nicht belastet.

---

## Lead-Suche (Phase 2)

Unter `/leads/discover` sucht der Benutzer Firmen nach **Ort, Radius, Branche**
und maximaler Trefferzahl.

### Datenquelle

Erste Quelle ist **OpenStreetMap**: Ortsauflösung über Nominatim, Firmensuche
über die Overpass-API. Beides ist öffentlich und legal nutzbar (ODbL 1.0). Es
findet **kein Scraping von Google Maps oder LinkedIn** statt.

Pro Suche gibt es genau eine Geocoding- und eine Overpass-Anfrage, mit
aussagekräftigem User-Agent, hartem Timeout und begrenzter Trefferzahl – so
bleiben die Nutzungsbedingungen der Dienste gewahrt. HTTP 429 und 504 werden in
verständliche Meldungen übersetzt („Rate Limit", „Radius verkleinern").

### Austauschbare Quellen

Die Anwendung hängt nicht an einer einzelnen Quelle. Jede Quelle implementiert
`LeadDiscoveryProvider`:

```ts
interface LeadDiscoveryProvider {
  readonly id: DiscoveryProviderId;
  readonly label: string;
  readonly attribution: string;
  search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoveryResult>;
}
```

Alles danach – Duplikatabgleich, Auswahl, Import, Analyse, Qualifizierung –
arbeitet nur mit `DiscoveryCandidate` und ist quellenunabhängig. Eine weitere
Quelle wird in `src/lib/discovery/registry.ts` eingehängt. Der Transport des
Overpass-Providers ist injizierbar, wodurch er ohne Netzwerk testbar ist.

Der Branchenkatalog (`industries.ts`) bringt seine OSM-Abbildung selbst mit –
Handwerk, Elektriker, Sanitär, Dachdecker, Maler, Tischler, Restaurants, Hotels,
Ärzte, Zahnärzte, Immobilien, Pflege, Rechtsanwälte, Steuerberater, Kfz,
Friseure. Keys und Werte der Abfrage stammen ausschliesslich aus dem Katalog im
Code und werden vor dem Einsetzen strikt validiert – eine Overpass-Abfrage ist
daher nicht über Benutzereingaben manipulierbar.

### Duplikaterkennung

Zwei Wege, beide rein und getestet:

1. **Domain** – normalisiert (Kleinschreibung, ohne `www.`, ohne Pfad).
2. **Firmenname + Adresse** – für Firmen ohne Website. Rechtsformen (`GmbH`,
   `GmbH & Co. KG`, `e.K.`, …) und Umlaute werden vor dem Vergleich
   vereinheitlicht, Strassenkürzel (`Hauptstraße` / `Hauptstr.` /
   `Hauptstrasse`) zusammengeführt.

Zusätzlich werden Dubletten **innerhalb** einer Ergebnisliste erkannt (dieselbe
Firma als Node und als Way). Jeder Treffer trägt seinen Status: `NEW`,
`DUPLICATE_DOMAIN`, `DUPLICATE_NAME_ADDRESS` oder `DUPLICATE_IN_RESULT`. Firmen
ohne Website sind separat gekennzeichnet.

Unmittelbar vor dem Schreiben wird erneut abgeglichen (`planImport`) – zwischen
Suche und Import können Leads entstanden sein, etwa durch einen zweiten
Benutzer. Bereits vorhandene Firmen werden nicht doppelt gespeichert.

### Auswahl vor Import

Es wird nichts automatisch gespeichert. Der Benutzer sieht zuerst die
Trefferliste und kann einzeln, mehrfach oder „alle sinnvollen Treffer" wählen
(neu, mit Website, noch nicht importiert) und dann importieren.

### Stapel-Analyse

Nach dem Import werden ausgewählte Leads in `/qualifizierung` analysiert. Dafür
wird die **bestehende Analyse aus Phase 1 unverändert** verwendet – es gibt
keine zweite Analyse-Engine und damit auch keinen zweiten SSRF-Schutz, der
abweichen könnte.

| Eigenschaft            | Wert                        |
| ---------------------- | --------------------------- |
| Parallelität           | 2 gleichzeitige Analysen    |
| Mindestabstand         | 350 ms zwischen Starts      |
| Leads pro Durchlauf    | max. 25                     |
| Zeitbudget je Stapel   | 240 s                       |

Ein Fehler bei einem Lead stoppt den Stapel nicht: er wird dem Element
zugeordnet und als Analyse mit Status `FAILED` gespeichert, damit er in der
Qualifizierung sichtbar bleibt. Auch ein Fehler beim Speichern oder eine
geworfene Ausnahme brechen den Durchlauf nicht ab. Ist das Zeitbudget
erschöpft, werden die restlichen Elemente als übersprungen gemeldet statt den
Aufruf hängen zu lassen.

### Qualifizierung

`/qualifizierung` zeigt Firma, Website, Ort, Branche, Potenzial-Score, die
wichtigsten Findings, den Agenturhinweis und den Analyse-Status – standardmässig
nach höchstem Potenzial sortiert. Filter: hoher Score, kein Agenturhinweis,
Agenturhinweis vorhanden, noch nicht analysiert, Analyse fehlgeschlagen, Branche
und Ort.

### Vollständiger Ablauf

```
Ort + Radius + Branche
  → Firmen suchen          (/leads/discover)
  → Treffer prüfen         Duplikate und Firmen ohne Website markiert
  → Firmen auswählen
  → Leads importieren
  → Websites analysieren   (/qualifizierung, Stapel)
  → Score berechnen        Phase-1-Bewertung, unverändert
  → nach Potenzial sortiert
  → Lead öffnen            (/leads/[id])
  → in die Pipeline        (/pipeline)
```

---

## Sicherheit: SSRF-Schutz

Benutzer geben URLs ein, die der Server abruft. `src/lib/analysis/url-guard.ts`
prüft **vor jedem einzelnen Request** – auch nach jeder Weiterleitung:

- nur `http:`/`https:`, keine eingebetteten Zugangsdaten, nur freigegebene Ports
- `localhost`, `*.local`, `*.internal`, `*.intranet`, `*.lan`, `*.svc`,
  `*.cluster.local`, punktlose Hostnamen sowie bekannte Metadata-Namen
  (`metadata.google.internal`, `instance-data`, …) werden abgewiesen
- **IPv4:** `0/8`, `10/8`, `127/8`, `169.254/16` (Cloud-Metadata), `172.16/12`,
  `192.168/16`, `100.64/10` (CGNAT), Test- und Benchmark-Netze, Multicast
- **IPv6:** `::`, `::1`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `100::/64`,
  `2001:db8::/32`, `2002::/16`, NAT64, ORCHID sowie IPv4-mapped Adressen
  (`::ffff:127.0.0.1`) über die eingebettete v4-Adresse
- Hostnamen werden per DNS aufgelöst; **sobald eine** der zurückgegebenen
  Adressen intern ist, wird abgebrochen (schützt gegen DNS-Rebinding)

Redirects werden mit `redirect: "manual"` selbst verfolgt und jede Ziel-URL
erneut vollständig validiert – der klassische Angriffspfad „öffentliche URL,
die auf `169.254.169.254` weiterleitet" ist damit geschlossen.

`assertPublicUrl` nimmt einen austauschbaren Resolver, wodurch der Schutz ohne
Netzwerkzugriff testbar ist (`tests/url-guard.test.ts`).

---

## Bewertung (Website-Score)

Der Score ist **regelbasiert und transparent** – keine AI, kein Zufall.
Er beantwortet ausschliesslich:

> Wie interessant erscheint diese Website für eine **manuelle
> Akquise-Prüfung**?

Er ist **keine** Aussage darüber, ob die Firma Kunde wird.

| Bereich | Einordnung                      |
| ------- | ------------------------------- |
| 0–29    | Geringes technisches Potenzial  |
| 30–59   | Prüfen                          |
| 60–79   | Interessant                     |
| 80–100  | Hohes Analysepotenzial          |

Punkte entstehen nur aus benannten technischen Feststellungen, etwa fehlender
Titel (+10), fehlendes HTTPS (+14), fehlender Viewport (+12), fehlende Sitemap
(+6). Alle Gewichte stehen in `SCORE_WEIGHTS` (`src/lib/analysis/score.ts`) und
sind in der App unter *Einstellungen* aufgelistet. Die Summe wird auf 100
begrenzt; die Detailseite zeigt jedes Finding mit seinem Punktbeitrag und die
Summenbildung.

Jedes Finding wird für den Vertrieb aufbereitet, nicht als Rohdaten:

> **Titel fehlt** · Problem
> *Bedeutung:* Die Seite besitzt keinen aussagekräftigen Seitentitel.
> *Akquise-Relevanz:* Kann ein sinnvoller Gesprächspunkt bei einer
> Website-Optimierung sein.

Bewusst vermieden werden nicht belegbare Aussagen wie „Sie verlieren Kunden".

---

## Agentur-Erkennung V1

Kontrolliert durchsucht werden Footer-, Credit- und Impressum-Bereiche sowie
externe Links – nach Formulierungen wie *Website by*, *Designed by*,
*Realisiert durch*, *Umsetzung*, und nach Begriffen wie *Webdesign*,
*Webentwicklung*, *Agentur*.

Findet die Startseite keinen Hinweis, wird zusätzlich die **Impressum-Seite**
geprüft: genau eine weitere Anfrage über denselben SSRF-geschützten Fetch, die
Adresse wird aus den internen Links abgeleitet (`/impressum`, `/imprint`,
`/legal-notice`, …). Die Analyse bleibt damit kein Crawler. Stammt der Hinweis
von dort, ist die Fundstelle als `impressum/…` gekennzeichnet.

Gespeichert werden `has_agency`, `detected_agency_name`, `evidence` (wörtlicher
Textausschnitt), `source_url` und die Fundstelle.

Plattform-Credits (WordPress, Wix, Jimdo, Shopify …) und typische Falschtreffer
(*Agentur für Arbeit*, *Versicherungsagentur* …) werden ausgefiltert.

Die Oberfläche formuliert immer **„Agenturhinweis gefunden"** – nie „hat bereits
eine Agentur". Ein Hinweis belegt keine laufende Zusammenarbeit, und ein
fehlender Hinweis belegt nicht deren Abwesenheit. Agenturhinweise gehen mit
**0 Punkten** in den Score ein: die Bewertung bleibt rein technisch.

---

## Seiten

| Route            | Inhalt                                                        |
| ---------------- | ------------------------------------------------------------- |
| `/dashboard`     | KPIs, neueste Leads, letzte Lead-Suche, Hinweis zur Bewertung  |
| `/leads/discover`| Lead-Suche, Trefferliste, Auswahl und Import                   |
| `/qualifizierung`| Leads nach Potenzial, Filter, Stapel-Analyse                  |
| `/leads`         | Suche, Filter nach Status/Ort/Branche, Sortierung, Tabelle     |
| `/leads/neu`     | Lead manuell erfassen                                         |
| `/leads/[id]`    | Firma, Kontakt, Analyse, Agenturhinweis, Notizen, Aktivitäten |
| `/analysen`      | alle Analysen der Organisation                                |
| `/analysen/[id]` | Findings nach Gruppen, Score-Herkunft, Messwerte              |
| `/pipeline`      | Akquise-Board mit Drag & Drop                                 |
| `/einstellungen` | Organisation, Team, Bewertungsregeln, Analyse-Grenzen         |

Die Filterleiste ist ein reines GET-Formular: die Auswahl steht in der URL, ist
teilbar und funktioniert ohne JavaScript. Die Pipeline nutzt die native
HTML5-Drag-&-Drop-API (keine zusätzliche Abhängigkeit) und bietet auf jeder
Karte zusätzlich ein Auswahlfeld – so ist der Statuswechsel auch per Tastatur
und auf Touch-Geräten möglich.

Desktop und Mobile sind durchgehend berücksichtigt: Seitennavigation wird auf
kleinen Bildschirmen zum ausklappbaren Menü, die Lead-Tabelle zur Kartenliste.

---

## Verifikation gegen eine echte Datenbank

Die Migrationen und die RLS-Policies sind nicht nur geschrieben, sondern gegen
PostgreSQL 16 ausgeführt und geprüft. Dafür genügt ein lokaler Cluster plus ein
kleiner Nachbau der Supabase-Umgebung (`auth.users`, `auth.uid()`, die Rollen
`anon` und `authenticated`).

Geprüft und bestätigt:

- alle fünf Migrationen laufen in Reihenfolge fehlerfrei durch
- zwei Organisationen sehen ausschliesslich ihre eigenen Leads, Analysen,
  Notizen, Suchläufe und Treffer
- ein Nutzer kann einen fremden Lead auch mit bekannter Kennung weder lesen
  noch ändern
- `anon` (nicht angemeldet) sieht in keiner Tabelle eine Zeile und darf nicht
  schreiben – obwohl die Tabellenrechte wie in Supabase gesetzt sind, greift
  also tatsächlich RLS
- `MEMBER` darf die Organisation nicht umbenennen und keine Leads löschen,
  `OWNER` darf es
- Slug-Kollisionen werden hochgezählt (`agentur-alpha`, `agentur-alpha-1`)
- dieselbe Domain ist je Organisation einmalig, in einer anderen Organisation
  aber erlaubt
- der Profil-Trigger füllt `profiles`, und Kollegen derselben Organisation
  sehen sich gegenseitig

Dabei gefundene und behobene Fehler sind unten unter *Korrekturen* aufgeführt.

---

## Tests

```bash
npm run test
```

203 Tests in zwölf Suiten, mit Schwerpunkt auf den sicherheits- und
korrektheitskritischen Teilen.

Phase 1:

- `tests/url-guard.test.ts` – SSRF-Schutz: Protokolle, Ports, Hostnamen,
  IPv4-/IPv6-Bereiche, Cloud-Metadata, DNS-Rebinding
- `tests/metrics.test.ts` – HTML-Auslesen, Link- und Bildzählung, CMS-Erkennung
- `tests/score.test.ts` – jede Bewertungsregel, Obergrenzen, Bänder,
  Reproduzierbarkeit
- `tests/agency.test.ts` – Credit-Muster, Link-Erkennung, Falschtreffer,
  Impressum-Erkennung

Phase 2:

- `tests/discovery-mapping.test.ts` – Branchenkatalog, Overpass-Abfragebau
  (inklusive abgewiesener Manipulationsversuche), Abbildung der OSM-Elemente
- `tests/discovery-dedupe.test.ts` – Normalisierung von Domain, Firmenname und
  Adresse, alle Duplikatfälle, Lead-Abbildung
- `tests/discovery-import.test.ts` – Importplanung: was angelegt und was als
  Duplikat übersprungen wird
- `tests/discovery-provider.test.ts` – Provider mit injiziertem Transport:
  Erfolg, Grenzen, Rate Limit, Timeout, defektes JSON, Abbruch, User-Agent
- `tests/discovery-filters.test.ts` – Filter der Trefferliste, Beschriftungen,
  Suchparameter, Auswahl des besseren Agenturhinweises
- `tests/analysis-batch.test.ts` – Stapel-Analyse: Reihenfolge, Parallelität,
  Mindestabstand, Fehlerisolierung, Zeitbudget

Härtung:

- `tests/safe-redirect.test.ts` – Weiterleitungsziele nach dem Login,
  einschliesslich der über Backslash getarnten fremden Hosts
- `tests/search-term.test.ts` – Aufbereitung von Suchbegriffen für
  PostgREST-Filter und `ilike`-Platzhalter

---

## Korrekturen aus der Nachprüfung

Vier Befunde aus dem Test gegen eine echte Datenbank und dem Lauf der gebauten
Anwendung:

**Onboarding war nicht einmalig.** `create_organization` liess sich mehrfach
aufrufen. Da die Anwendung immer die erste Mitgliedschaft verwendet, waren
weitere Organisationen samt Daten über die Oberfläche nicht mehr erreichbar.
Migration `0005` erzwingt jetzt, was der Kommentar der Funktion schon behauptet
hatte. Eine Einladung in eine andere Organisation bleibt möglich, weil sie
direkt in `organization_members` schreibt.

**Open Redirect über Backslash.** Nach dem Login wurde `?redirectTo=` nur auf
Präfixe geprüft (`/` ja, `//` nein). Browser normalisieren Backslashes in URLs
jedoch zu Schrägstrichen, weshalb `/\evil.example` als `//evil.example` gelesen
wird – also als Weiterleitung auf eine fremde Domain. Das Ziel wird nun gegen
einen festen Ursprung aufgelöst und verworfen, sobald es woanders landet
(`src/lib/safe-redirect.ts`).

**Suchbegriffe konnten den Filterausdruck zerlegen.** Mehrere Suchspalten
werden als `or=(a.ilike.x,b.ilike.y)` übergeben; PostgREST trennt an Kommas und
Klammern. Ein Komma im Suchfeld zerlegte den Ausdruck – ein Backslash davor ist
dort nicht der vorgesehene Mechanismus. Mandantenübergreifend lecken konnte
dabei nichts, weil die `organization_id`-Bedingung und RLS separat greifen; die
Abfrage filterte aber falsch oder brach ab. Strukturelle Zeichen werden jetzt
entfernt und Platzhalter maskiert (`src/lib/search-term.ts`).

**Ausnahme pro Anfrage ohne Konfiguration.** Layout und Seite rendern in Next
parallel. Das Layout zeigte den Einrichtungshinweis, die Seite lief aber
weiter, griff auf Supabase zu und warf. Der Hinweis erschien nur zufällig. Es
gibt jetzt die öffentliche Seite `/setup`, auf die ohne Zugangsdaten umgeleitet
wird – ohne geworfene Ausnahmen.

---

## Bewusst noch nicht umgesetzt

Damit die Basis sauber bleibt, ist Folgendes vorbereitet, aber nicht
angefangen: weitere Datenquellen neben OpenStreetMap (die Abstraktion steht),
Einladungen per E-Mail und Rollenverwaltung in der Oberfläche, Analyse-Historie
mit Zeitverlauf, E-Mail-Sequenzen, Abrechnung und Mandanten-Onboarding als
Self-Service. Das Datenmodell (Organisationen, Rollen, Aktivitäts-Log,
Herkunftsdaten) unterstützt diese Schritte bereits.

Ebenfalls keine AI: Suche, Analyse und Bewertung arbeiten vollständig
deterministisch, ohne Claude-, OpenAI- oder vergleichbare API.
