"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Tooltip } from "@/components/editor/Tooltip";
import { useEditorT } from "@/i18n/editor/useEditorT";
import { hasLocale, localeOf, locales, stripLocale, withLocale } from "@/i18n/config";
import { BREAKPOINTS } from "@/lib/classMerge";
import { PREVIEW_PATH, SPECIAL_FILE_MAP, type SpecialFileId } from "@/lib/nextFileConventions";
import type { EditorDict } from "@/i18n/editor";
import styles from "./PageInfo.module.css";

type RouteInfo = {
  url: string;
  routePath: string;
  hasPage: boolean;
  specialFiles: SpecialFileId[];
  meta: { title?: string; description?: string };
};
type Issue = { text: string; el: HTMLElement | null };

// the query only changes with navigation, which re-renders this via usePathname
const subscribeNone = () => () => {};

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

// permitted parents per the HTML content models (MDN "Permitted parents")
const PARENTS: Record<string, string[]> = {
  LI: ["UL", "OL", "MENU"],
  TR: ["TABLE", "THEAD", "TBODY", "TFOOT"],
  TD: ["TR"],
  TH: ["TR"],
  THEAD: ["TABLE"],
  TBODY: ["TABLE"],
  TFOOT: ["TABLE"],
  CAPTION: ["TABLE"],
  FIGCAPTION: ["FIGURE"],
  OPTION: ["SELECT", "DATALIST", "OPTGROUP"],
  OPTGROUP: ["SELECT"],
  DT: ["DL", "DIV"],
  DD: ["DL", "DIV"],
};
const INTERACTIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
// flow (block) content that <p> can't hold — the parser would close the <p> before it
const BLOCK_IN_P = new Set([
  "DIV", "P", "UL", "OL", "DL", "TABLE", "H1", "H2", "H3", "H4", "H5", "H6", "SECTION",
  "ARTICLE", "ASIDE", "NAV", "HEADER", "FOOTER", "MAIN", "FIGURE", "FORM", "BLOCKQUOTE", "PRE", "HR",
]);
// element → ancestors it must not have
const NOT_INSIDE: Record<string, string[]> = {
  MAIN: ["HEADER", "FOOTER", "ARTICLE", "ASIDE", "NAV"],
  HEADER: ["HEADER", "FOOTER"],
  FOOTER: ["HEADER", "FOOTER"],
  LABEL: ["LABEL"],
};
const tagOf = (el: Element) => el.tagName.toLowerCase();
const tagList = (tags: string[]) => tags.map((t) => `<${t.toLowerCase()}>`).join(", ");

function semanticIssues(els: HTMLElement[], tx: EditorDict["pageInfo"]): Issue[] {
  const issues: Issue[] = [];
  const mains = els.filter((el) => el.tagName === "MAIN");
  if (mains.length > 1) issues.push({ text: tx.mainCount(mains.length), el: mains[1] });
  for (const el of els) {
    const parent = el.parentElement;
    const allowed = PARENTS[el.tagName];
    // <dt>/<dd> may sit in a <div> only when that div is itself a child of <dl>
    const wrapperOk = parent?.tagName === "DIV" && (el.tagName === "DT" || el.tagName === "DD")
      ? parent.parentElement?.tagName === "DL"
      : true;
    if (allowed && parent && (!allowed.includes(parent.tagName) || !wrapperOk))
      issues.push({ text: tx.badParent(tagOf(el), tagList(allowed)), el });
    if ((el.tagName === "UL" || el.tagName === "OL") && parent) {
      const stray = Array.from(el.children).find((c) => !["LI", "SCRIPT", "TEMPLATE"].includes(c.tagName));
      if (stray) issues.push({ text: tx.badChild(tagOf(el), tagOf(stray)), el: stray as HTMLElement });
    }
    if (INTERACTIVE.has(el.tagName)) {
      const outer = parent?.closest("a, button");
      if (outer) issues.push({ text: tx.nestedInteractive(tagOf(el), tagOf(outer)), el });
    }
    if (el.tagName === "P") {
      const block = Array.from(el.querySelectorAll("*")).find((c) => BLOCK_IN_P.has(c.tagName));
      if (block) issues.push({ text: tx.blockInP(tagOf(block)), el });
    }
    const banned = NOT_INSIDE[el.tagName];
    const bad = banned && parent?.closest(banned.join(","));
    if (bad) issues.push({ text: tx.badNest(tagOf(el), tagOf(bad)), el });
  }
  return issues;
}

// quick a11y / i18n checks on the rendered page (the editor's own UI is skipped)
function checkPage(tx: EditorDict["pageInfo"]): Issue[] {
  const root = document.querySelector("[data-page-content]");
  if (!root) return [];
  const els = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    (el) => !el.closest("[data-inspector-ui], [data-preview-children]")
  );
  const issues: Issue[] = [];

  for (const el of els) if (el.tagName === "IMG" && !el.hasAttribute("alt")) issues.push({ text: tx.noAlt, el });

  const headings = els.filter((el) => /^H[1-6]$/.test(el.tagName));
  const h1s = headings.filter((el) => el.tagName === "H1");
  if (h1s.length !== 1) issues.push({ text: tx.h1Count(h1s.length), el: h1s[1] ?? null });
  let prev = 0;
  for (const h of headings) {
    const level = Number(h.tagName[1]);
    if (prev && level > prev + 1) issues.push({ text: tx.headingSkip(prev, level), el: h });
    prev = level;
  }

  for (const el of els) {
    if (el.tagName !== "A" && el.tagName !== "BUTTON") continue;
    const named = el.textContent?.trim() || el.getAttribute("aria-label") || el.getAttribute("title");
    if (!named) issues.push({ text: tx.noText(el.tagName.toLowerCase()), el });
    const href = el.getAttribute("href");
    if (el.tagName === "A" && href?.startsWith("/") && !href.startsWith("//")) {
      const first = href.split(/[/?#]/)[1] ?? "";
      if (!hasLocale(first) && first !== "api" && first !== "_next") issues.push({ text: tx.noLocale(href), el });
    }
  }
  return [...issues, ...semanticIssues(els, tx)];
}

export function PageInfo({ open, onPick }: { open: boolean; onPick: (el: HTMLElement) => void }) {
  const rawPathname = usePathname();
  const router = useRouter();
  const tx = useEditorT();
  const t = tx.pageInfo;
  const path = stripLocale(rawPathname);
  const locale = localeOf(rawPathname);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const width = useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 0);
  const bp = Object.keys(BREAKPOINTS).findLast((k) => BREAKPOINTS[k] <= width);

  useEffect(() => {
    if (!open) return;
    let live = true;
    fetch("/api/routes")
      .then((r) => r.json())
      .then((d) => live && d.ok && setRoutes(d.routes))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, path]);

  // after paint, so the page has rendered the route being viewed
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setIssues(checkPage(t)));
    return () => cancelAnimationFrame(id);
  }, [open, path, t]);

  const search = useSyncExternalStore(subscribeNone, () => window.location.search, () => "");
  const preview = path === PREVIEW_PATH ? new URLSearchParams(search) : null;
  const route = routes.find((r) =>
    preview ? r.routePath === (preview.get("path") ?? "") : r.url === path
  );
  const folder = ["src", "app", "[lang]", ...(route?.routePath ? [route.routePath] : [])].join("/");
  const files = route
    ? [...(route.hasPage ? ["page.tsx"] : []), ...route.specialFiles.map((id) => SPECIAL_FILE_MAP[id].filename)]
    : [];

  const switchLocale = (l: string) =>
    router.push(withLocale(path, l as typeof locale) + (preview ? `?${preview.toString()}` : ""));

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>{t.title}</span>
      </div>

      <dl className={styles.facts}>
        <dt>{t.file}</dt>
        <dd className={styles.mono}>
          {route ? `${folder}/` : t.noRoute}
          {preview && <span className={styles.muted}> · {t.preview(preview.get("kind") ?? "")}</span>}
        </dd>
        {files.length > 0 && (
          <>
            <dt>{t.files}</dt>
            <dd className={styles.chips}>
              {files.map((f) => (
                <span key={f} className={styles.chip}>
                  {f}
                </span>
              ))}
            </dd>
          </>
        )}
        {route?.hasPage && (
          <>
            <dt>{t.metaTitle}</dt>
            <dd className={route.meta.title ? undefined : styles.muted}>{route.meta.title || t.metaEmpty}</dd>
            <dt>{t.metaDesc}</dt>
            <dd className={route.meta.description ? undefined : styles.muted}>
              {route.meta.description || t.metaEmpty}
            </dd>
          </>
        )}
        <dt>{t.language}</dt>
        <dd className={styles.seg}>
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              className={`${styles.segBtn} ${l === locale ? styles.segBtnOn : ""}`}
              onClick={() => l !== locale && switchLocale(l)}
              aria-pressed={l === locale}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </dd>
        <dt>{t.viewport}</dt>
        <dd>
          <span className={styles.mono}>{width}px</span>
          <span className={styles.seg}>
            {["base", ...Object.keys(BREAKPOINTS)].map((k) => (
              <span
                key={k}
                className={`${styles.segBtn} ${(bp ?? "base") === k ? styles.segBtnOn : ""}`}
                title={k === "base" ? undefined : `${k}: ≥ ${BREAKPOINTS[k]}px`}
              >
                {k}
              </span>
            ))}
          </span>
          <span className={styles.hint}>{t.viewportHint}</span>
        </dd>
      </dl>

      <div className={styles.head}>
        <span className={styles.title}>{t.checks}</span>
        <button type="button" className={styles.iconBtn} onClick={() => setIssues(checkPage(t))} aria-label={t.recheck}>
          <RefreshCw size={14} />
          <Tooltip side="bottom" label={t.recheck} />
        </button>
      </div>
      {issues.length === 0 ? (
        <p className={styles.ok}>
          <CheckCircle2 size={14} /> {t.allGood}
        </p>
      ) : (
        <ul className={styles.issues}>
          {issues.map((issue, i) => (
            <li key={i}>
              <button
                type="button"
                className={styles.issue}
                onClick={() => issue.el && onPick(issue.el)}
                disabled={!issue.el}
                title={issue.el ? t.pick : undefined}
              >
                <AlertTriangle size={14} className={styles.warn} />
                <span>{issue.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
