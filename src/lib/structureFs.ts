import fs from "node:fs/promises";
import ts from "typescript";
import { escapeJsxText, findEditRoot, pageFileForPath } from "./elementFs";
import { EditorError } from "@/i18n/editor";

// one node of the desired structure the client sends; sid = the element's index in
// the ORIGINAL document order (assigned before any edit), null = a newly added element.
// text: true marks where a run of text sits among the children; an existing element's
// text stays as written in the file (the client can't know what {expression} rendered
// it), an added element's text is `value`. an added element without html is written
// from its tag / className / children
export type SNode = {
  sid: number | null;
  children: SNode[];
  html?: string;
  text?: true;
  value?: string;
  tag?: string;
  className?: string;
};
export type NewImport = { name: string; from: string };

// add any missing named imports to the top of the file (for inserted components)
function ensureImports(src: string, imports: NewImport[]): string {
  let out = src;
  for (const imp of imports) {
    const esc = imp.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const has = new RegExp(
      `import\\s*\\{[^}]*\\b${imp.name}\\b[^}]*\\}\\s*from\\s*["']${esc}["']`
    ).test(out);
    if (has) continue;
    const line = `import { ${imp.name} } from "${imp.from}";`;
    const importMatches = [...out.matchAll(/^import\b.*$/gm)];
    if (importMatches.length) {
      const last = importMatches[importMatches.length - 1];
      const idx = (last.index ?? 0) + last[0].length;
      out = out.slice(0, idx) + "\n" + line + out.slice(idx);
    } else {
      const dir = out.match(/^\s*["']use (client|server)["'];?\s*\n/);
      const idx = dir ? (dir.index ?? 0) + dir[0].length : 0;
      out = out.slice(0, idx) + line + "\n" + out.slice(idx);
    }
  }
  return out;
}

// names referenced anywhere in the file except inside import declarations
function usedNames(sf: ts.SourceFile): Set<string> {
  const used = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n)) return;
    if (ts.isIdentifier(n)) used.add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return used;
}

const parse = (text: string) =>
  ts.createSourceFile("f.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// drop the import bindings an edit left unused (e.g. Button after deleting the last
// <Button>). only bindings that WERE used before the edit go — imports that were
// already unused, and side-effect imports, are left as they are
function pruneImports(before: string, after: string): string {
  const usedBefore = usedNames(parse(before));
  const sf = parse(after);
  const usedAfter = usedNames(sf);
  const gone = (name: string) => usedBefore.has(name) && !usedAfter.has(name);

  const edits: { from: number; to: number; text: string }[] = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const clause = st.importClause;
    const def = clause.name && !gone(clause.name.text) ? clause.name.text : null;
    const nb = clause.namedBindings;
    let named: string | null = null;
    if (nb && ts.isNamespaceImport(nb)) named = gone(nb.name.text) ? null : `* as ${nb.name.text}`;
    else if (nb) {
      const keep = nb.elements.filter((e) => !gone(e.name.text)).map((e) => e.getText(sf));
      named = keep.length ? `{ ${keep.join(", ")} }` : null;
    }
    const removedAny =
      (clause.name && !def) ||
      (nb && ts.isNamespaceImport(nb) && !named) ||
      (nb && ts.isNamedImports(nb) && nb.elements.some((e) => gone(e.name.text)));
    if (!removedAny) continue;
    if (!def && !named) {
      // the whole declaration and its line break (comments above it stay)
      const end = after[st.getEnd()] === "\n" ? st.getEnd() + 1 : st.getEnd();
      edits.push({ from: st.getStart(sf), to: end, text: "" });
      continue;
    }
    const typeKw = clause.isTypeOnly ? "type " : "";
    const bindings = [def, named].filter(Boolean).join(", ");
    edits.push({
      from: st.getStart(sf),
      to: st.getEnd(),
      text: `import ${typeKw}${bindings} from ${st.moduleSpecifier.getText(sf)};`,
    });
  }
  let out = after;
  for (const e of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

// open + children + close. text alone stays inline; mixed with elements, every child
// goes on its own line. a line break eats JSX whitespace, so a real space between text
// and an element (one with no line break in it) is kept as {" "}
function joinChildren(open: string, parts: { text: boolean; s: string }[], close: string) {
  if (parts.every((p) => p.text)) return `${open}${parts.map((p) => p.s).join("")}${close}`;
  const lines = parts.map((p, i) => {
    if (!p.text) return p.s;
    const lead = p.s.match(/^\s*/)![0];
    const tail = p.s.match(/\s*$/)![0];
    let t = p.s.trim();
    if (i > 0 && lead && !lead.includes("\n")) t = `{" "}${t}`;
    if (i < parts.length - 1 && tail && !tail.includes("\n")) t = `${t}{" "}`;
    return t;
  });
  return `${open}\n${lines.join("\n")}\n${close}`;
}

const TAG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function isJsxEl(n: ts.Node): n is ts.JsxElement | ts.JsxSelfClosingElement {
  return ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n);
}

function childElements(n: ts.JsxElement | ts.JsxSelfClosingElement) {
  if (ts.isJsxSelfClosingElement(n)) return [];
  return n.children.filter(isJsxEl);
}

export async function writeStructure(
  urlPath: string,
  children: SNode[],
  imports: NewImport[] = [],
  kind = "page"
): Promise<{ file: string; changed: boolean }> {
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

  const root = findEditRoot(sf, kind);

  // number JSX elements in source pre-order — must match the client's data-sid pass
  const nodes: (ts.JsxElement | ts.JsxSelfClosingElement)[] = [];
  const sidOf = new Map<ts.Node, number>();
  const walk = (kids: readonly ts.JsxChild[]) => {
    for (const ch of kids) {
      if (isJsxEl(ch)) {
        sidOf.set(ch, nodes.length);
        nodes.push(ch);
        if (ts.isJsxElement(ch)) walk(ch.children);
      }
    }
  };
  walk(root.kids);

  const textOf = (n: ts.Node) => src.slice(n.getStart(sf), n.getEnd());

  // a subtree is unchanged iff it keeps its sid, same child element count & order,
  // and every child is itself unchanged (then we can reuse the original source text)
  const elementKids = (node: SNode) => node.children.filter((c) => !c.text);
  const unchanged = (node: SNode): boolean => {
    if (node.sid == null || node.sid >= nodes.length) return false;
    const srcKids = childElements(nodes[node.sid]);
    const kids = elementKids(node);
    if (srcKids.length !== kids.length) return false;
    return kids.every((c, i) => c.sid === sidOf.get(srcKids[i]) && unchanged(c));
  };

  // the element's text / {expressions}, grouped into the runs that sit between child
  // elements — the same grouping the client's text markers use
  const textRuns = (n: ts.JsxElement) => {
    const runs: string[] = [];
    let cur: string | null = null;
    for (const ch of n.children) {
      if (isJsxEl(ch)) {
        if (cur != null) runs.push(cur);
        cur = null;
      } else if (!(ts.isJsxText(ch) && !ch.text.trim())) {
        cur = (cur ?? "") + textOf(ch);
      }
    }
    if (cur != null) runs.push(cur);
    return runs;
  };

  const emit = (node: SNode): string => {
    if (node.sid == null) {
      if (node.html) return node.html;
      const tag = node.tag ?? "div";
      if (!TAG_RE.test(tag)) throw new EditorError("badTag");
      const cls = node.className?.trim().split('"').join("");
      const open = `<${tag}${cls ? ` className="${cls}"` : ""}`;
      if (node.children.length === 0) return `${open} />`;
      const parts = node.children.map((c) =>
        c.text ? { text: true, s: escapeJsxText(c.value ?? "") } : { text: false, s: emit(c) }
      );
      return joinChildren(`${open}>`, parts, `</${tag}>`);
    }
    if (node.sid < 0 || node.sid >= nodes.length)
      throw new EditorError("badSid");
    const srcNode = nodes[node.sid];
    if (unchanged(node)) return textOf(srcNode);
    if (ts.isJsxSelfClosingElement(srcNode)) {
      if (node.children.length === 0) return textOf(srcNode);
      throw new EditorError("voidChildren");
    }
    const open = textOf(srcNode.openingElement);
    const close = textOf(srcNode.closingElement);
    if (elementKids(node).length === 0) {
      // never had child elements (text only) → keep it as is; had some but all were
      // removed → drop them, keeping any text / {expressions} that sat beside them
      if (childElements(srcNode).length === 0) return textOf(srcNode);
      const rest = srcNode.children
        .filter((ch) => !isJsxEl(ch) && !(ts.isJsxText(ch) && !ch.text.trim()))
        .map(textOf)
        .join("");
      return `${open}${rest}${close}`;
    }
    // keep each text run where the client says it now sits; text glued to an element
    // stays glued (a line break there would eat a meaningful space in JSX)
    const runs = textRuns(srcNode);
    const markers = node.children.filter((c) => c.text).length;
    if (markers !== runs.length) throw new EditorError("textRunsChanged");
    let ri = 0;
    const parts = node.children.map((c) =>
      c.text ? { text: true, s: runs[ri++] } : { text: false, s: emit(c) }
    );
    return joinChildren(open, parts, close);
  };

  // text sitting directly in the edit root isn't kept by the structure save
  const top = children.filter((c) => !c.text);
  if (!root.inner && top.length !== 1)
    throw new EditorError("singleRoot", { kind });
  const body = top.map(emit).join("\n");
  const newInner = root.inner ? "\n" + body + "\n" : body;
  const { from, to } = root;
  const oldInner = src.slice(from, to);
  if (newInner === oldInner) return { file, changed: false };

  const next = pruneImports(src, ensureImports(src.slice(0, from) + newInner + src.slice(to), imports));
  await fs.writeFile(file, formatSource(file, next), "utf8");
  return { file, changed: true };
}

// format with the TypeScript language service (no extra deps) so the rewritten
// JSX gets consistent indentation/spacing
function formatSource(fileName: string, source: string): string {
  try {
    const files: Record<string, string> = { [fileName]: source };
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [fileName],
      getScriptVersion: () => "1",
      getScriptSnapshot: (f) =>
        files[f] !== undefined ? ts.ScriptSnapshot.fromString(files[f]) : undefined,
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => ({ jsx: ts.JsxEmit.Preserve }),
      getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
      readFile: (f) => files[f],
      fileExists: (f) => files[f] !== undefined,
    };
    const ls = ts.createLanguageService(host);
    const opts: ts.FormatCodeSettings = {
      tabSize: 2,
      indentSize: 2,
      convertTabsToSpaces: true,
      newLineCharacter: "\n",
      indentStyle: ts.IndentStyle.Smart,
      insertSpaceAfterCommaDelimiter: true,
      insertSpaceAfterSemicolonInForStatements: true,
      insertSpaceBeforeAndAfterBinaryOperators: true,
      insertSpaceAfterKeywordsInControlFlowStatements: true,
    };
    const edits = ls.getFormattingEditsForDocument(fileName, opts);
    let out = source;
    for (const e of edits.sort((a, b) => b.span.start - a.span.start)) {
      out =
        out.slice(0, e.span.start) +
        e.newText +
        out.slice(e.span.start + e.span.length);
    }
    return out;
  } catch {
    return source; // never block the save on a formatting hiccup
  }
}
