/** Fachliche Typen von KundenRadar. Bewusst als Union-Typen statt freier Strings. */

export const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const LEAD_STATUSES = [
  "NEW",
  "ANALYZED",
  "REVIEW",
  "TO_CONTACT",
  "CONTACTED",
  "REPLIED",
  "MEETING",
  "OFFER",
  "WON",
  "LOST",
  "ARCHIVED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  "MANUAL",
  "IMPORT",
  "DISCOVERY",
  "REFERRAL",
  "INBOUND",
  "RESEARCH",
  "OTHER",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const ANALYSIS_STATUSES = ["PENDING", "SUCCESS", "FAILED", "BLOCKED"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ACTIVITY_TYPES = [
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "STATUS_CHANGED",
  "ANALYSIS_RUN",
  "NOTE_ADDED",
  "ARCHIVED",
  "RESTORED",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Gruppen, in denen Findings dem Vertrieb praesentiert werden. */
export const FINDING_GROUPS = [
  "TECHNIK",
  "SEO",
  "MOBILE",
  "ACCESSIBILITY",
  "CONTENT",
  "AGENCY",
] as const;
export type FindingGroup = (typeof FINDING_GROUPS)[number];

/** `PROBLEM` und `HINWEIS` erhoehen den Score, `OK` und `INFO` nicht. */
export const FINDING_SEVERITIES = ["PROBLEM", "HINWEIS", "OK", "INFO"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export type Finding = {
  /** Stabiler Schluessel, z. B. `seo.title.missing`. */
  id: string;
  group: FindingGroup;
  severity: FindingSeverity;
  title: string;
  /** Was technisch festgestellt wurde – sachlich, ohne Dramatisierung. */
  meaning: string;
  /** Warum das ein Gesprächspunkt in der Akquise sein kann. */
  salesRelevance: string;
  /** Punkte, die dieses Finding zum Analysepotenzial beitraegt. */
  points: number;
  /** Optionaler Messwert, z. B. „4 von 12 Bildern". */
  detail?: string;
};

export type AgencyHint = {
  found: boolean;
  agencyName: string | null;
  /** Wortwoertlicher Textausschnitt als Nachweis. */
  evidence: string | null;
  sourceUrl: string | null;
  /** Wo der Hinweis gefunden wurde, z. B. `footer` oder `link`. */
  location: string | null;
};

export type AnalysisMetrics = {
  httpStatus: number | null;
  https: boolean;
  redirectCount: number;
  redirectChain: string[];
  responseTimeMs: number | null;
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  hasViewport: boolean;
  canonical: string | null;
  langAttribute: string | null;
  generator: string | null;
  cmsHints: string[];
  robotsTxt: boolean;
  sitemapXml: boolean;
  openGraph: { title: string | null; description: string | null; image: string | null };
  structuredData: boolean;
  internalLinks: number;
  externalLinks: number;
  checkedLinks: number;
  brokenLinks: { url: string; status: number | null }[];
  imageCount: number;
  imagesWithoutAlt: number;
  largeImages: { url: string; bytes: number }[];
  htmlBytes: number;
};

export type AnalysisResult = {
  requestedUrl: string;
  finalUrl: string | null;
  domain: string | null;
  status: AnalysisStatus;
  errorMessage: string | null;
  score: number | null;
  findings: Finding[];
  metrics: AnalysisMetrics | null;
  agencyHint: AgencyHint | null;
};

export type Lead = {
  id: string;
  organization_id: string;
  company_name: string;
  website_url: string | null;
  domain: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  source: LeadSource;
  status: LeadStatus;
  potential_score: number | null;
  has_agency: boolean;
  detected_agency_name: string | null;
  notes: string | null;
  last_analysis_id: string | null;
  last_analyzed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WebsiteAnalysis = {
  id: string;
  organization_id: string;
  lead_id: string | null;
  requested_url: string;
  final_url: string | null;
  domain: string | null;
  status: AnalysisStatus;
  error_message: string | null;
  http_status: number | null;
  response_time_ms: number | null;
  score: number | null;
  findings: Finding[];
  metrics: AnalysisMetrics | null;
  agency_hint: AgencyHint | null;
  created_by: string | null;
  created_at: string;
};

export type LeadNote = {
  id: string;
  lead_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type LeadActivity = {
  id: string;
  lead_id: string;
  type: ActivityType;
  message: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type Membership = {
  organization_id: string;
  role: OrganizationRole;
  organizations: Organization | null;
};
