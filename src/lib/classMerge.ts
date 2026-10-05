import { extendTailwindMerge } from "tailwind-merge";

// Tailwind's default min-width breakpoints (globals.css doesn't override them)
export const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };

// the type scale's @utility text-display-lg … text-label-sm sizes text; without this
// tailwind-merge reads them as text colors and drops them when a color is picked.
// bg-gradient-to-* (v3 name, still emitted by v4) isn't known to tailwind-merge v3 —
// it falls into bg-color, so picking a bg color would wipe the gradient direction
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [(v: string) => /^(display|headline|title|body|label)-(lg|md|sm)$/.test(v)] }],
      "bg-image": [{ "bg-gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"] }],
    },
  },
});

const variantsOf = (t: string) => t.match(/^(?:[\w-]+:)+/)?.[0].slice(0, -1).split(":") ?? [];
const utilityOf = (t: string) => t.slice(t.match(/^(?:[\w-]+:)+/)?.[0].length ?? 0);

// appends `add` and drops only the existing classes it overrides (p-4 replaces p-1 and
// px-2, keeps md:p-6); conflicts already in `current` are left as the source has them
export function addClasses(current: string[], add: string[]): string[] {
  const added = merge(add.join(" ")).split(" ").filter(Boolean);
  const keep = current.filter(
    (t) => !added.includes(t) && merge(`${t} ${added.join(" ")}`).split(" ").includes(t)
  );
  return [...keep, ...added];
}

// breakpoint variants follow the window — keep only those that match at `width`
export const classesAtWidth = (cls: string, width: number) =>
  cls
    .split(/\s+/)
    .filter((t) => variantsOf(t).every((v) => !(v in BREAKPOINTS) || BREAKPOINTS[v] <= width))
    .join(" ");

// utilities in effect for the variant context `prefix` (e.g. "dark:md:") that come
// from a broader variant — base / smaller breakpoint / non-dark — and aren't overridden
export function inheritedClasses(tokens: string[], prefix: string): Set<string> {
  const ctx = variantsOf(prefix);
  const bp = Math.max(0, ...ctx.map((v) => BREAKPOINTS[v] ?? 0));
  const rank = (t: string) =>
    variantsOf(t).reduce((n, v) => n + (v === "dark" ? 10000 : BREAKPOINTS[v] ?? 0), 0);
  const applying = tokens
    .filter((t) => variantsOf(t).every((v) => (v === "dark" ? ctx.includes("dark") : v in BREAKPOINTS && BREAKPOINTS[v] <= bp)))
    .sort((a, b) => rank(a) - rank(b));
  const own = new Set(tokens.filter((t) => t.startsWith(prefix) && variantsOf(t).length === ctx.length));
  const effective = merge(applying.map(utilityOf).join(" ")).split(" ").filter(Boolean);
  return new Set(prefix ? effective.filter((u) => !own.has(prefix + u)) : []);
}
