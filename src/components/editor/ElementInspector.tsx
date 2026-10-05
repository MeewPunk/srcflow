"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { localeOf, stripLocale } from "@/i18n/config";
import type { EditorDict } from "@/i18n/editor";
import { useEditorT } from "@/i18n/editor/useEditorT";
import { reloadWithoutGuard, useUnsavedGuard } from "@/components/editor/useUnsavedGuard";
import {
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronUp,
  Component as ComponentIcon,
  ListChecks,
  LogOut,
  Maximize,
  Copy,
  Eye,
  Monitor,
  Moon,
  MousePointerSquareDashed,
  Plus,
  RotateCcw,
  Save,
  Search,
  PanelBottomClose,
  Smartphone,
  SquareDashed,
  Tablet,
  Trash2,
  X,
} from "lucide-react";
import { useDrawerControl } from "@/components/editor/DrawerLayout";
import { useConfirm, useConfirmActive } from "@/components/editor/Confirm";
import { useNotify } from "@/components/editor/Notify";
import { Tooltip } from "@/components/editor/Tooltip";
import { OverlayScroll } from "@/components/editor/OverlayScroll";
import { BREAKPOINTS, classesAtWidth } from "@/lib/classMerge";
import type { ElementContext } from "@/lib/classApplicability";
import { useSmoothPointer } from "@/lib/useSmoothPointer";
import { usePresence } from "@/lib/usePresence";
import { ClassPicker, SelectedClasses } from "@/components/editor/ClassPicker";
import { PREVIEW_PATH } from "@/lib/nextFileConventions";
import { buttonClasses } from "@/app/ui/components/base/button/button.classes";
import styles from "./ElementInspector.module.css";

const MAX_ELEMENTS = 80;
const color = (i: number) => `hsl(${Math.round((i * 137.508) % 360)} 72% 55%)`;

type Info = {
  tag: string;
  id: string;
  cls: string[];
  w: number;
  h: number;
  depth: number;
};
type Item = { el: HTMLElement; color: string; info: Info; rect: DOMRect };

// where a selected element lifts to: below the editTop bar (top 24 + ~38) + gap
const LIFT_TOP = 80;
const RUNTIME_CSS_ID = "uf-runtime-css";
// deselect: the edit panel (.editOut) and the element sliding home share this timing
const DESELECT_MS = 600;
const CLOSE_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
// what a drag ghost (living under <body>) copies from its slot to read like the real thing
const INHERITED_TEXT = [
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
];
// a class edit eases the element's box (and so its outline, which tracks the live box);
// `top` stays listed so a class picked mid-lift doesn't cut the lift short
const CLASS_TRANSITION = [
  "top",
  "padding",
  "gap",
  "border-width",
  "border-radius",
  "border-color",
  "background-color",
  "color",
  "box-shadow",
  "opacity",
]
  .map((p) => `${p} 0.5s cubic-bezier(0.32, 0.72, 0, 1)`)
  .join(", ");
const FOOT_ZONE = 64; // pointer within this many px of the panel bottom reveals the save bar
const EDGE_BAND = 12; // px at a container's top/bottom edge that drop before/after it, not inside

const EL_GROUPS: { label: string; tags: string[] }[] = [
  { label: "Layout", tags: ["div", "section", "header", "footer", "nav", "main", "article", "aside"] },
  { label: "Text", tags: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "blockquote", "strong", "em", "small", "label"] },
  { label: "List", tags: ["ul", "ol", "li"] },
  { label: "Form", tags: ["button", "input", "textarea", "select", "option"] },
  { label: "Media", tags: ["img", "video", "figure", "figcaption"] },
  { label: "Table", tags: ["table", "thead", "tbody", "tr", "th", "td"] },
];
const LAYOUT_TAGS = new Set(EL_GROUPS.find((g) => g.label === "Layout")?.tags);

const BTN_IMPORT = {
  name: "Button",
  from: "@/app/ui/components/base/button/Button",
};
const COMP_CATS: { label: string; comps: string[] }[] = [
  { label: "base", comps: ["Button"] },
];
const SEL_STYLE = {
  height: "var(--control-xs)",
  borderRadius: "var(--radius-control)",
  padding: "0 8px",
  border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
  background: "var(--surface)",
  color: "var(--foreground)",
} as const;
const btnClass = (v: string, t: string) => {
  const s = buttonClasses.styles as Record<string, Record<string, string>>;
  return [
    buttonClasses.base,
    s[v]?.[t] ?? "",
    v !== "link" ? buttonClasses.size.md : "",
    "text-label-lg",
  ]
    .filter(Boolean)
    .join(" ");
};
const btnHtml = (v: string, t: string, label: string) =>
  `<Button${v !== "solid" ? ` variant="${v}"` : ""}${t !== "accent" ? ` tone="${t}"` : ""}>${label}</Button>`;
const VOID_OR_EMPTY = new Set(["img", "input", "video", "br", "hr", "table", "thead", "tbody", "tr", "select"]);


const SAMPLE: Record<string, string> = {
  span: "inline text",
  div: "div",
  section: "section",
  header: "header",
  footer: "footer",
  nav: "nav",
  main: "main",
  article: "article",
  aside: "aside",
};

function describe(el: HTMLElement): Info {
  const r = el.getBoundingClientRect();
  let depth = 0;
  let p = el.parentElement;
  while (p && !p.hasAttribute("data-page-content")) {
    depth++;
    p = p.parentElement;
  }
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || "",
    cls: Array.from(el.classList),
    w: Math.round(r.width),
    h: Math.round(r.height),
    depth,
  };
}

// /_preview renders one special file (layout, loading…): edits go to that file, and its
// [data-preview-root] wrapper stands in for <main> as the editable root
const ROOT_SEL = "[data-preview-root], main";
const editRoot = () => document.querySelector<HTMLElement>(ROOT_SEL);

const PREFS_KEY = "uf-inspector-prefs";
type Prefs = { showSelOutline: boolean; closeOnOutside: boolean; hoverPreview: boolean };
const DEFAULT_PREFS: Prefs = { showSelOutline: true, closeOnOutside: true, hoverPreview: true };
function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}
function writePrefs(v: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(v));
  } catch {}
}

function editTarget(pathname: string): { path: string; kind?: string } {
  if (pathname !== PREVIEW_PATH) return { path: pathname };
  const q = new URLSearchParams(window.location.search);
  return { path: q.get("path") ?? "", kind: q.get("kind") ?? "" };
}

function fileLabel(pathname: string, tx: EditorDict) {
  const t = editTarget(pathname);
  return t.kind ? tx.inspector.fileLabelSpecial(t.kind, t.path) : tx.inspector.fileLabelPage(pathname);
}

// a component instance is one opaque node: resolve any element inside it to its root
function inspectTarget(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  return (el.closest("[data-component]") as HTMLElement | null) ?? el;
}

function collect(): Item[] {
  const root = document.querySelector("[data-page-content]");
  if (!root) return [];
  const els = Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => {
    if (el.closest("[data-inspector-ui], [data-preview-children]")) return false;
    const comp = el.closest("[data-component]");
    if (comp && comp !== el) return false;
    // an empty box (e.g. <div></div>) is 0px tall → give it a visible placeholder size
    // (globals.css) so it can be found, selected and dropped into; cleared on exit
    const empty =
      el.children.length === 0 &&
      !el.textContent?.trim() &&
      !VOID_OR_EMPTY.has(el.tagName.toLowerCase());
    if (empty) el.dataset.ufEmpty = "";
    else if ("ufEmpty" in el.dataset) delete el.dataset.ufEmpty;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return els.slice(0, MAX_ELEMENTS).map((el, i) => ({
    el,
    color: color(i),
    info: describe(el),
    rect: el.getBoundingClientRect(),
  }));
}

const hasHiddenToken = (el: HTMLElement) =>
  Array.from(el.classList).some((t) => /(^|:)hidden$/.test(t));

export function ElementInspector({
  request = null,
  onRequestDone,
}: {
  request?: HTMLElement | null;
  onRequestDone?: () => void;
} = {}) {
  const { hideRight, setChromeHidden } = useDrawerControl();
  const confirm = useConfirm();
  const confirmActive = useConfirmActive();
  const tx = useEditorT();
  const ti = tx.inspector;
  const notify = useNotify();
  const pathname = stripLocale(usePathname());
  // component-editor / tool pages are interactive apps, not static content — the
  // inspector's sid mapping and click capture conflict with them, so don't run here
  const blocked = (pathname ?? "").startsWith("/ui/components");
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const [items, setItems] = useState<Item[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [deselecting, setDeselecting] = useState(false);
  const [editClass, setEditClass] = useState("");
  const [hoverClass, setHoverClass] = useState<string | null>(null);
  const shownClass = hoverClass ?? editClass;
  const [editText, setEditText] = useState("");
  const [savedClass, setSavedClass] = useState("");
  const [savedText, setSavedText] = useState("");
  const [textEditable, setTextEditable] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [hoverTag, setHoverTag] = useState<string | null>(null);
  const [insVariant, setInsVariant] = useState("solid");
  const [insTone, setInsTone] = useState("accent");
  const [paletteTab, setPaletteTab] = useState<"el" | "comp">("el");
  const [compCat, setCompCat] = useState("");
  const [compName, setCompName] = useState("");
  const [previewW, setPreviewW] = useState<number | null>(null);
  const [editDark, setEditDark] = useState(false);
  const [baseW, setBaseW] = useState(0);
  const [footOpen, setFootOpen] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [showSelOutline, setShowSelOutline] = useState(() => readPrefs().showSelOutline);
  // minimized: only the head row (tools) shows; the picker stays mounted (tab, search kept).
  // the panel's height animates to the head row's measured px (CSS can't animate to auto)
  const [panelMin, setPanelMin] = useState(false);
  const [panelMinH, setPanelMinH] = useState(0);
  const editPanelRef = useRef<HTMLDivElement | null>(null);
  const togglePanelMin = () => {
    const panel = editPanelRef.current;
    const head = panel?.firstElementChild as HTMLElement | null;
    if (panel && head) {
      const ps = getComputedStyle(panel);
      const headPad = parseFloat(getComputedStyle(head).paddingBottom) || 0;
      setPanelMinH(
        head.offsetHeight - headPad + parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom) +
          parseFloat(ps.borderTopWidth) + parseFloat(ps.borderBottomWidth)
      );
    }
    setPanelMin((v) => !v);
  };
  const [closeOnOutside, setCloseOnOutside] = useState(() => readPrefs().closeOnOutside);
  const [hoverPreview, setHoverPreview] = useState(() => readPrefs().hoverPreview);
  useEffect(() => {
    writePrefs({ showSelOutline, closeOnOutside, hoverPreview });
  }, [showSelOutline, closeOnOutside, hoverPreview]);
  const [elContext, setElContext] = useState<ElementContext | undefined>(undefined);
  const [runtimeCssVersion, setRuntimeCssVersion] = useState(0);
  // mobile-first: the chosen device/dark toggle becomes a Tailwind variant prefix that
  // new classes get tagged with — the largest breakpoint the preview width reaches
  const bp =
    previewW == null
      ? undefined
      : Object.keys(BREAKPOINTS).findLast((k) => BREAKPOINTS[k] <= previewW);
  const classPrefix = (editDark ? "dark:" : "") + (bp ? `${bp}:` : "");
  const resizeSmoothRef = useRef(false);
  const floatBaseWRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [structDirty, setStructDirty] = useState(false);
  const [dropHint, setDropHint] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    label: string;
    parent: { top: number; left: number; width: number; height: number; label: string };
    kids: { top: number; left: number; width: number; height: number; label: string }[];
  } | null>(null);
  const dragCtx = useRef<{
    el: HTMLElement;
    clone: HTMLElement;
    grabDX: number;
    grabDY: number;
    lastX: number;
    lastY: number;
    drop: { parent: HTMLElement; before: HTMLElement | null } | null;
    // where the element was when the drag began; it goes back there while there's no slot
    origin: { parent: HTMLElement; before: Element | null };
    shifted: HTMLElement[];
    curBefore: HTMLElement | null;
    // a new element with an element clicked (locked) can only go inside that element
    scope?: HTMLElement;
    cx: number;
    cy: number;
  } | null>(null);
  const dragEndRef = useRef(0);
  // the hidden copy holding the lifted element's place in the page (see the lift effect)
  const placeholderRef = useRef<HTMLElement | null>(null);
  const lastOutWarn = useRef(0);
  const outlineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trashRef = useRef<HTMLDivElement | null>(null);
  const trashHotRef = useRef(false);
  const [trashHot, setTrashHot] = useState(false);
  const setTrash = (hot: boolean) => {
    if (trashHotRef.current === hot) return;
    trashHotRef.current = hot;
    setTrashHot(hot);
  };
  const undoStack = useRef<{ html: string; label: string }[]>([]);
  const [changes, setChanges] = useState<string[]>([]);
  const [showChanges, setShowChanges] = useState(false);
  const clipboardRef = useRef<HTMLElement | null>(null);
  const classClipRef = useRef<string | null>(null);

  // the dragged element (kept invisible) sits in the slot for real, so the page lays out
  // exactly as after the drop — gap, margins, grid flow, the container growing, what's
  // below it moving. whatever moved slides from where it was shown to its new place (FLIP)
  const placeAt = (
    c: NonNullable<typeof dragCtx.current>,
    parent: HTMLElement,
    before: Element | null,
    hint: boolean
  ) => {
    const root = c.origin.parent.closest<HTMLElement>(ROOT_SEL) ?? c.origin.parent;
    const els = (Array.from(root.querySelectorAll("*")) as HTMLElement[]).filter(
      (e) => !c.el.contains(e) && !e.closest("[data-inspector-ui]")
    );
    const first = els.map((e) => e.getBoundingClientRect());
    parent.insertBefore(c.el, before);
    for (const e of c.shifted) {
      e.style.transition = "none";
      e.style.transform = "";
    }
    const last = els.map((e) => e.getBoundingClientRect());

    if (hint) {
      const r = c.el.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      const oldW = parseFloat(c.clone.style.width) || r.width;
      const oldH = parseFloat(c.clone.style.height) || r.height;
      c.grabDX *= r.width / oldW;
      c.grabDY *= r.height / oldH;
      c.clone.style.transition = `width 0.18s ${SLIDE_EASE}, height 0.18s ${SLIDE_EASE}, color 0.18s ${SLIDE_EASE}`;
      c.clone.style.width = `${r.width}px`;
      c.clone.style.height = `${r.height}px`;
      const cs = getComputedStyle(c.el);
      for (const prop of INHERITED_TEXT) c.clone.style.setProperty(prop, cs.getPropertyValue(prop));
      setDropHint({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        label: c.el.dataset.newImport?.split("|")[0] ?? `<${c.el.tagName.toLowerCase()}>`,
        parent: {
          top: pr.top,
          left: pr.left,
          width: pr.width,
          height: pr.height,
          label: tagLabel(parent),
        },
        kids: (Array.from(parent.children) as HTMLElement[])
          .filter((k) => k !== c.el && !k.closest("[data-inspector-ui]"))
          .map((k) => {
            const kr = k.getBoundingClientRect();
            return { top: kr.top, left: kr.left, width: kr.width, height: kr.height, label: tagLabel(k) };
          }),
      });
    }

    const delta = new Map<HTMLElement, { dx: number; dy: number }>();
    els.forEach((e, i) => {
      const dx = first[i].left - last[i].left;
      const dy = first[i].top - last[i].top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) delta.set(e, { dx, dy });
    });
    // a child that moved with its parent is carried by the parent's transform
    const slide = new Map<HTMLElement, { dx: number; dy: number }>();
    for (const [e, d] of delta) {
      let a = e.parentElement;
      while (a && !delta.has(a)) a = a.parentElement;
      const carried = a ? delta.get(a)! : { dx: 0, dy: 0 };
      const dx = d.dx - carried.dx;
      const dy = d.dy - carried.dy;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) slide.set(e, { dx, dy });
    }
    for (const [e, { dx, dy }] of slide) e.style.transform = `translate(${dx}px, ${dy}px)`;
    void document.body.offsetHeight; // commit the start position before easing to the end
    for (const e of slide.keys()) {
      e.style.transition = `transform 0.18s ${SLIDE_EASE}`;
      e.style.transform = "";
      if (!c.shifted.includes(e)) c.shifted.push(e);
    }
  };

  const tagLabel = (el: HTMLElement) => {
    const cls = el.classList[0];
    return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}>`;
  };

  const commitDrop = (
    c: NonNullable<typeof dragCtx.current>,
    parent: HTMLElement,
    beforeNode: HTMLElement | null
  ) => {
    c.curBefore = beforeNode;
    if (c.drop?.parent === parent && c.drop.before === beforeNode) return;
    c.drop = { parent, before: beforeNode };
    placeAt(c, parent, beforeNode, true);
  };

  const clearDrop = (c: NonNullable<typeof dragCtx.current>) => {
    c.curBefore = null;
    if (!c.drop) return;
    c.drop = null;
    setDropHint(null);
    placeAt(c, c.origin.parent, c.origin.before, false);
  };

  const computeDrop = (
    c: NonNullable<typeof dragCtx.current>,
    x: number,
    y: number
  ) => {
    let under = document.elementFromPoint(x, y) as HTMLElement | null;
    const overTrash = !!under && !!trashRef.current?.contains(under);
    setTrash(overTrash);
    if (overTrash) {
      clearDrop(c);
      return;
    }
    if (c.scope && under && !under.closest("[data-inspector-ui]") && !c.scope.contains(under)) {
      const now = Date.now();
      if (now - lastOutWarn.current > 1500) {
        lastOutWarn.current = now;
        notify(ti.onlyInside(tagLabel(c.scope)), "info");
      }
      under = c.scope;
    }
    if (
      !under ||
      under.closest("[data-inspector-ui]") ||
      !under.closest(ROOT_SEL) ||
      under === c.el ||
      c.el.contains(under)
    ) {
      if (under && !under.closest("[data-inspector-ui]") && !under.closest(ROOT_SEL)) {
        const now = Date.now();
        if (now - lastOutWarn.current > 1500) {
          lastOutWarn.current = now;
          notify(ti.cantLeaveMain, "info");
        }
      }
      clearDrop(c);
      return;
    }

    if (under.contains(c.origin.parent)) {
      // hovering a container that held el (e.g. <main>) → drop INTO it, placing
      // among its children by Y (append when below them all)
      const kids = (Array.from(under.children) as HTMLElement[]).filter(
        (k) => k !== c.el && !k.closest("[data-inspector-ui]")
      );
      const beforeNode =
        kids.find((k) => {
          const r = k.getBoundingClientRect();
          return y < r.top + r.height / 2;
        }) ?? null;
      commitDrop(c, under, beforeNode);
      return;
    }

    // hovering a container (a tag that can hold children) → drop INSIDE it, among its
    // children by Y. only a thin band at its top/bottom edge places the element before /
    // after the container instead — otherwise pointing inside a box would land outside it
    if (!VOID_OR_EMPTY.has(under.tagName.toLowerCase())) {
      const ur = under.getBoundingClientRect();
      // the page root has no "before/after" — anything over it goes inside
      const band = under.matches(ROOT_SEL) ? 0 : Math.min(EDGE_BAND, ur.height / 4);
      const kids = (Array.from(under.children) as HTMLElement[]).filter(
        (k) => k !== c.el && !k.closest("[data-inspector-ui]")
      );
      // a text-only heading / paragraph / link isn't a container (pointing at text means
      // "next to it"); a text-only layout box like <div> is
      const isContainer =
        kids.length > 0 ||
        !under.textContent?.trim() ||
        under.matches(ROOT_SEL) ||
        LAYOUT_TAGS.has(under.tagName.toLowerCase());
      // the scope takes the drop from anywhere: above it → first, below it → last
      const inBand = under === c.scope || (y > ur.top + band && y < ur.bottom - band);
      if (isContainer && inBand) {
        const beforeNode =
          kids.find((k) => {
            const r = k.getBoundingClientRect();
            return y < r.top + r.height / 2;
          }) ?? null;
        commitDrop(c, under, beforeNode);
        return;
      }
    }

    if (!under.parentElement) {
      clearDrop(c);
      return;
    }
    // sibling insert with hysteresis around the midpoint (stops boundary flip-flop)
    const ur = under.getBoundingClientRect();
    const mid = ur.top + ur.height / 2;
    const afterNode = under.nextElementSibling as HTMLElement | null;
    const M = 14;
    let before: boolean;
    if (c.curBefore === under) before = y <= mid + M;
    else if (c.curBefore === afterNode) before = y < mid - M;
    else before = y < mid;
    commitDrop(c, under.parentElement, before ? under : afterNode);
  };

  const smoothDrag = useSmoothPointer((p) => {
    const c = dragCtx.current;
    if (!c) return;
    c.clone.style.left = `${p.x - c.grabDX}px`;
    c.clone.style.top = `${p.y - c.grabDY}px`;
    // only recompute the drop slot after moving a few px — kills boundary micro-flips
    if (Math.abs(p.x - c.cx) + Math.abs(p.y - c.cy) < 3) return;
    c.cx = p.x;
    c.cy = p.y;
    computeDrop(c, p.x, p.y);
  });

  const itemsRef = useRef<Item[]>([]);
  const focusRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const selectedRef = useRef<number | null>(null);
  const origClassRef = useRef("");
  const tagRef = useRef("");
  const editClassRef = useRef("");
  const origTextRef = useRef("");
  const editTextRef = useRef("");
  const sidRef = useRef<string | null>(null);
  const confirmingRef = useRef(false);
  const lifted = useRef<HTMLElement | null>(null);
  const prev = useRef({ zIndex: "", position: "" });

  const restore = useCallback(() => {
    const el = lifted.current;
    if (!el) return;
    el.style.zIndex = prev.current.zIndex;
    el.style.position = prev.current.position;
    lifted.current = null;
  }, []);

  const lift = useCallback(
    (el: HTMLElement | null) => {
      if (lifted.current === el) return;
      restore();
      if (!el) return;
      prev.current = { zIndex: el.style.zIndex, position: el.style.position };
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.zIndex = "1950";
      lifted.current = el;
    },
    [restore]
  );

  const teardown = useCallback(() => {
    restore();
    setItems([]);
    setFocus(null);
    setLocked(false);
    setSelectedIdx(null);
    setClosing(false);
    setActive(false);
    setChromeHidden(false);
    closingRef.current = false;
    selectedRef.current = null;
  }, [restore, setChromeHidden]);

  const stop = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(teardown, 1300);
  }, [teardown]);

  const deselect = useCallback(() => {
    setDeselecting(true);
    // glide the lifted element back onto its placeholder (which has held its slot the
    // whole time) while the panel slides out; the style restore then lands it exactly there
    const el =
      selectedRef.current != null ? itemsRef.current[selectedRef.current]?.el ?? null : null;
    const slot = placeholderRef.current;
    if (el && slot) {
      const home = slot.getBoundingClientRect();
      const now = el.getBoundingClientRect();
      el.style.transition = `top ${DESELECT_MS}ms ${CLOSE_EASE}, transform ${DESELECT_MS}ms ${CLOSE_EASE}`;
      el.style.top = `${home.top}px`;
      el.style.transform = `translateX(${home.left - now.left}px)`;
    }
    setTimeout(() => {
      setSelectedIdx(null);
      selectedRef.current = null;
      setLocked(false);
      setDeselecting(false);
      // the element is already home; re-measure after its styles are restored so outlines match
      // (skipped if the mode was left meanwhile — collect() would re-tag empty boxes)
      setTimeout(() => activeRef.current && setItems(collect()), 120);
    }, DESELECT_MS + 20);
  }, []);

  const doWrite = useCallback(async (sid: number) => {
    const res = await fetch("/api/element", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editTarget(pathname),
        sid,
        origClass: origClassRef.current,
        newClass: editClassRef.current,
        tag: tagRef.current,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
  }, [pathname]);

  const doWriteText = useCallback(async () => {
    const res = await fetch("/api/element/text", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editTarget(pathname),
        sid: sidRef.current != null ? Number(sidRef.current) : -1,
        newText: editTextRef.current,
        tag: tagRef.current,
        origText: origTextRef.current,
        // text read from the [lang] dictionary is written to that language's file
        lang: localeOf(window.location.pathname),
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
  }, [pathname]);

  // → true when the edit waits for the structure save (an added element isn't in the file yet)
  const persistEdits = useCallback(async () => {
    const el = selectedRef.current != null ? itemsRef.current[selectedRef.current]?.el : null;
    const sid = el?.dataset.sid;
    // a pasted copy shares its original's sid: writing would change the original
    if (sid && document.querySelectorAll(`[data-sid="${sid}"]`).length > 1)
      throw new Error(ti.saveStructureFirst);
    // an added component is written from its snippet, so edits to it wouldn't be kept
    if (!sid && el?.dataset.newHtml) throw new Error(ti.saveStructureFirstComp);
    if (sid) {
      if (editClassRef.current !== origClassRef.current) await doWrite(Number(sid));
      if (editTextRef.current !== origTextRef.current) await doWriteText();
    }
    origClassRef.current = editClassRef.current;
    origTextRef.current = editTextRef.current;
    setSavedClass(editClassRef.current);
    setSavedText(editTextRef.current);
    return !sid;
  }, [doWrite, doWriteText, ti]);

  // cancel: with an element selected, deselect (stay in inspect mode); but if its
  // className/text was edited without saving, ask whether to save first. otherwise exit.
  const cancel = useCallback(() => {
    if (selectedRef.current == null) {
      stop();
      return;
    }
    const dirty =
      editClassRef.current !== origClassRef.current ||
      editTextRef.current !== origTextRef.current;
    if (!dirty) {
      deselect();
      return;
    }
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    const el = itemsRef.current[selectedRef.current]?.el ?? null;
    confirm({
      title: ti.unsavedQ,
      message: ti.unsavedMsg,
      confirmText: tx.common.save,
      cancelText: ti.dontSave,
    }).then(async (save) => {
      confirmingRef.current = false;
      if (save) {
        try {
          const later = await persistEdits();
          notify(later ? ti.savedWithStructure : tx.common.savedToFile, "success");
        } catch (e) {
          notify(e instanceof Error ? e.message : tx.common.saveFailed, "error");
          return;
        }
      } else if (el) {
        el.className = origClassRef.current;
        if (editTextRef.current !== origTextRef.current)
          el.textContent = origTextRef.current;
      }
      deselect();
    });
  }, [stop, deselect, persistEdits, confirm, notify, tx, ti]);

  const start = () => {
    if (blocked) return;
    hideRight();
    setChromeHidden(true);
    setTimeout(() => setActive(true), 220);
  };

  // leaving a content page for a tool page while active → force-exit the inspector
  useEffect(() => {
    if (blocked && active) {
      setActive(false);
      setChromeHidden(false);
    }
  }, [blocked, active, setChromeHidden]);

  useEffect(() => {
    if (active) return;
    const onDoubleClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (!e.ctrlKey && !e.metaKey) {
        if (t?.closest("[data-page-content]")) {
          notify(ti.holdCtrlHint, "info");
        }
        return;
      }
      if (e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      start();
    };
    window.addEventListener("dblclick", onDoubleClick, true);
    return () => window.removeEventListener("dblclick", onDoubleClick, true);
  });

  useEffect(() => {
    if (!active) return;
    (document.activeElement as HTMLElement | null)?.blur();
    // reveal elements hidden via `hidden` so they can still be selected/unhidden —
    // force only ones actually display:none now (keeps e.g. `flex md:hidden` intact),
    // tag them for a dimmed cue, and restore on exit (the source keeps `hidden`)
    const root = document.querySelector("[data-page-content]");
    const revealed: HTMLElement[] = [];
    if (root) {
      for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
        if (el.closest("[data-inspector-ui]")) continue;
        if (getComputedStyle(el).display !== "none" || !hasHiddenToken(el)) continue;
        el.dataset.ufHidden = "";
        el.style.setProperty("display", "revert", "important");
        revealed.push(el);
      }
    }
    setItems(collect());
    return () => {
      for (const el of revealed) {
        el.style.removeProperty("display");
        delete el.dataset.ufHidden;
      }
      root?.querySelectorAll<HTMLElement>("[data-uf-empty]").forEach((el) => delete el.dataset.ufEmpty);
    };
  }, [active]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);
  useEffect(() => {
    selectedRef.current = selectedIdx;
  }, [selectedIdx]);


  const focusEl = focus != null ? items[focus]?.el ?? null : null;
  useEffect(() => {
    lift(focusEl);
  }, [focusEl, lift]);

  useEffect(() => {
    const el = selectedIdx != null ? items[selectedIdx]?.el ?? null : null;
    if (!el) return;
    setShowSearch(false);
    setShowCustom(false);
    setShowClone(false);
    origClassRef.current = el.className;
    tagRef.current = el.tagName.toLowerCase();
    editClassRef.current = el.className;
    setEditClass(el.className);
    setHoverClass(null);
    setSavedClass(el.className);
    // text editing only for a plain-text element (no child elements) that the
    // structure pass has tagged with a sid; keeps the source rewrite safe
    const editable =
      !VOID_OR_EMPTY.has(tagRef.current) &&
      el.children.length === 0 &&
      el.dataset.sid != null;
    setTextEditable(editable);
    sidRef.current = editable ? el.dataset.sid ?? null : null;
    const text = editable ? el.textContent ?? "" : "";
    origTextRef.current = text;
    editTextRef.current = text;
    setEditText(text);
    setSavedText(text);
    // float the selected element out of flow (position:fixed) so editing/resizing
    // it never reflows or pushes the other elements around
    const rect = el.getBoundingClientRect();
    floatBaseWRef.current = rect.width;
    setBaseW(Math.round(rect.width));
    const prev = {
      position: el.style.position,
      top: el.style.top,
      left: el.style.left,
      right: el.style.right,
      width: el.style.width,
      maxWidth: el.style.maxWidth,
      margin: el.style.margin,
      transform: el.style.transform,
      transition: el.style.transition,
      zIndex: el.style.zIndex,
      boxSizing: el.style.boxSizing,
    };
    // a hidden copy keeps the element's slot while it floats, so the content below
    // doesn't move up now and jump back down on close. tagged as editor UI, so the
    // element list, structure save and page checks all skip it
    const placeholder = el.cloneNode(true) as HTMLElement;
    for (const n of [placeholder, ...Array.from(placeholder.querySelectorAll<HTMLElement>("*"))]) {
      n.removeAttribute("data-sid");
      n.removeAttribute("contenteditable");
      n.removeAttribute("id");
    }
    placeholder.dataset.inspectorUi = "";
    placeholder.dataset.ufPlaceholder = "";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.visibility = "hidden";
    placeholder.style.pointerEvents = "none";
    el.before(placeholder);
    placeholderRef.current = placeholder;
    el.style.transition = "none";
    el.style.position = "fixed";
    el.style.top = `${rect.top}px`;
    el.style.left = "0";
    el.style.right = "0";
    el.style.width = `${rect.width}px`;
    el.style.maxWidth = "calc(100% - 32px)"; // fixed → cap at viewport, never overflow
    el.style.margin = "0 auto";
    el.style.boxSizing = "border-box";
    el.style.zIndex = "1960";
    el.style.transform = "none";
    const raf = requestAnimationFrame(() => {
      el.style.transition = "top 0.5s cubic-bezier(0.32,0.72,0,1)";
      el.style.top = `${LIFT_TOP}px`;
    });
    return () => {
      cancelAnimationFrame(raf);
      el.style.transition = "none";
      el.style.position = prev.position;
      el.style.top = prev.top;
      el.style.left = prev.left;
      el.style.right = prev.right;
      el.style.width = prev.width;
      el.style.maxWidth = prev.maxWidth;
      el.style.margin = prev.margin;
      el.style.transform = prev.transform;
      el.style.zIndex = prev.zIndex;
      el.style.boxSizing = prev.boxSizing;
      placeholder.remove(); // same frame as the restore → the slot never changes size
      if (placeholderRef.current === placeholder) placeholderRef.current = null;
      setTimeout(() => {
        el.style.transition = prev.transition;
      }, 0);
    };
  }, [selectedIdx, items]);


  const applyClass = (v: string) => {
    const el = selectedIdx != null ? items[selectedIdx]?.el ?? null : null;
    if (el) {
      el.style.transition = CLASS_TRANSITION;
      el.className = v;
    }
    editClassRef.current = v;
    setEditClass(v);
  };

  const previewClass = (v: string | null) => {
    const el = selectedIdx != null ? items[selectedIdx]?.el ?? null : null;
    if (el) {
      el.style.transition = CLASS_TRANSITION;
      el.className = v ?? editClassRef.current;
    }
    setHoverClass(v);
  };

  useEffect(() => {
    const el =
      selectedIdx != null && textEditable ? itemsRef.current[selectedIdx]?.el ?? null : null;
    if (!el) return;
    el.contentEditable = "plaintext-only";
    el.spellcheck = false;
    el.dataset.ufTextEdit = "";
    const onInput = () => {
      editTextRef.current = el.textContent ?? "";
      setEditText(editTextRef.current);
    };
    // JSX collapses a line break into a space, so Enter just finishes the edit
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      el.blur();
    };
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeAttribute("contenteditable");
      el.removeAttribute("spellcheck");
      delete el.dataset.ufTextEdit;
    };
  }, [selectedIdx, textEditable]);

  const cloneSources = useMemo(() => {
    if (selectedIdx == null) return [] as { cls: string; html: string }[];
    const tag = items[selectedIdx]?.info.tag;
    const seen = new Set<string>();
    const out: { cls: string; html: string }[] = [];
    items.forEach((it, i) => {
      if (i === selectedIdx || it.info.tag !== tag) return;
      const cls = it.el.className.trim();
      if (!cls || seen.has(cls)) return;
      seen.add(cls);
      const clone = it.el.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-sid");
      clone.removeAttribute("data-uf-hidden");
      // drop `hidden` so the preview is actually visible (the cloned class keeps it)
      clone.className = clone.className
        .split(/\s+/)
        .filter((t) => t && !/(^|:)hidden$/.test(t))
        .join(" ");
      out.push({ cls, html: clone.outerHTML });
    });
    return out;
  }, [items, selectedIdx]);

  const clearAllClasses = async () => {
    const ok = await confirm({
      title: ti.clearAllQ,
      message: ti.clearAllMsg,
      confirmText: ti.clear,
      danger: true,
    });
    if (ok) applyClass("");
  };

  const pushUndo = (label: string) => {
    const main = editRoot();
    if (!main) return;
    const snap = main.cloneNode(true) as HTMLElement;
    snap.querySelectorAll("[data-uf-placeholder]").forEach((n) => n.remove());
    undoStack.current.push({ html: snap.innerHTML, label });
    if (undoStack.current.length > 50) undoStack.current.shift();
    setChanges(undoStack.current.map((u) => u.label));
  };

  const undo = () => {
    const main = editRoot();
    if (!main) return;
    if (undoStack.current.length === 0) {
      notify(ti.nothingToUndo, "info", RotateCcw);
      return;
    }
    main.innerHTML = undoStack.current.pop()!.html;
    setChanges(undoStack.current.map((u) => u.label));
    setSelectedIdx(null);
    selectedRef.current = null;
    setLocked(false);
    setFocus(null);
    setItems(collect());
    if (undoStack.current.length === 0) setStructDirty(false);
    notify(ti.undone, "info", RotateCcw);
  };

  const cleanClone = (el: HTMLElement) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.style.transform = "";
    c.style.transition = "";
    c.style.zIndex = "";
    c.style.position = "";
    return c;
  };

  // before any delete: the page root (and what wraps it) and a special file's last
  // outermost element can't go; a parent that still holds elements asks first
  const canDelete = async (el: HTMLElement) => {
    const root = editRoot();
    if (root && (el === root || el.contains(root))) {
      notify(ti.cantDeleteRoot, "info");
      return false;
    }
    if (root?.matches("[data-preview-root]") && el.parentElement === root && root.children.length <= 1) {
      notify(ti.cantDeleteOnlyRoot, "info");
      return false;
    }
    const inside = el.querySelectorAll("*").length;
    if (inside === 0) return true;
    return confirm({
      title: ti.deleteParentQ(el.tagName.toLowerCase()),
      message: ti.deleteParentMsg(inside),
      confirmText: tx.common.delete,
      danger: true,
    });
  };

  const deleteNode = async (el: HTMLElement | null) => {
    if (!el || !(await canDelete(el))) return;
    pushUndo(ti.undoDelete(el.tagName.toLowerCase()));
    el.remove();
    setStructDirty(true);
    setFocus(null);
    setItems(collect());
  };

  const targetEl = (): HTMLElement | null => {
    if (selectedRef.current != null)
      return itemsRef.current[selectedRef.current]?.el ?? null;
    if (lockedRef.current && focusRef.current != null)
      return itemsRef.current[focusRef.current]?.el ?? null;
    return null;
  };

  const afterStruct = (el: HTMLElement | null) => {
    setStructDirty(true);
    const next = collect();
    setItems(next);
    const idx = el && el.isConnected ? next.findIndex((it) => it.el === el) : -1;
    if (selectedRef.current != null) {
      selectedRef.current = idx >= 0 ? idx : null;
      setSelectedIdx(idx >= 0 ? idx : null);
    } else {
      focusRef.current = idx >= 0 ? idx : null;
      setFocus(idx >= 0 ? idx : null);
    }
  };

  const copySelected = () => {
    const el = targetEl();
    if (!el) return;
    const copy = cleanClone(el);
    // the edited element floats lifted (see the lift effect) and may be in text editing:
    // copy the element as it is on the page, not those editor-only bits
    if (selectedRef.current != null)
      for (const p of ["top", "left", "right", "width", "maxWidth", "margin", "boxSizing"] as const)
        copy.style[p] = "";
    copy.removeAttribute("contenteditable");
    copy.removeAttribute("spellcheck");
    delete copy.dataset.ufTextEdit;
    // a narrower preview width keeps the full classes aside (see the breakpoint effect)
    for (const n of [copy, ...Array.from(copy.querySelectorAll<HTMLElement>("[data-uf-class]"))]) {
      if (n.dataset.ufClass === undefined) continue;
      n.setAttribute("class", n.dataset.ufClass);
      delete n.dataset.ufClass;
    }
    if (!copy.getAttribute("style")) copy.removeAttribute("style");
    clipboardRef.current = copy;
    const sid = el.dataset.sid;
    if (!sid) {
      notify(ti.copiedElNoCode(ti.notSavedYet), "info");
      return;
    }
    const target = editTarget(pathname);
    const q = new URLSearchParams({ path: target.path, kind: target.kind || "page", sid });
    // a component instance renders a different tag than the <Name> in the file
    if (!el.dataset.component) q.set("tag", el.tagName.toLowerCase());
    fetch(`/api/element/source?${q}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        return navigator.clipboard.writeText(data.source);
      })
      .then(
        () => notify(ti.copiedElCode, "success"),
        (e) => notify(ti.copiedElNoCode(e instanceof Error ? e.message : String(e)), "info")
      );
  };

  const copyClassName = () => {
    const el = targetEl();
    if (!el) return;
    const cls = el.className.trim();
    if (!cls) {
      notify(ti.noClass, "info");
      return;
    }
    classClipRef.current = cls;
    navigator.clipboard?.writeText(cls).then(
      () => notify(ti.copiedClass, "success"),
      () => notify(ti.copiedClassBuffer, "success")
    );
  };

  const pasteClassName = () => {
    if (selectedRef.current == null) {
      notify(ti.selectFirst, "info");
      return;
    }
    const cls = classClipRef.current;
    if (!cls) {
      notify(ti.noClassCopied, "info");
      return;
    }
    applyClass(cls);
    notify(ti.pastedClass, "success");
  };

  const pasteSelected = () => {
    const el = targetEl();
    if (!el) return;
    if (!clipboardRef.current) {
      notify(ti.nothingToPaste, "info");
      return;
    }
    pushUndo(ti.undoPaste(clipboardRef.current.tagName.toLowerCase()));
    el.insertAdjacentElement("afterend", cleanClone(clipboardRef.current));
    afterStruct(el);
    notify(ti.pastedEl, "success");
  };

  const deleteSelected = async () => {
    const el = targetEl();
    if (!el || !(await canDelete(el))) return;
    pushUndo(ti.undoDelete(el.tagName.toLowerCase()));
    el.remove();
    afterStruct(null);
  };

  const beginPaletteDrag = (
    tag: string,
    sx: number,
    sy: number,
    insert?: { name: string; from: string; html: string; className?: string }
  ) => {
    const main = editRoot();
    if (!main) return;
    const locked = targetEl();
    const scope =
      locked &&
      !VOID_OR_EMPTY.has(locked.tagName.toLowerCase()) &&
      (locked.children.length > 0 ||
        !locked.textContent?.trim() ||
        LAYOUT_TAGS.has(locked.tagName.toLowerCase()))
        ? locked
        : undefined;
    setShowPalette(false);
    const wasDirty = structDirty;
    pushUndo(ti.undoAdd(insert ? insert.name : `<${tag}>`));
    const node = document.createElement(tag);
    if (!VOID_OR_EMPTY.has(tag)) node.textContent = insert ? ti.sample.button : tag;
    if (insert) {
      if (insert.className) node.className = insert.className;
      node.dataset.newHtml = insert.html;
      node.dataset.newImport = `${insert.name}|${insert.from}`;
    }
    main.appendChild(node); // temp placement so drop targets/containers resolve
    setStructDirty(true);
    const r = node.getBoundingClientRect();
    const clone = cleanClone(node);
    Object.assign(clone.style, {
      position: "fixed",
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: "2400",
      opacity: "0.95",
      boxSizing: "border-box",
      boxShadow: "0 18px 40px -12px rgba(15, 23, 42, 0.5)",
      outline: "2px solid var(--accent)",
      outlineOffset: "2px",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(clone);
    node.style.visibility = "hidden";
    node.style.pointerEvents = "none";
    dragCtx.current = {
      el: node,
      clone,
      grabDX: r.width / 2,
      grabDY: r.height / 2,
      lastX: sx,
      lastY: sy,
      drop: null,
      origin: { parent: main, before: null },
      shifted: [],
      curBefore: null,
      cx: NaN,
      cy: NaN,
      scope,
    };
    setDragging(true);
    smoothDrag.start(sx, sy);

    const onMove = (ev: PointerEvent) => {
      smoothDrag.move(ev.clientX, ev.clientY);
      const c = dragCtx.current;
      if (c) {
        c.lastX = ev.clientX;
        c.lastY = ev.clientY;
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      smoothDrag.stop();
      const c = dragCtx.current;
      dragCtx.current = null;
      setDragging(false);
      if (!c) return;
      computeDrop(c, c.lastX, c.lastY);
      c.clone.remove();
      for (const n of c.shifted) {
        n.style.transition = "";
        n.style.transform = "";
      }
      c.el.style.visibility = "";
      c.el.style.pointerEvents = "";
      c.el.style.transform = "";
      c.el.style.transition = "";
      if (trashHotRef.current) {
        // released over the trash → the new element is simply not added: drop the undo
        // step taken at drag start and restore the "unsaved structure" state it had
        setTrash(false);
        c.el.remove();
        undoStack.current.pop();
        setChanges(undoStack.current.map((u) => u.label));
        setStructDirty(wasDirty);
        return;
      }
      afterStruct(c.el); // already in its slot (or, with none, still at the end of <main>)
      notify(ti.added(tag), "success");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onPalettePointerDown = (
    tag: string,
    e: ReactPointerEvent,
    insert?: { name: string; from: string; html: string; className?: string }
  ) => {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const tm = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 6) return;
      window.removeEventListener("pointermove", tm, true);
      window.removeEventListener("pointerup", tu, true);
      beginPaletteDrag(tag, sx, sy, insert);
    };
    const tu = () => {
      window.removeEventListener("pointermove", tm, true);
      window.removeEventListener("pointerup", tu, true);
    };
    window.addEventListener("pointermove", tm, true);
    window.addEventListener("pointerup", tu, true);
  };

  const renderMock = (tag: string) => {
    switch (tag) {
      case "img":
        return <div className={styles.mockBox}>{ti.sample.image}</div>;
      case "video":
        return <div className={styles.mockBox}>{ti.sample.video}</div>;
      case "input":
        return (
          <input className={styles.mockField} placeholder={ti.sample.typeHere} readOnly />
        );
      case "textarea":
        return (
          <textarea
            className={styles.mockField}
            rows={2}
            readOnly
            defaultValue={ti.sample.multiline}
          />
        );
      case "select":
      case "option":
        return (
          <select className={styles.mockField} defaultValue="">
            <option value="">{ti.sample.option}</option>
          </select>
        );
      case "button":
        return (
          <button type="button" className={styles.mockBtn}>
            {ti.sample.button}
          </button>
        );
      case "a":
        return <a className={styles.mockLink}>{ti.sample.link}</a>;
      case "ul":
        return (
          <ul className={styles.mockList}>
            <li>{ti.sample.item(1)}</li>
            <li>{ti.sample.item(2)}</li>
          </ul>
        );
      case "ol":
        return (
          <ol className={styles.mockList}>
            <li>{ti.sample.point(1)}</li>
            <li>{ti.sample.point(2)}</li>
          </ol>
        );
      case "li":
        return (
          <ul className={styles.mockList}>
            <li>{ti.sample.subItem}</li>
          </ul>
        );
      case "table":
      case "thead":
      case "tbody":
      case "tr":
      case "th":
      case "td":
        return (
          <table className={styles.mockTable}>
            <tbody>
              <tr>
                <th>{ti.sample.th}</th>
                <td>{ti.sample.td}</td>
              </tr>
            </tbody>
          </table>
        );
      case "figure":
      case "figcaption":
        return (
          <figure className={styles.mockFig}>
            <div className={styles.mockBox}>🖼</div>
            <figcaption>{ti.sample.caption}</figcaption>
          </figure>
        );
      case "blockquote":
        return (
          <blockquote className={styles.mockQuote}>
            {ti.sample.quote}
          </blockquote>
        );
      default:
        return createElement(
          tag,
          { className: /^h[1-6]$/.test(tag) ? styles.mockHeading : styles.mockEl },
          ({ p: ti.sample.p, strong: ti.sample.strong, em: ti.sample.em, small: ti.sample.small, label: ti.sample.label } as Record<string, string>)[tag] ??
            SAMPLE[tag] ??
            tag
        );
    }
  };

  const moveSelected = (dir: -1 | 1) => {
    const el = targetEl();
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    if (!sib) {
      notify(ti.cantMove, "info");
      return;
    }
    pushUndo(ti.undoMove(el.tagName.toLowerCase(), dir < 0));
    if (dir < 0) parent.insertBefore(el, sib);
    else parent.insertBefore(el, sib.nextElementSibling);
    afterStruct(el);
  };

  type StructNode = {
    sid: number | null;
    children: StructNode[];
    html?: string;
    text?: true;
    value?: string;
    tag?: string;
    className?: string;
  };
  type NewImport = { name: string; from: string };
  const buildStructTree = (
    parent: HTMLElement,
    imports: NewImport[]
  ): StructNode[] => {
    const out: StructNode[] = [];
    for (const n of Array.from(parent.childNodes)) {
      // a run of text between elements: an existing element keeps its source text in
      // that spot; an added element's text is written from value
      if (n.nodeType === Node.TEXT_NODE) {
        const prev = out[out.length - 1];
        if (prev?.text) prev.value += n.textContent ?? "";
        else if (n.textContent?.trim())
          out.push({ sid: null, children: [], text: true, value: n.textContent });
        continue;
      }
      if (!(n instanceof HTMLElement)) continue;
      const el = n;
      if (el.closest("[data-inspector-ui]")) continue;
      const a = el.dataset.sid;
      const isNew = !(a !== undefined && a !== "");
      const node: StructNode = {
        sid: isNew ? null : Number(a),
        children: buildStructTree(el, imports),
      };
      if (isNew && !el.dataset.newHtml) {
        node.tag = el.tagName.toLowerCase();
        node.className = el.dataset.ufClass ?? el.getAttribute("class") ?? "";
      }
      if (isNew && el.dataset.newHtml) {
        node.html = el.dataset.newHtml;
        if (el.dataset.newImport) {
          const [name, from] = el.dataset.newImport.split("|");
          if (!imports.some((i) => i.name === name && i.from === from))
            imports.push({ name, from });
        }
      }
      out.push(node);
    }
    return out;
  };

  const saveStructure = async () => {
    const ok = await confirm({
      title: ti.saveStructureQ,
      message: ti.saveStructureMsg(fileLabel(pathname, tx)),
      confirmText: tx.common.save,
    });
    if (!ok) return;
    const main = editRoot();
    if (!main) return;
    const imports: NewImport[] = [];
    const children = buildStructTree(main as HTMLElement, imports);
    try {
      const res = await fetch("/api/structure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editTarget(pathname), children, imports }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setStructDirty(false);
      undoStack.current = [];
      setChanges([]);
      notify(
        data.changed ? ti.structureSaved : ti.noChange,
        "success"
      );
      // the file just changed → reload for a clean remount instead of letting
      // HMR reconcile the DOM we mutated (which throws removeChild errors)
      if (data.changed) setTimeout(reloadWithoutGuard, 500);
    } catch (e) {
      notify(e instanceof Error ? e.message : tx.common.saveFailed, "error");
    }
  };

  const resetStructure = async () => {
    const ok = await confirm({
      title: ti.resetQ,
      message: ti.resetMsg,
      confirmText: ti.resetBtn,
      danger: true,
    });
    if (ok) reloadWithoutGuard();
  };

  const startDrag = (el: HTMLElement | null, clientX: number, clientY: number) => {
    if (!el || !el.parentElement) return;
    const r = el.getBoundingClientRect();
    const clone = cleanClone(el);
    Object.assign(clone.style, {
      position: "fixed",
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      margin: "0",
      pointerEvents: "none",
      zIndex: "2200",
      opacity: "0.95",
      boxSizing: "border-box",
      boxShadow: "0 18px 40px -12px rgba(15, 23, 42, 0.5)",
      outline: "2px solid var(--accent)",
      outlineOffset: "2px",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(clone);
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none"; // let elementFromPoint see through to drop targets
    dragCtx.current = {
      el,
      clone,
      grabDX: clientX - r.left,
      grabDY: clientY - r.top,
      lastX: clientX,
      lastY: clientY,
      drop: null,
      origin: { parent: el.parentElement, before: el.nextElementSibling },
      shifted: [],
      curBefore: null,
      cx: NaN,
      cy: NaN,
    };
    setDragging(true);
    smoothDrag.start(clientX, clientY);

    const onMove = (ev: PointerEvent) => {
      smoothDrag.move(ev.clientX, ev.clientY);
      const c = dragCtx.current;
      if (!c) return;
      c.lastX = ev.clientX;
      c.lastY = ev.clientY;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      smoothDrag.stop();
      dragEndRef.current = Date.now(); // suppress the trailing click (no accidental select)
      const c = dragCtx.current;
      dragCtx.current = null;
      setDragging(false);
      setDropHint(null);
      if (!c) return;
      computeDrop(c, c.lastX, c.lastY);
      c.clone.remove();
      for (const n of c.shifted) {
        n.style.transition = "";
        n.style.transform = "";
      }
      c.shifted = [];
      c.el.style.visibility = "";
      c.el.style.pointerEvents = "";
      c.el.style.transform = "";
      c.el.style.transition = "";
      const trashed = trashHotRef.current;
      setTrash(false);
      if (trashed) void deleteNode(c.el); // same guards as any delete (root, parent confirm)
      else if (c.drop) {
        // it already sits in the slot: snapshot the page as it was before the drag
        const { parent, before } = c.drop;
        c.origin.parent.insertBefore(c.el, c.origin.before);
        pushUndo(ti.undoDrag(c.el.tagName.toLowerCase()));
        parent.insertBefore(c.el, before);
        setStructDirty(true);
      }
      if (selectedRef.current != null) deselect();
      else {
        setFocus(null);
        setItems(collect());
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const editDirty = editClass !== savedClass || editText !== savedText;
  useUnsavedGuard(editDirty || structDirty);

  const LEAVE_MS = 450; // .slideDownOut
  const FADE_MS = 200;
  const tipShown = usePresence(selectedIdx == null && !dragging, LEAVE_MS);
  const toolsShown = usePresence(selectedIdx == null && (dragging || !showPalette), LEAVE_MS);
  const barBtnsShown = usePresence(!dragging && !showPalette, FADE_MS);
  const trashLabelShown = usePresence(dragging, FADE_MS);
  const paletteShown = usePresence(selectedIdx == null && showPalette, LEAVE_MS);
  const previewShown = usePresence(selectedIdx == null && showPalette && hoverTag != null, FADE_MS);
  const structShown = usePresence(structDirty && selectedIdx == null && !dragging, LEAVE_MS);
  const changesShown = usePresence(showChanges && changes.length > 0, FADE_MS);
  const hintShown = usePresence(dragging && dropHint != null, FADE_MS);
  // what the leaving drop hint / preview still show once their state is cleared
  const [lastHint, setLastHint] = useState(dropHint);
  const [lastTag, setLastTag] = useState(hoverTag);
  if (dropHint && dropHint !== lastHint) setLastHint(dropHint);
  if (hoverTag && hoverTag !== lastTag) setLastTag(hoverTag);
  const hint = dropHint ?? lastHint;
  const previewTag = hoverTag ?? lastTag;

  const saveToFile = async () => {
    const ok = await confirm({
      title: tx.common.saveToFileQ,
      message: ti.saveEditMsg(fileLabel(pathname, tx)),
      confirmText: tx.common.save,
    });
    if (!ok) return;
    try {
      const later = await persistEdits();
      notify(later ? ti.savedWithStructure : tx.common.savedToFile, "success");
      deselect();
    } catch (e) {
      notify(e instanceof Error ? e.message : tx.common.saveFailed, "error");
    }
  };

  useEffect(() => {
    if (!active) return;
    let lastIdx = -1;
    let lastTime = 0;
    const onMove = (e: MouseEvent) => {
      if (lockedRef.current || selectedRef.current != null) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-inspector-ui]")) return;
      const el = inspectTarget(
        document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      );
      const idx = el ? itemsRef.current.findIndex((it) => it.el === el) : -1;
      setFocus(idx >= 0 ? idx : null);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-inspector-ui]") || !t?.closest("[data-page-content]")) return;
      if (t.isContentEditable) return; // let the caret land in the element being typed in
      e.preventDefault(); // stop the clicked element from taking focus (no focus ring)
    };
    const onPointerDownPage = (e: PointerEvent) => {
      if (selectedRef.current != null) return;
      if (!e.ctrlKey && !e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-inspector-ui]") || !t?.closest("[data-page-content]")) return;
      const el = inspectTarget(
        document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      );
      const idx = el ? itemsRef.current.findIndex((it) => it.el === el) : -1;
      if (idx < 0 || !el) return;
      const sx = e.clientX;
      const sy = e.clientY;
      const tm = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 6) return;
        window.removeEventListener("pointermove", tm, true);
        window.removeEventListener("pointerup", tu, true);
        startDrag(el, sx, sy);
      };
      const tu = () => {
        window.removeEventListener("pointermove", tm, true);
        window.removeEventListener("pointerup", tu, true);
      };
      window.addEventListener("pointermove", tm, true);
      window.addEventListener("pointerup", tu, true);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-inspector-ui]") || !t?.closest("[data-page-content]")) return;
      if (Date.now() - dragEndRef.current < 300) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (selectedRef.current != null) return;
      const el = inspectTarget(
        document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      );
      const idx = el ? itemsRef.current.findIndex((it) => it.el === el) : -1;
      if (idx < 0) return;
      const now = Date.now();
      if (idx === lastIdx && now - lastTime < 350) {
        lastIdx = -1;
        lastTime = 0;
        setFocus(idx);
        setSelectedIdx(idx);
        return;
      }
      lastIdx = idx;
      lastTime = now;
      if (lockedRef.current && focusRef.current === idx) {
        setLocked(false);
      } else {
        setFocus(idx);
        setLocked(true);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // typing in the element: keep native text keys (Ctrl+C/V/Z, arrows); only Esc exits
      if ((e.target as HTMLElement | null)?.isContentEditable && e.key !== "Escape") return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        e.stopPropagation();
        undo();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        return;
      }
      const hasTarget =
        selectedRef.current != null ||
        (lockedRef.current && focusRef.current != null);
      if ((e.ctrlKey || e.metaKey) && hasTarget) {
        const k = e.key.toLowerCase();
        if (k === "c") {
          e.preventDefault();
          e.stopPropagation();
          copySelected();
          return;
        }
        if (k === "v") {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) pasteClassName();
          else pasteSelected();
          return;
        }
        if (k === "b") {
          e.preventDefault();
          e.stopPropagation();
          copyClassName();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          e.stopPropagation();
          deleteSelected();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          moveSelected(-1);
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          moveSelected(1);
          return;
        }
      }
      if (selectedRef.current != null) {
        const t = e.target as HTMLElement | null;
        const typing = t?.matches("input, textarea, select");
        if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === "KeyF") {
          e.preventDefault(); // keep the "f" out of the autofocused search input
          e.stopPropagation();
          setShowSearch(true);
          setShowCustom(false);
        }
        return;
      }
      if (e.key === "Enter" && lockedRef.current && focusRef.current != null) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIdx(focusRef.current);
        return;
      }
      if (!lockedRef.current || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      const cur = focusRef.current;
      const el = cur != null ? itemsRef.current[cur]?.el : null;
      if (!el) return;
      let target: HTMLElement | null = null;
      if (e.key === "ArrowUp") {
        const p = el.parentElement;
        if (p && !p.hasAttribute("data-page-content")) target = p;
      } else {
        target =
          (Array.from(el.children) as HTMLElement[]).find((c) =>
            itemsRef.current.some((it) => it.el === c)
          ) ?? null;
      }
      const idx = target ? itemsRef.current.findIndex((it) => it.el === target) : -1;
      if (idx < 0) return;
      e.preventDefault();
      e.stopPropagation();
      setFocus(idx);
    };
    // block page scrolling while inspecting (outlines are pinned to the viewport)
    let lastScrollNotify = 0;
    const warnScroll = () => {
      const now = Date.now();
      if (now - lastScrollNotify > 1500) {
        lastScrollNotify = now;
        notify(ti.scrollOff, "info");
      }
    };
    const onWheel = (e: WheelEvent) => {
      // allow the wheel only over a panel area that can actually scroll
      // (the element list / the class palette); block everything else
      let n = e.target as HTMLElement | null;
      while (n && n !== document.body) {
        const s = getComputedStyle(n);
        if (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          n.scrollHeight > n.clientHeight &&
          n.closest("[data-inspector-ui]")
        )
          return;
        n = n.parentElement;
      }
      e.preventDefault();
      warnScroll();
    };
    const scrollKeys = new Set([
      " ",
      "PageUp",
      "PageDown",
      "Home",
      "End",
    ]);
    const onScrollKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea") || t?.isContentEditable) return;
      if (scrollKeys.has(e.key)) {
        e.preventDefault();
        warnScroll();
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("keydown", onScrollKey, true);
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("pointerdown", onPointerDownPage, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("keydown", onScrollKey, true);
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("pointerdown", onPointerDownPage, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [active, cancel, notify]);

  // keep outlines pinned to their elements' LIVE boxes every frame, so they stay
  // aligned and never stick to a stale position after the element moves/resizes
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      if (!dragging) {
        const sel = selectedRef.current;
        const its = itemsRef.current;
        for (let i = 0; i < its.length; i++) {
          if (sel != null && i !== sel) continue;
          const div = outlineRefs.current[i];
          const el = its[i]?.el;
          if (!div || !el || !el.isConnected) continue;
          const r = el.getBoundingClientRect();
          div.style.left = `${r.left}px`;
          div.style.top = `${r.top}px`;
          div.style.width = `${r.width}px`;
          div.style.height = `${r.height}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, dragging]);

  // responsive preview: resize the (floating) selected element only — it's out of
  // flow so this never pushes other elements; the selection effect restores on exit
  useEffect(() => {
    const el =
      selectedIdx != null ? itemsRef.current[selectedIdx]?.el ?? null : null;
    if (!el || !floatBaseWRef.current) return;
    const w = previewW != null ? previewW : floatBaseWRef.current;
    el.style.transition = resizeSmoothRef.current
      ? "width 0.5s cubic-bezier(0.32, 0.72, 0, 1)"
      : "none";
    el.style.width = `${w}px`;
    el.style.maxWidth = "calc(100% - 32px)";
  }, [selectedIdx, previewW, items]);

  // breakpoint variants follow the window, not the element's width — so for a narrower
  // preview, drop the ones that wouldn't match at previewW (subtree included); a node is
  // restored only if nothing else (applyClass, cancel's revert) rewrote it meanwhile
  useEffect(() => {
    const root =
      selectedIdx != null ? itemsRef.current[selectedIdx]?.el ?? null : null;
    if (!root || previewW == null) return;
    const shown = new Map<HTMLElement, { full: string; preview: string }>();
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
      const full = el.getAttribute("class") ?? "";
      const preview = classesAtWidth(full, previewW);
      if (preview === full) continue;
      el.setAttribute("class", preview);
      el.dataset.ufClass = full;
      shown.set(el, { full, preview });
    }
    return () => {
      shown.forEach(({ full, preview }, el) => {
        delete el.dataset.ufClass;
        if (el.getAttribute("class") === preview) el.setAttribute("class", full);
      });
    };
  }, [selectedIdx, previewW, shownClass]);

  // a class picked but not yet saved has no CSS (Tailwind only emits what's in source
  // files), so compile one sheet for every class on the page plus the edit. it's appended
  // after the main stylesheet, so it must hold all of them to keep Tailwind's rule order
  useEffect(() => {
    if (selectedIdx == null || shownClass === origClassRef.current) return;
    const classes = new Set(shownClass.split(/\s+/).filter(Boolean));
    document.querySelectorAll<HTMLElement>("[class]").forEach((el) => {
      const cls = el.dataset.ufClass ?? el.getAttribute("class") ?? "";
      cls.split(/\s+/).forEach((c) => c && classes.add(c));
    });
    const ctrl = new AbortController();
    fetch("/api/tw-css", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classes: [...classes] }),
      signal: ctrl.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) return;
        let style = document.getElementById(RUNTIME_CSS_ID);
        if (!style) {
          style = document.createElement("style");
          style.id = RUNTIME_CSS_ID;
          document.head.appendChild(style);
        }
        style.textContent = data.css;
        setRuntimeCssVersion((v) => v + 1);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [selectedIdx, shownClass]);

  useEffect(() => {
    if (!active) document.getElementById(RUNTIME_CSS_ID)?.remove();
  }, [active]);

  useEffect(() => {
    const el =
      selectedIdx != null ? itemsRef.current[selectedIdx]?.el ?? null : null;
    if (!el || !closeOnOutside || confirmActive) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || el.contains(t) || t.closest("[data-inspector-ui]")) return;
      e.preventDefault();
      e.stopPropagation();
      cancel();
    };
    window.addEventListener("click", onOutside, true);
    return () => window.removeEventListener("click", onOutside, true);
  }, [selectedIdx, closeOnOutside, confirmActive, cancel]);

  // what the selected element is in the page layout, for the picker's "has no effect" hints.
  // read from a hidden stand-in (same tag + classes, same parent): the lifted element itself
  // is position:fixed, which blockifies its display. inserted and removed before any paint
  useEffect(() => {
    const el =
      selectedIdx != null ? itemsRef.current[selectedIdx]?.el ?? null : null;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const probe = document.createElement(el.tagName);
    probe.setAttribute("class", el.getAttribute("class") ?? "");
    probe.style.visibility = "hidden";
    parent.insertBefore(probe, el);
    const cs = getComputedStyle(probe);
    setElContext({
      tag: el.tagName.toLowerCase(),
      display: cs.display,
      position: cs.position,
      overflow: cs.overflow,
      columnCount: cs.columnCount,
      parentDisplay: getComputedStyle(parent).display,
    });
    probe.remove();
  }, [selectedIdx, editClass, previewW, runtimeCssVersion]);

  useEffect(() => {
    const main = editRoot();
    if (!main) return;
    const on = active && showPalette && hoverTag != null && selectedIdx == null;
    main.style.transition = "filter 0.2s ease";
    main.style.filter = on ? "blur(6px)" : "";
    return () => {
      main.style.filter = "";
    };
  }, [active, showPalette, hoverTag, selectedIdx]);

  // tag every element inside <main> with its document-order index (data-sid) once per
  // session — the structure save maps these back to source JSX nodes in the same order
  useEffect(() => {
    if (!active) return;
    const main = editRoot();
    if (!main) return;
    const els = Array.from(main.querySelectorAll<HTMLElement>("*")).filter(
      (el) => {
        if (el.closest("[data-preview-children]")) return false;
        const comp = el.closest("[data-component]");
        return !comp || comp === el;
      }
    );
    els.forEach((el, i) => {
      el.dataset.sid = String(i);
    });
    setStructDirty(false);
    undoStack.current = [];
    setChanges([]);
    return () => els.forEach((el) => delete el.dataset.sid);
  }, [active]);

  // hard-lock page scroll while inspecting (so dragging the scrollbar can't scroll
  // either). no width compensation: html's `scrollbar-gutter: stable` (globals.css)
  // already keeps the scrollbar's space, so adding padding shifted the page by it
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevOverflow;
    };
  }, [active]);

  const choose = (i: number) => {
    setFocus(i);
    setSelectedIdx(i);
  };

  const requestStarted = useRef(false);
  useEffect(() => {
    if (!request) return;
    if (blocked) {
      onRequestDone?.();
      return;
    }
    if (!active) {
      if (!requestStarted.current) {
        requestStarted.current = true;
        start();
      }
      return;
    }
    requestStarted.current = false;
    if (items.length === 0) return;
    const idx = items.findIndex((it) => it.el === request);
    onRequestDone?.();
    if (idx < 0) notify(ti.cantSelect, "info");
    else requestAnimationFrame(() => choose(idx));
  });

  return (
    <>
      {!blocked && !active && (
        <button
          type="button"
          className={styles.trigger}
          onClick={start}
          aria-label={ti.selectEl}
                    data-inspector-ui
        >
          <MousePointerSquareDashed size={20} />
          <Tooltip side="left" label={ti.selectElTip} />
        </button>
      )}

      {active &&
        typeof document !== "undefined" &&
        createPortal(
          <>
          {selectedIdx != null && !dragging && (
            <div
              className={styles.dim}
              style={{
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                opacity: closing || deselecting ? 0 : 1,
              }}
              aria-hidden
            />
          )}
          {hintShown.mounted && hint && (
            <div
              className={`${styles.dropParent} ${hintShown.leaving ? styles.dropOut : ""}`}
              style={{
                top: hint.parent.top,
                left: hint.parent.left,
                width: hint.parent.width,
                height: hint.parent.height,
              }}
              aria-hidden
            >
              <span
                className={`${styles.dropParentLabel} ${
                  hint.parent.top < 32 ? styles.dropParentLabelIn : ""
                }`}
              >
                {ti.dropInto(hint.parent.label)}
              </span>
            </div>
          )}
          {hintShown.mounted &&
            hint?.kids.map((k, i) => (
              <div
                key={i}
                className={`${styles.dropKid} ${hintShown.leaving ? styles.dropOut : ""}`}
                style={{ top: k.top, left: k.left, width: k.width, height: k.height }}
                aria-hidden
              >
                <span className={styles.dropKidLabel}>{k.label}</span>
              </div>
            ))}
          {hintShown.mounted && hint && (
            <div
              className={`${styles.dropHint} ${hintShown.leaving ? styles.dropOut : ""}`}
              style={{
                top: hint.top,
                left: hint.left,
                width: hint.width,
                height: hint.height,
              }}
              aria-hidden
            >
              <span className={styles.dropHintLabel}>{hint.label}</span>
            </div>
          )}
          <div
            className={`${styles.layer} ${
              closing ? styles.layerOut : dragging ? styles.layerHidden : ""
            }`}
            aria-hidden
          >
            {items.map((it, i) => {
              const sel = selectedIdx != null;
              const isSel = i === selectedIdx;
              // when an element is selected, hide all other outlines; the selected
              // one follows the element to its lifted position (top → 20)
              const away: CSSProperties =
                (sel && !isSel) || (isSel && !showSelOutline) ? { opacity: 0 } : {};
              return (
                <div
                  key={i}
                  ref={(node) => {
                    outlineRefs.current[i] = node;
                    if (node) {
                      const r = it.el.getBoundingClientRect();
                      node.style.left = `${r.left}px`;
                      node.style.top = `${r.top}px`;
                      node.style.width = `${r.width}px`;
                      node.style.height = `${r.height}px`;
                    }
                  }}
                  className={`${styles.outline} ${i === focus ? styles.outlineOn : ""}`}
                  style={{
                    borderColor: it.color,
                    background:
                      i === focus
                        ? `color-mix(in srgb, ${it.color} 14%, transparent)`
                        : "transparent",
                    zIndex: i === focus ? 1000 : 1,
                    ...away,
                  }}
                >
                </div>
              );
            })}

            {items.length > 0 && selectedIdx == null && (
              <div
                className={`${styles.legend} ${closing ? styles.legendOut : ""}`}
                data-inspector-ui
              >
                <div className={styles.legendHead}>
                  <span>{ti.allElements(items.length)}</span>
                  <button
                    type="button"
                    className={styles.legendClose}
                    onClick={cancel}
                    aria-label={ti.cancelEsc}
                  >
                    <X size={14} />
                  </button>
                </div>
                <OverlayScroll viewportClassName={styles.legendScroll}>
                {items.map((it, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`${styles.legendRow} ${i === focus ? styles.legendRowOn : ""}`}
                    style={{ paddingInlineStart: 8 + Math.min(it.info.depth, 6) * 12 }}
                    onMouseEnter={() => setFocus(i)}
                    onClick={() => {
                      setFocus(i);
                      setLocked(true);
                    }}
                    onDoubleClick={() => choose(i)}
                  >
                    <span
                      className={styles.legendSwatch}
                      style={{ background: it.color }}
                    />
                    <span className={styles.legendTag}>
                      {`<${it.info.tag}>`}
                      {it.info.id && (
                        <span className={styles.legendId}>#{it.info.id}</span>
                      )}
                      {it.info.cls.length > 0 && (
                        <span className={styles.legendCls}>
                          .{it.info.cls.slice(0, 3).join(".")}
                          {it.info.cls.length > 3 ? "…" : ""}
                        </span>
                      )}
                    </span>
                    <span className={styles.legendDim}>
                      {it.info.w}×{it.info.h}
                    </span>
                  </button>
                ))}
                </OverlayScroll>
              </div>
            )}

            {selectedIdx != null && items[selectedIdx] && (
              items[selectedIdx].el.dataset.component ? (
              <div className={styles.editPanel} data-inspector-ui>
                <div className={styles.panelHead}>
                  <span className={styles.panelTag}>
                    {`<${items[selectedIdx].el.dataset.component} />`}
                  </span>
                  <button
                    type="button"
                    className={styles.panelClose}
                    onClick={cancel}
                    aria-label={tx.common.close}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className={styles.instanceBody}>
                  <span>{ti.isComponent}</span>
                  {items[selectedIdx].el.dataset.componentHref && (
                    <a
                      className={styles.instanceLink}
                      href={items[selectedIdx].el.dataset.componentHref}
                    >
                      {ti.goComponent}
                    </a>
                  )}
                </div>
              </div>
              ) : (
              <>
              <div
                className={`${styles.editTop} ${
                  deselecting || closing ? styles.editTopOut : ""
                }`}
                data-inspector-ui
              >
                <SelectedClasses
                  value={editClass}
                  onChange={applyClass}
                  style={{
                    maxWidth: "100%",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    borderRadius: 24,
                  }}
                />
              </div>
              <div
                className={`${styles.editHeadTools} ${
                  deselecting || closing ? styles.editToolsOut : ""
                }`}
                data-inspector-ui
              >
                <button
                  type="button"
                  className={styles.editHeadTool}
                  onClick={() => applyClass(origClassRef.current)}
                  disabled={editClass === origClassRef.current}
                  aria-label={ti.resetOriginal}
                >
                  <RotateCcw size={16} />
                  <Tooltip side="right" label={ti.resetOriginal} />
                </button>
                <button
                  type="button"
                  className={styles.editHeadTool}
                  onClick={clearAllClasses}
                  disabled={!editClass.trim()}
                  aria-label={ti.clearAll}
                >
                  <Trash2 size={16} />
                  <Tooltip side="right" label={ti.clearAll} />
                </button>
                <button
                  type="button"
                  className={`${styles.editHeadTool} ${showCustom ? styles.editHeadToolOn : ""}`}
                  onClick={() => {
                    setShowCustom((v) => !v);
                    setShowSearch(false);
                  }}
                  aria-label={ti.custom}
                >
                  <Plus size={16} />
                  <Tooltip side="right" label={ti.custom} />
                </button>
                <button
                  type="button"
                  className={`${styles.editHeadTool} ${showClone ? styles.editHeadToolOn : ""}`}
                  onClick={() => setShowClone((v) => !v)}
                  aria-label={ti.cloneClass}
                >
                  <Copy size={16} />
                  <Tooltip side="right" label={ti.cloneClass} />
                </button>
                <button
                  type="button"
                  className={styles.editHeadTool}
                  onClick={copySelected}
                  aria-label={tx.shortcuts.copyEl}
                >
                  <Copy size={16} />
                  <Tooltip side="right" label={`${tx.shortcuts.copyEl} (Ctrl+C)`} />
                </button>
              </div>
              <div
                className={`${styles.editPanel} ${panelMin ? styles.editPanelMin : ""} ${
                  deselecting || closing ? styles.editOut : ""
                }`}
                ref={editPanelRef}
                style={showClone ? { display: "none" } : panelMin ? { height: panelMinH } : undefined}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setFootOpen(r.bottom - e.clientY <= FOOT_ZONE);
                }}
                onMouseLeave={() => setFootOpen(false)}
                data-inspector-ui
              >
                <div className={styles.panelHead}>
                  <span className={styles.panelTag}>
                    {`<${items[selectedIdx].info.tag}>`}
                  </span>
                  <div className={styles.respSeg} role="group" aria-label={ti.screenSize}>
                    <button
                      type="button"
                      className={`${styles.respSegBtn} ${previewW === 375 ? styles.respSegBtnOn : ""}`}
                      onClick={() => {
                        resizeSmoothRef.current = true;
                        setPreviewW(375);
                      }}
                      aria-label={ti.mobile}
                    >
                      <Smartphone size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.respSegBtn} ${previewW === 768 ? styles.respSegBtnOn : ""}`}
                      onClick={() => {
                        resizeSmoothRef.current = true;
                        setPreviewW(768);
                      }}
                      aria-label={ti.tablet}
                    >
                      <Tablet size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.respSegBtn} ${previewW === Math.min(1280, baseW) ? styles.respSegBtnOn : ""}`}
                      onClick={() => {
                        resizeSmoothRef.current = true;
                        setPreviewW(Math.min(1280, baseW));
                      }}
                      aria-label={ti.desktop}
                    >
                      <Monitor size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.respSegBtn} ${previewW === null ? styles.respSegBtnOn : ""}`}
                      onClick={() => {
                        resizeSmoothRef.current = true;
                        setPreviewW(null);
                      }}
                      aria-label={ti.full}
                    >
                      <Maximize size={15} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`${styles.respIcon} ${editDark ? styles.respIconOn : ""}`}
                    onClick={() => setEditDark((v) => !v)}
                    aria-label={ti.darkMode}
                  >
                    <Moon size={15} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.respIcon} ${onlySelected ? styles.respIconOn : ""}`}
                    onClick={() => setOnlySelected((v) => !v)}
                    aria-pressed={onlySelected}
                    aria-label={ti.onlySelected}
                  >
                    <ListChecks size={15} />
                    <Tooltip side="bottom" label={ti.onlySelected} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.respIcon} ${showSearch ? styles.respIconOn : ""}`}
                    onClick={() => {
                      setShowSearch((v) => !v);
                      setShowCustom(false);
                    }}
                    aria-pressed={showSearch}
                    aria-label={ti.searchClass}
                  >
                    <Search size={15} />
                    <Tooltip side="bottom" label={ti.searchClass} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.respIcon} ${showSelOutline ? styles.respIconOn : ""}`}
                    onClick={() => setShowSelOutline((v) => !v)}
                    aria-pressed={showSelOutline}
                    aria-label={ti.showOutline}
                  >
                    <SquareDashed size={15} />
                    <Tooltip side="bottom" label={ti.showOutline} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.respIcon} ${closeOnOutside ? styles.respIconOn : ""}`}
                    onClick={() => setCloseOnOutside((v) => !v)}
                    aria-pressed={closeOnOutside}
                    aria-label={ti.closeOutside}
                  >
                    <PanelBottomClose size={15} />
                    <Tooltip side="bottom" label={ti.closeOutside} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.respIcon} ${hoverPreview ? styles.respIconOn : ""}`}
                    onClick={() => setHoverPreview((v) => !v)}
                    aria-pressed={hoverPreview}
                    aria-label={ti.hoverPreview}
                  >
                    <Eye size={15} />
                    <Tooltip side="bottom" label={ti.hoverPreview} />
                  </button>
                  <span className={styles.respNum}>
                    {previewW ? `${previewW}px` : ti.fullWidth(baseW)}
                    {classPrefix && ` · ${classPrefix}`}
                  </span>
                  <input
                    type="range"
                    className={styles.respSlider}
                    min={320}
                    max={Math.max(baseW, 320)}
                    step={1}
                    value={previewW ?? baseW}
                    onChange={(e) => {
                      resizeSmoothRef.current = false;
                      setPreviewW(Number(e.target.value));
                    }}
                  />
                  <button
                    type="button"
                    className={styles.panelClose}
                    onClick={togglePanelMin}
                    aria-label={panelMin ? ti.expandPanel : ti.minimizePanel}
                    aria-expanded={!panelMin}
                  >
                    {panelMin ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <Tooltip side="top" label={panelMin ? ti.expandPanel : ti.minimizePanel} />
                  </button>
                  <button
                    type="button"
                    className={styles.panelClose}
                    onClick={cancel}
                    aria-label={tx.common.close}
                  >
                    <X size={16} />
                  </button>
                </div>
                <ClassPicker
                  value={editClass}
                  onChange={applyClass}
                  onPreview={hoverPreview ? previewClass : undefined}
                  prefix={classPrefix}
                  context={elContext}
                  showSearch={showSearch}
                  showCustom={showCustom}
                  onCloseSearch={() => setShowSearch(false)}
                  onCloseCustom={() => setShowCustom(false)}
                  onlySelected={onlySelected}
                />
                <div className={`${styles.editActions} ${footOpen ? styles.editActionsOn : ""}`}>
                  <span className={styles.editStatus}>
                    {editDirty ? ti.dirty : ti.clean}
                  </span>
                  <button
                    type="button"
                    className={styles.editSave}
                    onClick={saveToFile}
                    disabled={!editDirty}
                  >
                    <Save size={16} />
                    {tx.common.save}
                  </button>
                </div>
              </div>
              {showClone && (
                <>
                  <div
                    className={styles.cloneBackdrop}
                    data-inspector-ui
                    onClick={() => setShowClone(false)}
                  />
                  <div className={styles.cloneSheet} data-inspector-ui>
                    <div className={styles.paletteHead}>
                      <span>{ti.cloneFrom(items[selectedIdx].info.tag)}</span>
                      <button
                        type="button"
                        className={styles.legendClose}
                        onClick={() => setShowClone(false)}
                        aria-label={tx.common.close}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {cloneSources.length === 0 ? (
                      <div className={styles.cloneEmpty}>
                        {ti.cloneNone(items[selectedIdx].info.tag)}
                      </div>
                    ) : (
                      <OverlayScroll viewportClassName={styles.paletteBody}>
                        {cloneSources.map((s) => (
                          <div
                            key={s.cls}
                            className={styles.cloneRow}
                            onClick={() => {
                              applyClass(s.cls);
                              setShowClone(false);
                            }}
                          >
                            <div
                              className={styles.clonePreview}
                              dangerouslySetInnerHTML={{ __html: s.html }}
                            />
                            <span className={styles.cloneCls}>{s.cls}</span>
                            <span className={styles.cloneCopy} aria-hidden>
                              <Copy size={16} />
                            </span>
                          </div>
                        ))}
                      </OverlayScroll>
                    )}
                  </div>
                </>
              )}
              </>
              )
            )}

            {tipShown.mounted && (
              <div
                className={`${styles.dragTip} ${
                  closing || tipShown.leaving ? styles.slideDownOut : styles.riseIn
                }`}
                data-inspector-ui
              >
                <kbd className={styles.kbd}>Ctrl</kbd>
                <span>{ti.dragHint}</span>
              </div>
            )}

            {toolsShown.mounted && (
              <div
                className={`${styles.bottomTools} ${
                  closing || toolsShown.leaving ? styles.slideDownOut : styles.riseIn
                }`}
                data-inspector-ui
              >
                {barBtnsShown.mounted && (
                  <button
                    type="button"
                    className={`${styles.exitMode} ${
                      barBtnsShown.leaving ? styles.collapseOut : styles.collapseIn
                    }`}
                    onClick={cancel}
                  >
                    <LogOut size={16} /> {ti.exitMode}
                  </button>
                )}
                {barBtnsShown.mounted && (
                  <button
                    type="button"
                    className={`${styles.paletteTrigger} ${
                      barBtnsShown.leaving ? styles.collapseOut : styles.collapseIn
                    }`}
                    onClick={() => setShowPalette(true)}
                  >
                    <Plus size={16} /> {ti.addElement}
                  </button>
                )}
                {barBtnsShown.mounted && (
                  <button
                    type="button"
                    className={`${styles.barIcon} ${
                      barBtnsShown.leaving ? styles.collapseOut : styles.collapseIn
                    }`}
                    onClick={copySelected}
                    disabled={!locked || focus == null}
                    aria-label={tx.shortcuts.copyEl}
                  >
                    <Copy size={18} />
                    <Tooltip side="top" label={`${tx.shortcuts.copyEl} (Ctrl+C)`} />
                  </button>
                )}
                <div
                  ref={trashRef}
                  className={`${styles.trashZone} ${trashHot ? styles.trashZoneHot : ""}`}
                  aria-label={ti.trash}
                >
                  <Trash2 size={18} />
                  {trashLabelShown.mounted && (
                    <span
                      className={trashLabelShown.leaving ? styles.collapseOut : styles.collapseIn}
                    >
                      {ti.trash}
                    </span>
                  )}
                  {!dragging && <Tooltip side="top" label={ti.trashTip} />}
                </div>
              </div>
            )}

            {previewShown.mounted && previewTag && (
              <div
                className={`${styles.elPreview} ${previewShown.leaving ? styles.elPreviewOut : ""}`}
                data-inspector-ui
              >
                <div className={styles.elPreviewMock}>{renderMock(previewTag)}</div>
                <div className={styles.elPreviewInfo}>
                  <div className={styles.elPreviewTag}>{`<${previewTag}>`}</div>
                  <div className={styles.elPreviewDesc}>
                    {ti.tagDesc[previewTag] ?? "element"}
                  </div>
                </div>
              </div>
            )}

            {paletteShown.mounted && (
              <div
                className={`${styles.palette} ${paletteShown.leaving ? styles.paletteOut : ""}`}
                data-inspector-ui
              >
                <div className={styles.paletteHead}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["el", "comp"] as const).map((tb) => (
                      <button
                        key={tb}
                        type="button"
                        className={styles.paletteTag}
                        aria-pressed={paletteTab === tb}
                        style={
                          paletteTab === tb
                            ? { borderColor: "var(--accent)", color: "var(--accent)" }
                            : undefined
                        }
                        onClick={() => setPaletteTab(tb)}
                      >
                        {tb === "el" ? <Box size={14} /> : <ComponentIcon size={14} />}
                        {tb === "el" ? "Element" : "Component"}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={styles.legendClose}
                    onClick={() => setShowPalette(false)}
                    aria-label={tx.common.close}
                  >
                    <X size={14} />
                  </button>
                </div>
                <OverlayScroll viewportClassName={styles.paletteBody}>
                  <div key={`${paletteTab}|${compCat}|${compName}`} className={styles.swapIn}>
                  {paletteTab === "el" ? (
                    EL_GROUPS.map((g) => (
                      <div key={g.label} className={styles.paletteGroup}>
                        <div className={styles.paletteLabel}>{g.label}</div>
                        <div className={styles.paletteTags}>
                          {g.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className={styles.paletteTag}
                              onPointerDown={(e) => onPalettePointerDown(tag, e)}
                              onMouseEnter={() => setHoverTag(tag)}
                              onMouseLeave={() =>
                                setHoverTag((t) => (t === tag ? null : t))
                              }
                            >
                              {`<${tag}>`}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    !compCat ? (
                      <div className={styles.paletteGroup}>
                        <div className={styles.paletteLabel}>{ti.category}</div>
                        <div className={styles.paletteTags}>
                          {COMP_CATS.map((c) => (
                            <button
                              key={c.label}
                              type="button"
                              className={styles.paletteTag}
                              onClick={() => {
                                setCompCat(c.label);
                                setCompName("");
                              }}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : !compName ? (
                      <div className={styles.paletteGroup}>
                        <div
                          className={styles.paletteLabel}
                          style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                          <button
                            type="button"
                            className={styles.paletteTag}
                            onClick={() => setCompCat("")}
                          >
                            <ArrowLeft size={14} /> {tx.common.back}
                          </button>
                          <span>{compCat}</span>
                        </div>
                        <div className={styles.paletteTags}>
                          {(
                            COMP_CATS.find((c) => c.label === compCat)?.comps ?? []
                          ).map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={styles.paletteTag}
                              onClick={() => setCompName(n)}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                        <div className={styles.paletteGroup}>
                          <div
                            className={styles.paletteLabel}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <button
                              type="button"
                              className={styles.paletteTag}
                              onClick={() => setCompName("")}
                            >
                              <ArrowLeft size={14} /> {tx.common.back}
                            </button>
                            <span>{`${compCat} / ${compName}`}</span>
                          </div>
                          <div
                            className={styles.paletteTags}
                            style={{ alignItems: "center" }}
                          >
                            <select
                              className="text-label-md"
                              style={SEL_STYLE}
                              value={insVariant}
                              onChange={(e) => setInsVariant(e.target.value)}
                            >
                              {Object.keys(buttonClasses.styles).map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <select
                              className="text-label-md"
                              style={SEL_STYLE}
                              value={insTone}
                              onChange={(e) => setInsTone(e.target.value)}
                            >
                              {Object.keys(buttonClasses.styles.solid).map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.paletteLabel}>
                            {ti.dragSample}
                          </div>
                          <div className={styles.paletteTags}>
                            <button
                              type="button"
                              className={btnClass(insVariant, insTone)}
                              style={{ cursor: "grab" }}
                              onPointerDown={(e) =>
                                onPalettePointerDown("button", e, {
                                  name: BTN_IMPORT.name,
                                  from: BTN_IMPORT.from,
                                  html: btnHtml(insVariant, insTone, ti.sample.button),
                                  className: btnClass(insVariant, insTone),
                                })
                              }
                            >
                              {ti.sample.button}
                            </button>
                          </div>
                        </div>
                      )
                  )}
                  </div>
                </OverlayScroll>
              </div>
            )}

            {structShown.mounted && (
              <div
                className={`${styles.structBar} ${
                  closing || structShown.leaving ? styles.slideDownOut : styles.riseIn
                }`}
                data-inspector-ui
              >
                {changesShown.mounted && (
                  <div
                    className={`${styles.changeList} ${
                      changesShown.leaving ? styles.fadeOut : styles.riseIn
                    }`}
                  >
                  <OverlayScroll viewportClassName={styles.changeScroll}>
                  <ol className={styles.changeOl}>
                    {changes
                      .map((label, i) => (
                        <li key={i} className={styles.changeItem}>
                          <span className={styles.changeNum}>{i + 1}</span>
                          {label}
                        </li>
                      ))
                      .reverse()}
                  </ol>
                  </OverlayScroll>
                  <p className={styles.changeHint}>{ti.undoHint}</p>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.structMsg}
                  onClick={() => setShowChanges((v) => !v)}
                  aria-expanded={showChanges}
                  disabled={changes.length === 0}
                >
                  {ti.structureEdits(changes.length)}
                  {changes.length > 0 && (
                    <ChevronUp
                      size={14}
                      className={showChanges ? undefined : styles.changeChevronDown}
                    />
                  )}
                </button>
                <button
                  type="button"
                  className={styles.structReset}
                  onClick={resetStructure}
                >
                  <RotateCcw size={14} /> {ti.resetBtn}
                </button>
                <button
                  type="button"
                  className={styles.structSave}
                  onClick={saveStructure}
                >
                  <Save size={14} /> {tx.common.save}
                </button>
              </div>
            )}

          </div>
          </>,
          document.body
        )}
    </>
  );
}
