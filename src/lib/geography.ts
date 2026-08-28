// Issue #12: locale-aware geography formatting.
//
// A chapter/location must format its address and display its
// name using structured data (country, region, timezone) rather
// than concatenating `${city}, Australia`. The helpers below
// keep formatting in one place so a new chapter can be added
// without touching the page-level templates.

export interface ChapterGeography {
  readonly slug: string;
  readonly name: string;
  readonly displayLocality?: string;
  readonly countryCode?: string;
  readonly region?: string;
  readonly timezone?: string;
  readonly locale?: string;
}

const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  GB: "United Kingdom",
  IE: "Ireland",
  US: "United States",
  CA: "Canada",
  SG: "Singapore",
  HK: "Hong Kong",
  JP: "Japan",
};

const COUNTRY_ADDRESS_FORMAT: Record<string, "AU" | "US" | "EU" | "POSTCODE_FIRST"> = {
  AU: "AU",
  NZ: "AU",
  GB: "POSTCODE_FIRST",
  IE: "POSTCODE_FIRST",
  US: "US",
  CA: "US",
  SG: "POSTCODE_FIRST",
  HK: "POSTCODE_FIRST",
  JP: "POSTCODE_FIRST",
};

export function countryLabel(code: string | undefined): string | null {
  if (!code) return null;
  return COUNTRY_LABELS[code.toUpperCase()] ?? code.toUpperCase();
}

export function formatLocality(chapter: ChapterGeography): string {
  const locality = chapter.displayLocality ?? chapter.name;
  const country = countryLabel(chapter.countryCode);
  if (!country) return locality;
  if (chapter.countryCode?.toUpperCase() === "AU" && chapter.region) {
    return `${locality}, ${chapter.region}, ${country}`;
  }
  return `${locality}, ${country}`;
}

export function addressFormat(code: string | undefined): "AU" | "US" | "EU" | "POSTCODE_FIRST" {
  if (!code) return "AU";
  return COUNTRY_ADDRESS_FORMAT[code.toUpperCase()] ?? "AU";
}

export function formatAddressLine(opts: {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postcode: string;
  countryCode?: string;
}): string {
  const format = addressFormat(opts.countryCode);
  const lines: string[] = [];
  lines.push(opts.line1);
  if (opts.line2) lines.push(opts.line2);
  switch (format) {
    case "US":
      lines.push(`${opts.city}${opts.region ? `, ${opts.region}` : ""} ${opts.postcode}`);
      break;
    case "POSTCODE_FIRST":
      lines.push(`${opts.city}${opts.region ? `, ${opts.region}` : ""} ${opts.postcode}`);
      break;
    case "EU":
      lines.push(`${opts.postcode} ${opts.city}${opts.region ? `, ${opts.region}` : ""}`);
      break;
    case "AU":
    default:
      lines.push(`${opts.city} ${opts.region ? `${opts.region} ` : ""}${opts.postcode}`);
      break;
  }
  const country = countryLabel(opts.countryCode);
  if (country) lines.push(country);
  return lines.join("\n");
}

/**
 * Format a UTC ISO timestamp in the chapter's timezone. Uses
 * Intl.DateTimeFormat with the IANA timezone, falling back to
 * UTC if the timezone is missing or invalid.
 */
export function formatInZone(iso: string, timezone: string | undefined, locale = "en-AU"): string {
  const tz = timezone ?? "UTC";
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  }
}
