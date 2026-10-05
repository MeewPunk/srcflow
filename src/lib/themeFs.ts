import fs from "node:fs/promises";
import path from "node:path";
import {
  COLOR_TOKEN_KEYS,
  FONT_MONO_OPTIONS,
  FONT_SANS_OPTIONS,
  type ColorTokens,
  type FontMonoId,
  type FontSansId,
  type ThemeState,
} from "./theme";
import { EditorError } from "@/i18n/editor";

const GLOBALS_CSS = path.join(process.cwd(), "src", "app", "globals.css");

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function assertColor(v: string) {
  if (!HEX_RE.test(v)) {
    throw new EditorError("badColor", { value: v });
  }
}

function assertCssSafe(v: string) {
  if (/[;{}\n\r]/.test(v)) {
    throw new EditorError("badChars");
  }
}

function extractRegion(css: string, name: string) {
  const startTag = `/* @theme-manager:${name}-start */`;
  const endTag = `/* @theme-manager:${name}-end */`;
  const start = css.indexOf(startTag);
  const end = css.indexOf(endTag);
  if (start === -1 || end === -1 || end < start) {
    throw new EditorError("themeMarker", { name });
  }
  const regionStart = start + startTag.length;
  return { region: css.slice(regionStart, end), start: regionStart, end };
}

function readVar(region: string, name: string): string {
  const m = region.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!m) throw new EditorError("varNotFound", { name });
  return m[1].trim();
}

function replaceVar(region: string, name: string, value: string): string {
  const re = new RegExp(`(--${name}\\s*:\\s*)[^;]+;`);
  if (!re.test(region)) {
    throw new EditorError("varNotFound", { name });
  }
  return region.replace(re, `$1${value};`);
}

function splice(css: string, start: number, end: number, next: string): string {
  return css.slice(0, start) + next + css.slice(end);
}

export async function readTheme(): Promise<ThemeState> {
  const css = await fs.readFile(GLOBALS_CSS, "utf8");
  return parseTheme(css);
}

function parseTheme(css: string): ThemeState {
  const { region: lightRegion } = extractRegion(css, "light");
  const { region: darkRegion } = extractRegion(css, "dark");
  const { region: themeRegion } = extractRegion(css, "theme-block");

  const readColors = (region: string): ColorTokens => ({
    background: readVar(region, "background"),
    foreground: readVar(region, "foreground"),
    muted: readVar(region, "muted"),
    accent: readVar(region, "accent"),
    surface: readVar(region, "surface"),
  });

  const fontSansValue = readVar(themeRegion, "font-sans");
  const fontMonoValue = readVar(themeRegion, "font-mono");

  return {
    light: readColors(lightRegion),
    dark: readColors(darkRegion),
    pageGradient: readVar(lightRegion, "page-gradient"),
    radius: parseInt(readVar(lightRegion, "radius"), 10),
    fontSans:
      FONT_SANS_OPTIONS.find((f) => f.value === fontSansValue)?.id ?? "chakra-petch",
    fontMono: FONT_MONO_OPTIONS.find((f) => f.value === fontMonoValue)?.id ?? "system",
  };
}

export type ThemePatch = Partial<{
  light: Partial<ColorTokens>;
  dark: Partial<ColorTokens>;
  pageGradient: string;
  radius: number;
  fontSans: FontSansId;
  fontMono: FontMonoId;
}>;

export async function writeTheme(patch: ThemePatch): Promise<ThemeState> {
  let css = await fs.readFile(GLOBALS_CSS, "utf8");

  if (patch.light) {
    for (const key of COLOR_TOKEN_KEYS) {
      const v = patch.light[key];
      if (!v) continue;
      assertColor(v);
      const { region, start, end } = extractRegion(css, "light");
      css = splice(css, start, end, replaceVar(region, key, v));
      const theme = extractRegion(css, "theme-block");
      if (key === "background" || key === "foreground" || key === "accent") {
        css = splice(
          css,
          theme.start,
          theme.end,
          replaceVar(theme.region, `color-${key}`, v)
        );
      }
    }
  }

  if (patch.dark) {
    for (const key of COLOR_TOKEN_KEYS) {
      const v = patch.dark[key];
      if (!v) continue;
      assertColor(v);
      const { region, start, end } = extractRegion(css, "dark");
      css = splice(css, start, end, replaceVar(region, key, v));
    }
  }

  if (patch.pageGradient !== undefined) {
    const v = patch.pageGradient.trim() || "none";
    assertCssSafe(v);
    const { region, start, end } = extractRegion(css, "light");
    css = splice(css, start, end, replaceVar(region, "page-gradient", v));
  }

  if (patch.radius !== undefined) {
    const r = patch.radius;
    if (!Number.isFinite(r) || r < 0 || r > 40) {
      throw new EditorError("badRadius");
    }
    {
      const { region, start, end } = extractRegion(css, "light");
      css = splice(css, start, end, replaceVar(region, "radius", `${r}px`));
    }
    {
      const { region, start, end } = extractRegion(css, "theme-block");
      let next = replaceVar(region, "radius-xl", `${r + 6}px`);
      next = replaceVar(next, "radius-lg", `${r}px`);
      next = replaceVar(next, "radius-md", `${Math.max(0, r - 2)}px`);
      css = splice(css, start, end, next);
    }
  }

  if (patch.fontSans) {
    const opt = FONT_SANS_OPTIONS.find((f) => f.id === patch.fontSans);
    if (!opt) throw new EditorError("unknownFont", { font: String(patch.fontSans) });
    const { region, start, end } = extractRegion(css, "theme-block");
    css = splice(css, start, end, replaceVar(region, "font-sans", opt.value));
  }

  if (patch.fontMono) {
    const opt = FONT_MONO_OPTIONS.find((f) => f.id === patch.fontMono);
    if (!opt) throw new EditorError("unknownMonoFont", { font: String(patch.fontMono) });
    const { region, start, end } = extractRegion(css, "theme-block");
    css = splice(css, start, end, replaceVar(region, "font-mono", opt.value));
  }

  await fs.writeFile(GLOBALS_CSS, css, "utf8");
  return parseTheme(css);
}
