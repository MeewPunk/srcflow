import type { Needs } from "@/lib/classApplicability";

// needs: what the element must be for the group to have an effect (see classApplicability)
export type ClassGroup = { label: string; classes: string[]; needs?: Needs };
export type ClassCategory = { id: string; label: string; groups: ClassGroup[] };

const COLOR_FAMILIES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan", "sky",
  "blue", "indigo", "violet", "purple", "fuchsia",
  "pink", "rose",
];
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

// the @theme colors in globals.css (--color-background / foreground / accent)
const THEME_COLORS = ["background", "foreground", "accent"];

function colorGroups(prefix: string, title?: string): ClassGroup[] {
  const label = (l: string) => (title ? `${title} · ${l}` : l);
  const theme: ClassGroup = {
    label: label("theme"),
    classes: THEME_COLORS.map((c) => `${prefix}-${c}`),
  };
  const base: ClassGroup = {
    label: label("base"),
    classes: [
      `${prefix}-transparent`,
      `${prefix}-current`,
      `${prefix}-inherit`,
      `${prefix}-black`,
      `${prefix}-white`,
    ],
  };
  const families = COLOR_FAMILIES.map((f) => ({
    label: label(f),
    classes: SHADES.map((s) => `${prefix}-${f}-${s}`),
  }));
  return [theme, base, ...families];
}

const SPACING = ["0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "8", "10", "12", "16", "20", "24", "32"];
const spacing = (prefix: string) => SPACING.map((v) => `${prefix}-${v}`);

export const TAILWIND_CATEGORIES: ClassCategory[] = [
  {
    id: "layout",
    label: "Layout",
    groups: [
      {
        label: "display",
        classes: [
          "block", "inline-block", "inline", "flex", "inline-flex",
          "grid", "inline-grid", "contents", "hidden",
        ],
      },
      { label: "position", classes: ["static", "relative", "absolute", "fixed", "sticky"] },
      { label: "inset", classes: ["inset-0", "inset-x-0", "inset-y-0", "top-0", "right-0", "bottom-0", "left-0", "top-full", "left-full"], needs: "positioned" },
      { label: "overflow", classes: ["overflow-auto", "overflow-hidden", "overflow-clip", "overflow-visible", "overflow-scroll", "overflow-x-auto", "overflow-y-auto", "overflow-x-hidden", "overflow-y-hidden"], needs: "not-inline" },
      { label: "z-index", classes: ["z-0", "z-10", "z-20", "z-30", "z-40", "z-50", "z-auto"], needs: "z-index" },
      { label: "box-sizing", classes: ["box-border", "box-content"] },
      { label: "isolation", classes: ["isolate", "isolation-auto"] },
      { label: "aspect-ratio", classes: ["aspect-auto", "aspect-square", "aspect-video"], needs: "not-inline" },
      { label: "object-fit", classes: ["object-contain", "object-cover", "object-fill", "object-none", "object-scale-down"], needs: "replaced" },
      { label: "object-position", classes: ["object-center", "object-top", "object-right", "object-bottom", "object-left"], needs: "replaced" },
      { label: "columns", classes: ["columns-1", "columns-2", "columns-3", "columns-auto"], needs: "block-container" },
      { label: "float / clear", classes: ["float-start", "float-end", "float-left", "float-right", "float-none", "clear-both", "clear-none"], needs: "floatable" },
      { label: "visibility", classes: ["visible", "invisible", "collapse"] },
    ],
  },
  {
    id: "flexgrid",
    label: "Flex & Grid",
    groups: [
      { label: "flex-direction", classes: ["flex-row", "flex-row-reverse", "flex-col", "flex-col-reverse"], needs: "flex-container" },
      { label: "flex-wrap", classes: ["flex-wrap", "flex-wrap-reverse", "flex-nowrap"], needs: "flex-container" },
      { label: "flex", classes: ["flex-1", "flex-auto", "flex-initial", "flex-none", "grow", "grow-0", "shrink", "shrink-0"], needs: "flex-item" },
      { label: "justify-content", classes: ["justify-start", "justify-end", "justify-center", "justify-between", "justify-around", "justify-evenly", "justify-stretch"], needs: "flex-or-grid-container" },
      { label: "align-items", classes: ["items-start", "items-end", "items-center", "items-baseline", "items-stretch"], needs: "flex-or-grid-container" },
      { label: "align-content", classes: ["content-start", "content-end", "content-center", "content-between", "content-around", "content-evenly"], needs: "not-inline" },
      { label: "align-self", classes: ["self-auto", "self-start", "self-end", "self-center", "self-stretch"], needs: "self-alignable" },
      { label: "gap", classes: ["gap-0", "gap-1", "gap-2", "gap-3", "gap-4", "gap-5", "gap-6", "gap-8", "gap-10", "gap-12", "gap-x-2", "gap-x-4", "gap-y-2", "gap-y-4"], needs: "gap-container" },
      { label: "grid-cols", classes: ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5", "grid-cols-6", "grid-cols-12", "grid-cols-none"], needs: "grid-container" },
      { label: "grid-rows", classes: ["grid-rows-1", "grid-rows-2", "grid-rows-3", "grid-rows-4", "grid-rows-none"], needs: "grid-container" },
      { label: "col/row span", classes: ["col-span-1", "col-span-2", "col-span-3", "col-span-full", "row-span-1", "row-span-2", "row-span-full"], needs: "grid-item" },
      { label: "place-items", classes: ["place-items-start", "place-items-end", "place-items-center", "place-items-stretch"], needs: "flex-or-grid-container" },
      { label: "place-content", classes: ["place-content-start", "place-content-end", "place-content-center", "place-content-between", "place-content-stretch"], needs: "flex-or-grid-container" },
      { label: "justify-items", classes: ["justify-items-start", "justify-items-end", "justify-items-center", "justify-items-stretch"], needs: "grid-container" },
      { label: "order", classes: ["order-1", "order-2", "order-3", "order-first", "order-last", "order-none"], needs: "flex-or-grid-item" },
      { label: "grid-flow", classes: ["grid-flow-row", "grid-flow-col", "grid-flow-dense", "grid-flow-row-dense"], needs: "grid-container" },
    ],
  },
  {
    id: "spacing",
    label: "Spacing",
    groups: [
      { label: "padding", classes: spacing("p") },
      { label: "padding-x", classes: spacing("px") },
      { label: "padding-y", classes: spacing("py") },
      { label: "padding-top", classes: spacing("pt") },
      { label: "padding-bottom", classes: spacing("pb") },
      { label: "padding-left", classes: spacing("pl") },
      { label: "padding-right", classes: spacing("pr") },
      { label: "margin", classes: [...spacing("m"), "m-auto"] },
      { label: "margin-x", classes: [...spacing("mx"), "mx-auto"] },
      { label: "margin-y", classes: spacing("my"), needs: "not-inline" },
      { label: "margin-top", classes: spacing("mt"), needs: "not-inline" },
      { label: "margin-bottom", classes: spacing("mb"), needs: "not-inline" },
      { label: "margin-left", classes: [...spacing("ml"), "ml-auto"] },
      { label: "margin-right", classes: [...spacing("mr"), "mr-auto"] },
      { label: "space-between", classes: ["space-x-1", "space-x-2", "space-x-4", "space-y-1", "space-y-2", "space-y-4"] },
    ],
  },
  {
    id: "sizing",
    label: "Sizing",
    groups: [
      { label: "size (w + h)", classes: [...spacing("size"), "size-full", "size-auto", "size-fit"], needs: "not-inline" },
      { label: "width", classes: [...spacing("w"), "w-1/2", "w-1/3", "w-2/3", "w-1/4", "w-3/4", "w-full", "w-screen", "w-min", "w-max", "w-fit", "w-auto"], needs: "not-inline" },
      { label: "height", classes: [...spacing("h"), "h-1/2", "h-full", "h-screen", "h-min", "h-max", "h-fit", "h-auto"], needs: "not-inline" },
      { label: "min-width", classes: ["min-w-0", "min-w-full", "min-w-min", "min-w-max", "min-w-fit"], needs: "not-inline" },
      { label: "min-height", classes: ["min-h-0", "min-h-full", "min-h-screen", "min-h-min", "min-h-max", "min-h-fit"], needs: "not-inline" },
      { label: "max-width", classes: ["max-w-none", "max-w-xs", "max-w-sm", "max-w-md", "max-w-lg", "max-w-xl", "max-w-2xl", "max-w-4xl", "max-w-7xl", "max-w-full", "max-w-screen-md", "max-w-screen-lg"], needs: "not-inline" },
      { label: "max-height", classes: ["max-h-full", "max-h-screen", "max-h-96", "max-h-0"], needs: "not-inline" },
    ],
  },
  {
    id: "typography",
    label: "Typography",
    groups: [
      { label: "font-size", classes: ["text-xs", "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl", "text-7xl", "text-8xl", "text-9xl"] },
      { label: "font-weight", classes: ["font-thin", "font-extralight", "font-light", "font-normal", "font-medium", "font-semibold", "font-bold", "font-extrabold", "font-black"] },
      { label: "font-family", classes: ["font-sans", "font-serif", "font-mono"] },
      { label: "font-style", classes: ["italic", "not-italic"] },
      { label: "text-align", classes: ["text-left", "text-center", "text-right", "text-justify", "text-start", "text-end"] },
      { label: "line-height", classes: ["leading-none", "leading-tight", "leading-snug", "leading-normal", "leading-relaxed", "leading-loose", "leading-4", "leading-5", "leading-6", "leading-7", "leading-8"] },
      { label: "letter-spacing", classes: ["tracking-tighter", "tracking-tight", "tracking-normal", "tracking-wide", "tracking-wider", "tracking-widest"] },
      { label: "text-decoration", classes: ["underline", "overline", "line-through", "no-underline"] },
      { label: "text-transform", classes: ["uppercase", "lowercase", "capitalize", "normal-case"] },
      { label: "text-wrap", classes: ["text-wrap", "text-nowrap", "text-balance", "text-pretty", "truncate"] },
      { label: "whitespace", classes: ["whitespace-normal", "whitespace-nowrap", "whitespace-pre", "whitespace-pre-line", "whitespace-pre-wrap"] },
      { label: "word-break", classes: ["break-normal", "break-words", "break-all", "break-keep"] },
      { label: "list-style", classes: ["list-none", "list-disc", "list-decimal", "list-inside", "list-outside"], needs: "list" },
      { label: "vertical-align", classes: ["align-baseline", "align-top", "align-middle", "align-bottom", "align-text-top", "align-text-bottom"], needs: "inline-or-cell" },
      { label: "line-clamp", classes: ["line-clamp-1", "line-clamp-2", "line-clamp-3", "line-clamp-4", "line-clamp-none"] },
      { label: "text-indent", classes: ["indent-0", "indent-1", "indent-2", "indent-4", "indent-8"], needs: "block-container" },
    ],
  },
  {
    id: "text-color",
    label: "Text color",
    groups: colorGroups("text"),
  },
  {
    id: "bg-color",
    label: "Background",
    groups: [
      { label: "size", classes: ["bg-auto", "bg-cover", "bg-contain"] },
      { label: "position", classes: ["bg-center", "bg-top", "bg-right", "bg-bottom", "bg-left"] },
      { label: "repeat", classes: ["bg-repeat", "bg-no-repeat", "bg-repeat-x", "bg-repeat-y"] },
      { label: "attachment", classes: ["bg-fixed", "bg-local", "bg-scroll"] },
      ...colorGroups("bg"),
    ],
  },
  {
    id: "gradient",
    label: "Gradient",
    groups: [
      { label: "direction", classes: ["bg-none", "bg-gradient-to-t", "bg-gradient-to-r", "bg-gradient-to-b", "bg-gradient-to-l", "bg-gradient-to-tr", "bg-gradient-to-br"] },
      { label: "direction (v4)", classes: ["bg-linear-to-t", "bg-linear-to-tr", "bg-linear-to-r", "bg-linear-to-br", "bg-linear-to-b", "bg-linear-to-bl", "bg-linear-to-l", "bg-linear-to-tl", "bg-radial", "bg-conic"] },
      ...colorGroups("from", "from"),
      ...colorGroups("via", "via"),
      ...colorGroups("to", "to"),
    ],
  },
  {
    id: "borders",
    label: "Borders",
    groups: [
      { label: "border-radius", classes: ["rounded-none", "rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full"] },
      ...(["t", "r", "b", "l"] as const).map((side) => ({
        label: `border-radius-${side}`,
        classes: ["none", "sm", "md", "lg", "xl", "2xl", "full"].map((v) => `rounded-${side}-${v}`),
      })),
      { label: "border-width", classes: ["border-0", "border", "border-2", "border-4", "border-8", "border-x", "border-y", "border-t", "border-r", "border-b", "border-l"] },
      { label: "border-style", classes: ["border-solid", "border-dashed", "border-dotted", "border-double", "border-none"] },
      { label: "ring", classes: ["ring-0", "ring-1", "ring-2", "ring-4", "ring-inset"] },
      { label: "outline", classes: ["outline-none", "outline", "outline-2", "outline-offset-2"] },
      ...colorGroups("border").map((g) => ({ ...g, label: `border color · ${g.label}` })),
    ],
  },
  {
    id: "effects",
    label: "Effects",
    groups: [
      { label: "box-shadow", classes: ["shadow-2xs", "shadow-xs", "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-none"] },
      { label: "opacity", classes: ["opacity-0", "opacity-25", "opacity-50", "opacity-75", "opacity-90", "opacity-100"] },
      { label: "blur", classes: ["blur-none", "blur-xs", "blur-sm", "blur-md", "blur-lg", "blur-xl", "blur-2xl", "blur-3xl"] },
      { label: "brightness", classes: ["brightness-50", "brightness-75", "brightness-90", "brightness-100", "brightness-110", "brightness-125", "brightness-150"] },
      { label: "contrast", classes: ["contrast-50", "contrast-75", "contrast-100", "contrast-125", "contrast-150", "contrast-200"] },
      { label: "grayscale / invert", classes: ["grayscale", "grayscale-0", "invert", "invert-0", "sepia", "sepia-0"] },
      { label: "saturate", classes: ["saturate-0", "saturate-50", "saturate-100", "saturate-150", "saturate-200"] },
      { label: "backdrop-blur", classes: ["backdrop-blur-none", "backdrop-blur-xs", "backdrop-blur-sm", "backdrop-blur-md", "backdrop-blur-lg", "backdrop-blur-xl"] },
      { label: "mix-blend", classes: ["mix-blend-normal", "mix-blend-multiply", "mix-blend-screen", "mix-blend-overlay", "mix-blend-darken", "mix-blend-lighten"] },
    ],
  },
  {
    id: "transitions",
    label: "Transitions",
    groups: [
      { label: "transition", classes: ["transition-none", "transition-all", "transition", "transition-colors", "transition-opacity", "transition-transform"] },
      { label: "duration", classes: ["duration-75", "duration-100", "duration-150", "duration-200", "duration-300", "duration-500", "duration-700", "duration-1000"] },
      { label: "ease", classes: ["ease-linear", "ease-in", "ease-out", "ease-in-out"] },
      { label: "animation", classes: ["animate-none", "animate-spin", "animate-ping", "animate-pulse", "animate-bounce"] },
    ],
  },
  {
    id: "transforms",
    label: "Transforms",
    groups: [
      { label: "scale", classes: ["scale-0", "scale-50", "scale-75", "scale-90", "scale-95", "scale-100", "scale-105", "scale-110", "scale-125"], needs: "not-inline" },
      { label: "rotate", classes: ["rotate-0", "rotate-45", "rotate-90", "rotate-180", "-rotate-45", "-rotate-90"], needs: "not-inline" },
      { label: "translate-x", classes: ["translate-x-0", "translate-x-1", "translate-x-2", "translate-x-4", "translate-x-full", "-translate-x-full"], needs: "not-inline" },
      { label: "translate-y", classes: ["translate-y-0", "translate-y-1", "translate-y-2", "translate-y-4", "translate-y-full", "-translate-y-full"], needs: "not-inline" },
      { label: "origin", classes: ["origin-center", "origin-top", "origin-bottom", "origin-left", "origin-right"], needs: "not-inline" },
    ],
  },
  {
    id: "interactivity",
    label: "Interactivity",
    groups: [
      { label: "cursor", classes: ["cursor-auto", "cursor-default", "cursor-pointer", "cursor-wait", "cursor-text", "cursor-move", "cursor-not-allowed"] },
      { label: "user-select", classes: ["select-none", "select-text", "select-all", "select-auto"] },
      { label: "pointer-events", classes: ["pointer-events-none", "pointer-events-auto"] },
      { label: "resize", classes: ["resize-none", "resize", "resize-x", "resize-y"], needs: "scroll-container" },
      { label: "scroll", classes: ["scroll-smooth", "scroll-auto", "snap-x", "snap-y", "snap-center", "snap-start"] },
      { label: "appearance", classes: ["appearance-none", "appearance-auto"] },
      { label: "will-change", classes: ["will-change-auto", "will-change-scroll", "will-change-contents", "will-change-transform"] },
      { label: "touch-action", classes: ["touch-auto", "touch-none", "touch-pan-x", "touch-pan-y", "touch-manipulation"] },
    ],
  },
];
