import fs from "node:fs/promises";
import path from "node:path";
import {
  SPECIAL_FILE_MAP,
  validateRoutePath,
  type SpecialFileId,
} from "./nextFileConventions";
import { EditorError } from "@/i18n/editor";

// the main app's routes live under the [lang] segment (Next.js i18n); route paths and
// URLs the editor works with are locale-free ("abc" ↔ /en/abc, /th/abc)
export const APP_DIR = path.join(process.cwd(), "src", "app", "[lang]");

export function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new EditorError("devOnly");
  }
}

const META_START = "// @route-manager:meta-start";
const META_END = "// @route-manager:meta-end";

export function parsePath(input: string): string[] {
  const err = validateRoutePath(input);
  if (err) throw err;
  return String(input)
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((s) => s.trim());
}

export function dirForSegments(segments: string[]): string {
  const dir = path.join(APP_DIR, ...segments);
  const rel = path.relative(APP_DIR, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new EditorError("outsideApp");
  }
  return dir;
}

export function urlForSegments(segments: string[]): string {
  const parts = segments.filter((s) => !/^\(.*\)$/.test(s));
  return "/" + parts.join("/");
}

const PAGE_RE = /^page\.(tsx|jsx|ts|js)$/;
const ROUTE_RE = /^route\.(ts|js)$/;
const SPECIAL_BASENAMES: Record<string, SpecialFileId> = {
  layout: "layout",
  template: "template",
  loading: "loading",
  error: "error",
  "not-found": "not-found",
  default: "default",
  route: "route",
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export type MetaFields = {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
};

export type RouteInfo = {
  segments: string[];
  routePath: string;
  url: string;
  hasPage: boolean;
  hasRoute: boolean;
  specialFiles: SpecialFileId[];
  meta: MetaFields;
};

function extractMeta(src: string): MetaFields {
  const meta: MetaFields = {};
  const grab = (key: string) => {
    const m = src.match(new RegExp(`${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
    return m ? m[1].replace(/\\"/g, '"') : undefined;
  };
  meta.title = grab("title");
  meta.description = grab("description");
  const kw = src.match(/keywords:\s*\[([^\]]*)\]/);
  if (kw) {
    meta.keywords = kw[1]
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return meta;
}

async function readMetaFromDir(dir: string): Promise<MetaFields> {
  for (const ext of ["tsx", "jsx", "ts", "js"]) {
    const p = path.join(dir, `page.${ext}`);
    if (await exists(p)) {
      try {
        return extractMeta(await fs.readFile(p, "utf8"));
      } catch {
        return {};
      }
    }
  }
  return {};
}

export async function scanRoutes(): Promise<RouteInfo[]> {
  const out: RouteInfo[] = [];

  async function walk(dir: string, segments: string[]) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    const hasPage = files.some((f) => PAGE_RE.test(f));
    const hasRoute = files.some((f) => ROUTE_RE.test(f));
    const specialFiles: SpecialFileId[] = [];
    for (const f of files) {
      const base = f.replace(/\.(tsx|jsx|ts|js)$/, "");
      const id = SPECIAL_BASENAMES[base];
      if (id) specialFiles.push(id);
    }

    if ((hasPage || hasRoute) && segments.length >= 0) {
      out.push({
        segments,
        routePath: segments.join("/"),
        url: urlForSegments(segments),
        hasPage,
        hasRoute,
        specialFiles,
        meta: hasPage ? await readMetaFromDir(dir) : {},
      });
    }

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith("_") || e.name.startsWith("%5F") || e.name === "node_modules")
        continue;
      if (segments.length === 0 && e.name === "api") continue;
      await walk(path.join(dir, e.name), [...segments, e.name]);
    }
  }

  await walk(APP_DIR, []);
  out.sort((a, b) => {
    const n = Math.min(a.segments.length, b.segments.length);
    for (let i = 0; i < n; i++) {
      const c = a.segments[i].localeCompare(b.segments[i]);
      if (c !== 0) return c;
    }
    return a.segments.length - b.segments.length;
  });
  return out;
}

function buildMetaBlock(meta: MetaFields): string {
  const lines: string[] = [];
  if (meta.title) lines.push(`  title: ${JSON.stringify(meta.title)},`);
  if (meta.description)
    lines.push(`  description: ${JSON.stringify(meta.description)},`);
  if (meta.keywords && meta.keywords.length)
    lines.push(`  keywords: ${JSON.stringify(meta.keywords)},`);
  if (meta.ogTitle || meta.ogDescription) {
    const og: string[] = [];
    if (meta.ogTitle) og.push(`    title: ${JSON.stringify(meta.ogTitle)},`);
    if (meta.ogDescription)
      og.push(`    description: ${JSON.stringify(meta.ogDescription)},`);
    lines.push(`  openGraph: {\n${og.join("\n")}\n  },`);
  }
  if (lines.length === 0) return "";
  return `${META_START}\nimport type { Metadata } from "next";\n\nexport const metadata: Metadata = {\n${lines.join(
    "\n"
  )}\n};\n${META_END}\n\n`;
}

type Param = { name: string; array: boolean };

function dynamicParams(segments: string[]): Param[] {
  const out: Param[] = [];
  for (const seg of segments) {
    let m = seg.match(/^\[\[\.\.\.([a-zA-Z][a-zA-Z0-9]*)\]\]$/);
    if (m) { out.push({ name: m[1], array: true }); continue; }
    m = seg.match(/^\[\.\.\.([a-zA-Z][a-zA-Z0-9]*)\]$/);
    if (m) { out.push({ name: m[1], array: true }); continue; }
    m = seg.match(/^\[([a-zA-Z][a-zA-Z0-9]*)\]$/);
    if (m) out.push({ name: m[1], array: false });
  }
  return out;
}

function pageTemplate(segments: string[], meta: MetaFields): string {
  const url = urlForSegments(segments);
  const metaBlock = buildMetaBlock(meta);
  const params = dynamicParams(segments);

  if (params.length > 0) {
    const typeFields = params
      .map((p) => `${p.name}: ${p.array ? "string[]" : "string"}`)
      .join("; ");
    const destructure = params.map((p) => p.name).join(", ");
    const rows = params
      .map(
        (p) =>
          `        <li>${p.name}: {${
            p.array ? `${p.name}.join("/")` : p.name
          }}</li>`
      )
      .join("\n");
    return `${metaBlock}export default async function Page({
  params,
}: {
  params: Promise<{ ${typeFields} }>;
}) {
  const { ${destructure} } = await params;
  return (
    <main>
      <h1>${url}</h1>
      <ul>
${rows}
      </ul>
    </main>
  );
}
`;
  }

  return `${metaBlock}export default function Page() {
  return (
    <main>
      <h1>${url}</h1>
      <p>Created with the Route Manager</p>
    </main>
  );
}
`;
}

export async function createRoute(input: string, meta: MetaFields) {
  const segments = parsePath(input);
  const dir = dirForSegments(segments);
  if (await exists(dir)) throw new EditorError("pathExists", { input });
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, "page.tsx"),
    pageTemplate(segments, meta),
    "utf8"
  );
  return { segments, url: urlForSegments(segments) };
}

export async function updateMeta(input: string, meta: MetaFields) {
  const segments = parsePath(input);
  const dir = dirForSegments(segments);
  let pagePath = "";
  for (const ext of ["tsx", "jsx", "ts", "js"]) {
    const p = path.join(dir, `page.${ext}`);
    if (await exists(p)) {
      pagePath = p;
      break;
    }
  }
  if (!pagePath) throw new EditorError("noPage", { input });

  let src = await fs.readFile(pagePath, "utf8");
  const block = buildMetaBlock(meta);
  const re = new RegExp(
    `${META_START}[\\s\\S]*?${META_END}\\n?\\n?`,
    "m"
  );
  if (re.test(src)) {
    src = src.replace(re, block);
  } else {
    src = block + src;
  }
  await fs.writeFile(pagePath, src, "utf8");
  return { url: urlForSegments(segments) };
}

export async function renameRoute(oldInput: string, newInput: string) {
  const oldSegs = parsePath(oldInput);
  const newSegs = parsePath(newInput);
  const oldDir = dirForSegments(oldSegs);
  const newDir = dirForSegments(newSegs);
  if (!(await exists(oldDir))) throw new EditorError("pathNotFound", { input: oldInput });
  if (await exists(newDir)) throw new EditorError("pathExists", { input: newInput });
  await fs.mkdir(path.dirname(newDir), { recursive: true });
  await fs.rename(oldDir, newDir);
  return { url: urlForSegments(newSegs) };
}

function copySegment(seg: string, n?: number): string {
  const suf = n ? `copy${n}` : "copy";
  if (/^[a-z0-9][a-z0-9-_]*$/.test(seg)) return `${seg}-${suf}`;
  let m = seg.match(/^\[\[\.\.\.([a-zA-Z0-9]+)\]\]$/);
  if (m) return `[[...${m[1]}${suf}]]`;
  m = seg.match(/^\[\.\.\.([a-zA-Z0-9]+)\]$/);
  if (m) return `[...${m[1]}${suf}]`;
  m = seg.match(/^\[([a-zA-Z0-9]+)\]$/);
  if (m) return `[${m[1]}${suf}]`;
  m = seg.match(/^\(([a-zA-Z0-9-_]+)\)$/);
  if (m) return `(${m[1]}-${suf})`;
  m = seg.match(/^@([a-zA-Z0-9]+)$/);
  if (m) return `@${m[1]}${suf}`;
  return `${seg}-${suf}`;
}

export async function duplicateRoute(input: string) {
  const segments = parsePath(input);
  if (segments.length === 0) throw new EditorError("cantCopyRoot");
  const srcDir = dirForSegments(segments);
  if (!(await exists(srcDir))) throw new EditorError("pathNotFound", { input });

  const parent = segments.slice(0, -1);
  const last = segments[segments.length - 1];
  let newSeg = copySegment(last);
  let n = 2;
  while (await exists(dirForSegments([...parent, newSeg]))) {
    newSeg = copySegment(last, n++);
  }
  const newSegments = [...parent, newSeg];
  await fs.cp(srcDir, dirForSegments(newSegments), { recursive: true });
  return {
    url: urlForSegments(newSegments),
    path: newSegments.join("/"),
  };
}

export async function deleteRoute(input: string) {
  const segments = parsePath(input);
  if (segments.length === 0) throw new EditorError("cantDeleteRoot");
  if (segments[0] === "api") throw new EditorError("cantDeleteApi");
  const dir = dirForSegments(segments);
  if (!(await exists(dir))) throw new EditorError("pathNotFound", { input });
  await fs.rm(dir, { recursive: true, force: true });
  return { ok: true };
}

export async function createSpecialFile(input: string, kind: SpecialFileId) {
  const def = SPECIAL_FILE_MAP[kind];
  if (!def) throw new EditorError("unsupportedKind", { kind });
  const segments = parsePath(input);
  const dir = dirForSegments(segments);
  if (!(await exists(dir))) throw new EditorError("pathNotFound", { input });

  const files = await fs.readdir(dir);
  if (kind === "route" && files.some((f) => PAGE_RE.test(f))) {
    throw new EditorError("pageAndRoute");
  }
  const target = path.join(dir, def.filename);
  if (await exists(target)) throw new EditorError("fileExists", { file: def.filename });
  await fs.writeFile(target, def.example, "utf8");
  return { ok: true };
}

export async function deleteSpecialFile(input: string, kind: SpecialFileId) {
  const def = SPECIAL_FILE_MAP[kind];
  if (!def) throw new EditorError("unsupportedKind", { kind });
  const segments = parsePath(input);
  const dir = dirForSegments(segments);
  const target = path.join(dir, def.filename);
  if (!(await exists(target))) throw new EditorError("fileNotFound", { file: def.filename });
  await fs.rm(target, { force: true });
  return { ok: true };
}
