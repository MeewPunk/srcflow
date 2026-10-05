export type FontSansId = "chakra-petch" | "noto-sans-thai" | "sarabun" | "prompt";
export type FontMonoId = "system" | "ibm-plex-mono";

export const FONT_SANS_OPTIONS: { id: FontSansId; label: string; value: string }[] = [
  {
    id: "chakra-petch",
    label: "Chakra Petch",
    value: "var(--font-chakra-petch), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "noto-sans-thai",
    label: "Noto Sans Thai",
    value: "var(--font-noto-sans-thai), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "sarabun",
    label: "Sarabun",
    value: "var(--font-sarabun), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "prompt",
    label: "Prompt",
    value: "var(--font-prompt), ui-sans-serif, system-ui, sans-serif",
  },
];

export const FONT_MONO_OPTIONS: { id: FontMonoId; label: string; value: string }[] = [
  {
    id: "system",
    label: "System Monospace",
    value: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    value: "var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  },
];

export type ColorTokens = {
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  surface: string;
};

export const COLOR_TOKEN_KEYS: (keyof ColorTokens)[] = [
  "background",
  "foreground",
  "muted",
  "accent",
  "surface",
];

export type ThemeState = {
  light: ColorTokens;
  dark: ColorTokens;
  pageGradient: string;
  radius: number;
  fontSans: FontSansId;
  fontMono: FontMonoId;
};
