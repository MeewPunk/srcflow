import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  Chakra_Petch,
  Noto_Sans_Thai,
  Sarabun,
  Prompt,
  IBM_Plex_Mono,
} from "next/font/google";
import { notFound } from "next/navigation";
import { DrawerLayout } from "@/components/editor/DrawerLayout";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "./dictionaries";
import "../globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const FONT_VARS = [chakraPetch, notoSansThai, sarabun, prompt, ibmPlexMono]
  .map((f) => f.variable)
  .join(" ");

// site defaults per language — pages without their own title/description use these;
// edited from the editor (html & body → site info), stored in dictionaries/{lang}.json
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const { meta } = await getDictionary(lang);
  // empty optional fields are left out so Next falls back to its own defaults
  const or = (v: string) => v || undefined;
  return {
    title: { default: meta.title, template: `%s | ${meta.title}` },
    description: or(meta.description),
    keywords: meta.keywords.length ? meta.keywords : undefined,
    applicationName: or(meta.siteName),
    openGraph: {
      siteName: or(meta.siteName),
      title: or(meta.ogTitle) ?? meta.title,
      description: or(meta.ogDescription) ?? or(meta.description),
    },
  };
}

// @layout-manager:start
const HTML_CLASS = "";
const BODY_CLASS = "";
const HTML_STYLE: Record<string, string> = {};
const BODY_STYLE: Record<string, string> = {};
// @layout-manager:end

const toStyle = (s: Record<string, string>) => s as unknown as CSSProperties;

const THEME_INIT = `try{var m=localStorage.getItem("srcflow:theme-preview-mode");if(m==="light"||m==="dark")document.documentElement.dataset.theme=m;}catch(e){}`;

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html
      lang={lang}
      className={`${FONT_VARS} ${HTML_CLASS}`.trim()}
      style={toStyle(HTML_STYLE)}
      suppressHydrationWarning
    >
      <body className={BODY_CLASS} style={toStyle(BODY_STYLE)}>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <DrawerLayout>{children}</DrawerLayout>
      </body>
    </html>
  );
}
