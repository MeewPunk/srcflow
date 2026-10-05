import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { APP_DIR } from "./routeFs";
import { EDITABLE_KINDS, type SpecialFileId } from "./nextFileConventions";
import { EditorError } from "@/i18n/editor";
import { hasLocale } from "@/i18n/config";

export async function pageFileForPath(
  urlPath: string,
  kind = "page"
): Promise<string | null> {
  if (kind !== "page" && !EDITABLE_KINDS.includes(kind as SpecialFileId)) return null;
  const clean = urlPath.replace(/^\/+|\/+$/g, "");
  const segments = clean === "" ? [] : clean.split("/");
  const dir = path.join(APP_DIR, ...segments);
  const rel = path.relative(APP_DIR, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  for (const ext of ["tsx", "jsx", "ts", "js"]) {
    const p = path.join(dir, `${kind}.${ext}`);
    try {
      await fs.access(p);
      return p;
    } catch {
      // try the next extension
    }
  }
  return null;
}

type JsxRoot = ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment;
export type EditRoot = {
  kids: readonly ts.JsxChild[];
  from: number;
  to: number;
  // true = from/to span the root's inner content; false = they span the one root element
  inner: boolean;
};

function returnedJsx(sf: ts.SourceFile): JsxRoot | null {
  let body: ts.Node | undefined;
  for (const st of sf.statements) {
    if (
      ts.isFunctionDeclaration(st) &&
      st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    )
      body = st.body;
    else if (
      ts.isExportAssignment(st) &&
      (ts.isArrowFunction(st.expression) || ts.isFunctionExpression(st.expression))
    )
      body = st.expression.body;
  }
  const asJsx = (n: ts.Node | undefined): JsxRoot | null => {
    while (n && ts.isParenthesizedExpression(n)) n = n.expression;
    if (!n) return null;
    return ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)
      ? n
      : null;
  };
  if (!body) return null;
  if (!ts.isBlock(body)) return asJsx(body);
  let found: JsxRoot | null = null;
  const visit = (n: ts.Node) => {
    if (found || ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n)) found = asJsx(n.expression);
    else ts.forEachChild(n, visit);
  };
  ts.forEachChild(body, visit);
  return found;
}

// a page is edited inside its <main>; special files (layout, loading…) have none, so
// the JSX their default export returns is the root — mirrored by [data-preview-root]
export function findEditRoot(sf: ts.SourceFile, kind = "page"): EditRoot {
  if (kind === "page") {
    let mainEl: ts.JsxElement | null = null;
    const findMain = (n: ts.Node) => {
      if (
        !mainEl &&
        ts.isJsxElement(n) &&
        n.openingElement.tagName.getText(sf) === "main"
      ) {
        mainEl = n;
        return;
      }
      if (!mainEl) ts.forEachChild(n, findMain);
    };
    findMain(sf);
    if (!mainEl) throw new EditorError("noMain");
    const main: ts.JsxElement = mainEl;
    return {
      kids: main.children,
      from: main.openingElement.getEnd(),
      to: main.closingElement.getStart(sf),
      inner: true,
    };
  }
  const jsx = returnedJsx(sf);
  if (!jsx) throw new EditorError("noJsx", { kind });
  if (ts.isJsxFragment(jsx)) {
    return {
      kids: jsx.children,
      from: jsx.openingFragment.getEnd(),
      to: jsx.closingFragment.getStart(sf),
      inner: true,
    };
  }
  return { kids: [jsx], from: jsx.getStart(sf), to: jsx.getEnd(), inner: false };
}

// rewrite an element's className, found by sid (the numbering text edits and the
// structure save use). the file must still hold origClass on that element — if not, the
// sid points somewhere else and nothing is written
export async function writeElementClass(
  urlPath: string,
  sid: number,
  origClass: string,
  newClass: string,
  tag = "",
  kind = "page"
): Promise<{ file: string }> {
  const file = await pageFileForPath(urlPath, kind);
  if (!file) throw new EditorError("pageFileMissing", { kind, path: urlPath });
  const src = await fs.readFile(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = elementBySid(sf, sid, tag, kind);
  const open = ts.isJsxElement(node) ? node.openingElement : node;
  const attr = open.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "className"
  );
  const orig = normClass(origClass);

  let next: string;
  if (!attr) {
    if (orig) throw new EditorError("classNotFound", { kind });
    const at = open.tagName.getEnd();
    next = src.slice(0, at) + ` className="${newClass.trim().split('"').join("")}"` + src.slice(at);
  } else {
    // only a plain "…" / '…' className can be rewritten; {expressions} are left alone
    const init = attr.initializer;
    if (!init || !ts.isStringLiteral(init) || normClass(init.text) !== orig) {
      throw new EditorError("classNotFound", { kind });
    }
    const q = src[init.getStart(sf)];
    next =
      src.slice(0, init.getStart(sf)) +
      `${q}${newClass.trim().split(q).join("")}${q}` +
      src.slice(init.getEnd());
  }
  await fs.writeFile(file, next, "utf8");
  return { file };
}

const normClass = (s: string) => s.trim().split(/\s+/).filter(Boolean).join(" ");

export function escapeJsxText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

// rewrite an element's inner text, found by its document-order index (sid) under
// <main> — the same numbering the structure save uses. only elements whose children
// are plain text can be edited; anything with nested elements or {…} is refused.
const normText = (s: string) => s.replace(/\s+/g, " ").trim();

type DictPath = (string | number)[];

// where a JSX expression's text comes from in the [lang] dictionary, e.g. `t.title` with
// `const { home: t } = await getDictionary(lang)` → ["home", "title"]; also follows
// `t.features[0].title` and `const [starter] = t.plans` → ["pricing", "plans", 0, …].
// null when the expression isn't (traceably) dictionary text
function dictPathOf(expr: ts.Expression, sf: ts.SourceFile, depth = 0): DictPath | null {
  if (depth > 8) return null;
  if (ts.isParenthesizedExpression(expr)) return dictPathOf(expr.expression, sf, depth + 1);
  if (ts.isAwaitExpression(expr)) expr = expr.expression;
  if (ts.isCallExpression(expr) && expr.expression.getText(sf) === "getDictionary") return [];
  if (ts.isPropertyAccessExpression(expr)) {
    const base = dictPathOf(expr.expression, sf, depth + 1);
    return base && [...base, expr.name.text];
  }
  if (ts.isElementAccessExpression(expr)) {
    const arg = expr.argumentExpression;
    const key = ts.isNumericLiteral(arg) ? Number(arg.text) : ts.isStringLiteral(arg) ? arg.text : null;
    const base = key == null ? null : dictPathOf(expr.expression, sf, depth + 1);
    return base && [...base, key!];
  }
  if (ts.isIdentifier(expr)) return bindingPathOf(expr.text, sf, depth + 1);
  return null;
}

// a variable bound from dictionary data: `const t = …`, `const { home: t } = …`, `const [a, b] = …`
function bindingPathOf(name: string, sf: ts.SourceFile, depth: number): DictPath | null {
  let found: DictPath | null = null;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && n.initializer) {
      const b = n.name;
      if (ts.isIdentifier(b) && b.text === name) found = dictPathOf(n.initializer, sf, depth);
      if (ts.isObjectBindingPattern(b)) {
        for (const el of b.elements) {
          if (ts.isIdentifier(el.name) && el.name.text === name) {
            const base = dictPathOf(n.initializer, sf, depth);
            const prop = el.propertyName ? el.propertyName.getText(sf) : el.name.text;
            found = base && [...base, prop];
          }
        }
      }
      if (ts.isArrayBindingPattern(b)) {
        b.elements.forEach((el, i) => {
          if (ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === name) {
            const base = dictPathOf(n.initializer!, sf, depth);
            found = base && [...base, i];
          }
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

// write text that lives in dictionaries/{lang}.json instead of the page file
async function writeDictText(lang: string, keyPath: DictPath, newText: string, origText: string) {
  if (!hasLocale(lang)) throw new EditorError("textHasChildren");
  const file = path.join(APP_DIR, "dictionaries", `${lang}.json`);
  const dict = JSON.parse(await fs.readFile(file, "utf8"));
  let holder: Record<string | number, unknown> | null = dict;
  for (const k of keyPath.slice(0, -1)) {
    const next: unknown = holder?.[k];
    holder = next && typeof next === "object" ? (next as Record<string | number, unknown>) : null;
  }
  const last = keyPath[keyPath.length - 1];
  if (!holder || typeof holder[last] !== "string") throw new EditorError("dictKeyMissing", { key: keyPath.join(".") });
  // same guard as a file edit: the value must still be what the client started from
  if (normText(holder[last] as string) !== normText(origText)) throw new EditorError("textMismatch");
  holder[last] = newText.replace(/\s+/g, " ").trim();
  await fs.writeFile(file, JSON.stringify(dict, null, 2) + "\n", "utf8");
  return { file };
}

// the element a client sid points at: document-order index of the JSX elements under
// the edit root — the same numbering the structure save uses
function elementBySid(sf: ts.SourceFile, sid: number, tag: string, kind: string) {
  const nodes: (ts.JsxElement | ts.JsxSelfClosingElement)[] = [];
  const walk = (kids: readonly ts.JsxChild[]) => {
    for (const ch of kids) {
      if (ts.isJsxElement(ch) || ts.isJsxSelfClosingElement(ch)) {
        nodes.push(ch);
        if (ts.isJsxElement(ch)) walk(ch.children);
      }
    }
  };
  walk(findEditRoot(sf, kind).kids);

  if (sid < 0 || sid >= nodes.length) {
    throw new EditorError("elementNotFound");
  }
  const node = nodes[sid];
  const nodeTag = (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText(sf);
  if (tag && nodeTag !== tag) {
    throw new EditorError("elementMismatch");
  }
  return node;
}

// an element's JSX exactly as written in its file, de-indented to its own first line
export async function readElementSource(
  urlPath: string,
  sid: number,
  tag = "",
  kind = "page"
): Promise<string> {
  const file = await pageFileForPath(urlPath, kind);
  if (!file) throw new EditorError("pageFileMissing", { kind, path: urlPath });
  const src = await fs.readFile(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = elementBySid(sf, sid, tag, kind);
  const start = node.getStart(sf);
  const indent = start - src.lastIndexOf("\n", start - 1) - 1;
  return src
    .slice(start, node.getEnd())
    .split("\n")
    .map((line, i) => (i === 0 ? line : line.replace(new RegExp(`^ {0,${indent}}`), "")))
    .join("\n");
}

export async function writeElementText(
  urlPath: string,
  sid: number,
  newText: string,
  tag = "",
  origText = "",
  kind = "page",
  lang = ""
): Promise<{ file: string }> {
  const file = await pageFileForPath(urlPath, kind);
  if (!file) throw new EditorError("pageFileMissing", { kind, path: urlPath });
  const src = await fs.readFile(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const node = elementBySid(sf, sid, tag, kind);
  if (ts.isJsxSelfClosingElement(node)) {
    throw new EditorError("noText");
  }
  // a lone {expression} that reads the [lang] dictionary → edit that dictionary entry
  const parts = node.children.filter((ch) => !(ts.isJsxText(ch) && !ch.text.trim()));
  if (parts.length === 1 && ts.isJsxExpression(parts[0]) && parts[0].expression) {
    const keyPath = dictPathOf(parts[0].expression, sf);
    if (keyPath && keyPath.length) return writeDictText(lang, keyPath, newText, origText);
  }
  for (const ch of node.children) {
    if (!ts.isJsxText(ch)) {
      throw new EditorError("textHasChildren");
    }
  }

  const from = node.openingElement.getEnd();
  const to = node.closingElement.getStart(sf);
  // the element the client edited must still hold the text it started with —
  // otherwise the sid points at a different node and we must not overwrite it
  if (normText(src.slice(from, to)) !== normText(origText)) {
    throw new EditorError("textMismatch");
  }
  const next = src.slice(0, from) + escapeJsxText(newText) + src.slice(to);
  await fs.writeFile(file, next, "utf8");
  return { file };
}
