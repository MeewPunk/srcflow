import fs from "node:fs/promises";
import path from "node:path";
import { EditorError } from "@/i18n/editor";

const LAYOUT_TSX = path.join(process.cwd(), "src", "app", "[lang]", "layout.tsx");
const START = "// @layout-manager:start";
const END = "// @layout-manager:end";

export type LayoutState = {
  htmlClass: string;
  bodyClass: string;
  htmlStyle: Record<string, string>;
  bodyStyle: Record<string, string>;
};

function region(src: string) {
  const s = src.indexOf(START);
  const e = src.indexOf(END);
  if (s === -1 || e === -1 || e < s) {
    throw new EditorError("layoutMarker");
  }
  return { start: s + START.length, end: e };
}

function parseConst(block: string, name: string): string {
  const m = block.match(new RegExp(`const ${name}\\s*(?::[^=]+)?=\\s*([^\\n]*?);`));
  if (!m) throw new EditorError("layoutConst", { name });
  return m[1].trim();
}

function assertClass(v: string, label: string) {
  if (/[\n\r`]/.test(v)) {
    throw new EditorError("layoutBadChars", { label });
  }
}

const STYLE_KEY_RE = /^(--[a-zA-Z][\w-]*|[a-zA-Z][a-zA-Z]*)$/;

function cleanStyle(
  style: Record<string, string>,
  label: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(style ?? {})) {
    const key = rawKey.trim();
    const val = String(rawVal).trim();
    if (!key || !val) continue;
    if (!STYLE_KEY_RE.test(key)) {
      throw new EditorError("layoutBadProp", { label, key });
    }
    if (/[\n\r;`]/.test(val)) {
      throw new EditorError("layoutBadValue", { label, key });
    }
    out[key] = val;
  }
  return out;
}

export async function readLayout(): Promise<LayoutState> {
  const src = await fs.readFile(LAYOUT_TSX, "utf8");
  const { start, end } = region(src);
  const block = src.slice(start, end);
  return {
    htmlClass: JSON.parse(parseConst(block, "HTML_CLASS")),
    bodyClass: JSON.parse(parseConst(block, "BODY_CLASS")),
    htmlStyle: JSON.parse(parseConst(block, "HTML_STYLE")),
    bodyStyle: JSON.parse(parseConst(block, "BODY_STYLE")),
  };
}

export async function writeLayout(patch: LayoutState): Promise<LayoutState> {
  const htmlClass = patch.htmlClass.trim();
  const bodyClass = patch.bodyClass.trim();
  assertClass(htmlClass, "html class");
  assertClass(bodyClass, "body class");
  const htmlStyle = cleanStyle(patch.htmlStyle, "html style");
  const bodyStyle = cleanStyle(patch.bodyStyle, "body style");

  const src = await fs.readFile(LAYOUT_TSX, "utf8");
  const { start, end } = region(src);
  const block =
    "\n" +
    `const HTML_CLASS = ${JSON.stringify(htmlClass)};\n` +
    `const BODY_CLASS = ${JSON.stringify(bodyClass)};\n` +
    `const HTML_STYLE: Record<string, string> = ${JSON.stringify(htmlStyle)};\n` +
    `const BODY_STYLE: Record<string, string> = ${JSON.stringify(bodyStyle)};\n`;

  await fs.writeFile(LAYOUT_TSX, src.slice(0, start) + block + src.slice(end), "utf8");
  return { htmlClass, bodyClass, htmlStyle, bodyStyle };
}
