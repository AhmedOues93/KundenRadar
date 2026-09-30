/**
 * Leichtgewichtiges HTML-Auslesen ohne zusaetzliche Abhaengigkeit.
 *
 * Es wird bewusst kein vollstaendiger DOM aufgebaut: die Analyse braucht nur
 * einzelne Tags und Attribute, und regulaere Ausdruecke bleiben hier
 * kalkulierbar, weil die Eingabegroesse begrenzt ist (siehe LIMITS).
 */

export type Attributes = Record<string, string>;

export type Tag = {
  name: string;
  attributes: Attributes;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

/** Entfernt script-, style- und noscript-Bloecke sowie Kommentare. */
export function stripNonContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, " ");
}

/** Sichtbarer Text der Seite, auf eine Zeile normalisiert. */
export function visibleText(html: string): string {
  return decodeEntities(stripNonContent(html).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttributes(source: string): Attributes {
  const attributes: Attributes = {};
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTRIBUTE_PATTERN.exec(source)) !== null) {
    const name = (match[1] ?? "").toLowerCase();
    if (!name) continue;
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attributes[name] = decodeEntities(value).trim();
  }
  return attributes;
}

/** Alle Vorkommen eines Tags mit ihren Attributen. */
export function findTags(html: string, tagName: string): Tag[] {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  const tags: Tag[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    tags.push({ name: tagName.toLowerCase(), attributes: parseAttributes(match[1] ?? "") });
  }
  return tags;
}

/** Inhalt aller Vorkommen eines Element-Paares, z. B. `h1`. */
export function findElementTexts(html: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "gi");
  const texts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const text = decodeEntities((match[1] ?? "").replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    texts.push(text);
  }
  return texts;
}

export function firstNonEmpty(values: (string | undefined | null)[]): string | null {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return null;
}

/** `<meta name="…">` bzw. `<meta property="…">` auslesen. */
export function metaContent(html: string, key: string): string | null {
  const wanted = key.toLowerCase();
  for (const tag of findTags(html, "meta")) {
    const name = (tag.attributes["name"] ?? tag.attributes["property"] ?? tag.attributes["http-equiv"] ?? "")
      .toLowerCase();
    if (name === wanted) {
      const content = tag.attributes["content"];
      if (content && content.trim()) return content.trim();
    }
  }
  return null;
}

/** `<link rel="…">`-Href auslesen. */
export function linkHref(html: string, rel: string): string | null {
  const wanted = rel.toLowerCase();
  for (const tag of findTags(html, "link")) {
    const rels = (tag.attributes["rel"] ?? "").toLowerCase().split(/\s+/);
    if (rels.includes(wanted)) {
      const href = tag.attributes["href"];
      if (href && href.trim()) return href.trim();
    }
  }
  return null;
}

/** Erkennt strukturierte Daten (JSON-LD, Microdata oder RDFa). */
export function hasStructuredData(html: string): boolean {
  if (/<script\b[^>]*type\s*=\s*["']?application\/ld\+json/i.test(html)) return true;
  if (/\bitemscope\b/i.test(html) && /\bitemtype\s*=/i.test(html)) return true;
  if (/\bvocab\s*=\s*["']?https?:\/\/schema\.org/i.test(html)) return true;
  return false;
}

/** Bekannte CMS-/Baukasten-Signaturen im Markup. */
const CMS_SIGNATURES: { label: string; test: RegExp }[] = [
  { label: "WordPress", test: /wp-content|wp-includes|wp-json|wordpress/i },
  { label: "TYPO3", test: /typo3temp|typo3conf|\btypo3\b/i },
  { label: "Joomla", test: /\/media\/jui\/|joomla/i },
  { label: "Drupal", test: /\/sites\/default\/files|drupal/i },
  { label: "Shopify", test: /cdn\.shopify\.com|shopify/i },
  { label: "Wix", test: /static\.wixstatic\.com|\bwix\b/i },
  { label: "Squarespace", test: /squarespace/i },
  { label: "Webflow", test: /webflow/i },
  { label: "Jimdo", test: /jimdo/i },
  { label: "Contao", test: /contao/i },
  { label: "IONOS MyWebsite", test: /mywebsite|ionos/i },
  { label: "Shopware", test: /shopware/i },
  { label: "Next.js", test: /__NEXT_DATA__|\/_next\//i },
  { label: "Nuxt", test: /__NUXT__|\/_nuxt\//i },
];

export function detectCmsHints(html: string, generator: string | null): string[] {
  const hints = new Set<string>();
  const haystack = `${html}\n${generator ?? ""}`;
  for (const signature of CMS_SIGNATURES) {
    if (signature.test.test(haystack)) hints.add(signature.label);
  }
  return [...hints];
}
