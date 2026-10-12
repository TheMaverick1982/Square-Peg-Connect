// Lead source tracking for the public forms.
// The website (squarepegpizzeria.com) remembers how a visitor first arrived and passes it
// to embedded forms as URL params. Direct links to a form work too (utm tags / referrer).

const KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid",
  "sp_ref", "sp_landing",
] as const;

export type Attribution = Partial<Record<(typeof KEYS)[number], string>> & { label?: string };

const STORE = "sp_attribution";
const OWN_HOSTS = /(^|\.)squarepegpizzeria\.com$|\.vercel\.app$|^localhost$/i;

const host = (url?: string) => {
  try { return url ? new URL(url).hostname.replace(/^www\./, "").toLowerCase() : ""; } catch { return ""; }
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function nameForSource(s: string) {
  const v = s.toLowerCase();
  if (["facebook", "fb", "meta", "facebook.com", "m.facebook.com", "l.facebook.com", "lm.facebook.com"].includes(v)) return "Facebook";
  if (["instagram", "ig", "instagram.com", "l.instagram.com"].includes(v)) return "Instagram";
  if (v.startsWith("google")) return "Google";
  if (v.startsWith("bing")) return "Bing";
  return cap(s);
}

function referrerLabel(ref: string) {
  const h = host(ref);
  if (!h) return "";
  if (/(^|\.)google\./.test(h)) return "Google search";
  if (/(^|\.)bing\.com$/.test(h)) return "Bing search";
  if (/(^|\.)duckduckgo\.com$|(^|\.)yahoo\.com$/.test(h)) return `${cap(h.split(".")[h.split(".").length - 2])} search`;
  if (/facebook\.com$|fb\.com$|fb\.me$/.test(h)) return "Facebook";
  if (/instagram\.com$/.test(h)) return "Instagram";
  if (/yelp\./.test(h)) return "Yelp";
  if (/tripadvisor\./.test(h)) return "Tripadvisor";
  if (/tiktok\.com$/.test(h)) return "TikTok";
  if (/(mail\.google|outlook\.|mail\.yahoo)/.test(h)) return "Email";
  return `Website: ${h}`;
}

/** Plain-English source, e.g. "Meta ad — campaign: fall-catering" or "Google search". */
export function describeSource(a: Attribution): string {
  const medium = (a.utm_medium || "").toLowerCase();
  const paid = /cpc|ppc|paid|ads?$|display|paid_social|paidsocial/.test(medium);
  let label = "";
  if (a.gclid || a.gbraid || a.wbraid) label = "Google Ads";
  else if (a.utm_source) {
    const name = nameForSource(a.utm_source);
    if (paid) label = ["Facebook", "Instagram"].includes(name) ? `Meta ad (${name})` : `${name} ad`;
    else if (name === "Google" && /business|gbp|maps|local/.test(medium + (a.utm_campaign || ""))) label = "Google Business Profile";
    else label = medium ? `${name} (${medium})` : name;
  } else if (a.fbclid) label = "Facebook/Instagram link (ad or post)";
  else if (a.msclkid) label = "Microsoft/Bing Ads";
  else if (a.ttclid) label = "TikTok ad";
  else if (a.sp_ref) label = referrerLabel(a.sp_ref);
  if (!label) label = a.sp_landing ? "Direct (typed address or bookmark)" : "Direct / unknown";
  if (a.utm_campaign) label += ` — campaign: ${a.utm_campaign}`;
  return label;
}

/** Read attribution from this page's URL (and referrer for direct links). Call once on form load. */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const found: Attribution = {};
  KEYS.forEach((k) => { const v = params.get(k); if (v) found[k] = v.slice(0, 300); });

  // Opened directly (not through the website): use the page that sent them here.
  if (!found.sp_ref && document.referrer && !OWN_HOSTS.test(host(document.referrer))) found.sp_ref = document.referrer.slice(0, 300);

  let stored: Attribution = {};
  try { stored = JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch { /* ignore */ }
  const result = Object.keys(found).length ? found : stored;
  result.label = describeSource(result);
  try { sessionStorage.setItem(STORE, JSON.stringify(result)); } catch { /* ignore */ }
  return result;
}

/** Insert a row with lead_source/attribution, retrying without them if the columns don't exist yet. */
export async function insertWithSource(
  table: any, row: Record<string, unknown>, a: Attribution,
): Promise<{ error: any; data?: any }> {
  const withSource = { ...row, lead_source: a.label || null, attribution: a };
  let res = await table.insert([withSource]);
  if (res.error && /lead_source|attribution/i.test(res.error.message || "")) res = await table.insert([row]);
  return res;
}
