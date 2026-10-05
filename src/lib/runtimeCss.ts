import fs from "node:fs/promises";
import path from "node:path";
import { __unstable__loadDesignSystem, compile } from "@tailwindcss/node";

const GLOBALS = path.join(process.cwd(), "src/app/globals.css");
const CACHE_DIR = path.join(process.cwd(), "node_modules/.cache/next-flow-ui");

let cached: { mtime: number; compiler: Awaited<ReturnType<typeof compile>> } | null = null;
let cachedList: { mtime: number; classes: string[] } | null = null;

// compiles just the utilities for `classes` against globals.css's theme/variants/@utility.
// @reference would also emit globals.css's @source inline safelist (~300KB), so a copy
// without the @source lines is referenced; it lives under node_modules so the copy's
// `@import "tailwindcss"` still resolves
async function compiler() {
  const { mtimeMs } = await fs.stat(GLOBALS);
  if (cached?.mtime === mtimeMs) return cached.compiler;
  const css = (await fs.readFile(GLOBALS, "utf8")).replace(/^@source .*$/gm, "");
  const ref = path.join(CACHE_DIR, "tw-reference.css");
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(ref, css);
  const c = await compile(
    `@reference ${JSON.stringify(ref)};\n@layer utilities {\n@tailwind utilities;\n}`,
    { base: CACHE_DIR, onDependency() {} }
  );
  cached = { mtime: mtimeMs, compiler: c };
  return c;
}

export async function buildUtilitiesCss(classes: string[]) {
  return (await compiler()).build(classes);
}

// every utility Tailwind can generate with this theme (incl. globals.css's own colors
// and @utility classes), for search / autocomplete beyond the curated picker list
export async function tailwindClassList() {
  const { mtimeMs } = await fs.stat(GLOBALS);
  if (cachedList?.mtime === mtimeMs) return cachedList.classes;
  const ds = await __unstable__loadDesignSystem(await fs.readFile(GLOBALS, "utf8"), {
    base: path.dirname(GLOBALS),
  });
  const classes = ds.getClassList().map(([name]) => name);
  cachedList = { mtime: mtimeMs, classes };
  return classes;
}
