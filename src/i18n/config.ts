// app locales — the main app is served under /[lang]/… (src/app/[lang], src/proxy.ts)
export const locales = ["en", "th"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const hasLocale = (s: string): s is Locale => (locales as readonly string[]).includes(s);

export function localeOf(pathname: string | null): Locale {
  const first = (pathname ?? "").split("/")[1] ?? "";
  return hasLocale(first) ? first : defaultLocale;
}

// "/en/abc" → "/abc", "/th" → "/" — the editor works with locale-free paths
export function stripLocale(pathname: string | null): string {
  const p = pathname ?? "/";
  const first = p.split("/")[1] ?? "";
  if (!hasLocale(first)) return p;
  return p.slice(first.length + 1) || "/";
}

export const withLocale = (path: string, locale: Locale) =>
  `/${locale}${path === "/" ? "" : path}`;
