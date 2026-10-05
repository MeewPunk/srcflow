import fs from "node:fs/promises";
import path from "node:path";
import { APP_DIR } from "./routeFs";
import { locales, type Locale } from "@/i18n/config";
import { EditorError } from "@/i18n/editor";

// site-wide metadata defaults of one language ([lang]/layout's generateMetadata)
export type SiteMeta = {
  title: string;
  description: string;
  keywords: string[];
  siteName: string;
  ogTitle: string;
  ogDescription: string;
};
export type SiteMetaByLocale = Record<Locale, SiteMeta>;

const MAX_LEN = 300;
const MAX_KEYWORDS = 30;
const TEXT_FIELDS = ["title", "description", "siteName", "ogTitle", "ogDescription"] as const;
const dictFile = (l: Locale) => path.join(APP_DIR, "dictionaries", `${l}.json`);

async function readDict(l: Locale): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(dictFile(l), "utf8"));
}

export async function readSiteMeta(): Promise<SiteMetaByLocale> {
  const out = {} as SiteMetaByLocale;
  for (const l of locales) {
    const m = ((await readDict(l)).meta ?? {}) as Partial<SiteMeta>;
    out[l] = {
      title: m.title ?? "",
      description: m.description ?? "",
      keywords: Array.isArray(m.keywords) ? m.keywords.map(String) : [],
      siteName: m.siteName ?? "",
      ogTitle: m.ogTitle ?? "",
      ogDescription: m.ogDescription ?? "",
    };
  }
  return out;
}

// rewrites only the "meta" key of each dictionary; the rest of the file is kept.
// every language is validated before any file is written, so a bad value writes nothing
export async function writeSiteMeta(input: SiteMetaByLocale): Promise<SiteMetaByLocale> {
  const clean = {} as SiteMetaByLocale;
  for (const l of locales) {
    const src = input[l] ?? ({} as Partial<SiteMeta>);
    const meta = {} as SiteMeta;
    for (const f of TEXT_FIELDS) {
      meta[f] = String(src[f] ?? "").trim();
      if (meta[f].length > MAX_LEN) throw new EditorError("siteMetaTooLong", { lang: l, max: MAX_LEN });
    }
    if (!meta.title) throw new EditorError("siteTitleEmpty", { lang: l });
    meta.keywords = (Array.isArray(src.keywords) ? src.keywords : [])
      .map((k) => String(k).trim())
      .filter(Boolean);
    if (meta.keywords.length > MAX_KEYWORDS || meta.keywords.some((k) => k.length > MAX_LEN))
      throw new EditorError("siteMetaTooLong", { lang: l, max: MAX_LEN });
    clean[l] = meta;
  }
  for (const l of locales) {
    const dict = await readDict(l);
    dict.meta = clean[l];
    await fs.writeFile(dictFile(l), JSON.stringify(dict, null, 2) + "\n", "utf8");
  }
  return readSiteMeta();
}
