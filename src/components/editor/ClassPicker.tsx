"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Plus, Search, X } from "lucide-react";
import { TAILWIND_CATEGORIES, type ClassCategory } from "@/lib/tailwindClasses";
import { TAILWIND_COLOR_VALUES } from "@/lib/tailwindColors";
import { usePresence } from "@/lib/usePresence";
import { addClasses, inheritedClasses } from "@/lib/classMerge";
import { blockedReason, type ElementContext } from "@/lib/classApplicability";
import { useEditorT } from "@/i18n/editor/useEditorT";
import { useConfirm } from "@/components/editor/Confirm";
import { useNotify } from "@/components/editor/Notify";
import { OverlayScroll } from "@/components/editor/OverlayScroll";
import styles from "./ClassPicker.module.css";

const GRADIENT_DIR: Record<string, string> = {
  t: "top",
  r: "right",
  b: "bottom",
  l: "left",
  tr: "top right",
  br: "bottom right",
};

const MORE_LIMIT = 60;
const SUGGEST_LIMIT = 12;
const REVEAL_MS = 250; // .reveal / .revealOut

// every class Tailwind can generate here (~23k) — fetched once, shared by all pickers
let fullListPromise: Promise<string[]> | null = null;
function loadFullList() {
  fullListPromise ??= fetch("/api/tw-classes")
    .then((res) => res.json())
    .then((data) => (data.ok ? (data.classes as string[]) : []))
    .catch(() => {
      fullListPromise = null;
      return [];
    });
  return fullListPromise;
}

// prefix matches first, then substring; negative values (-mt-4) only when asked for
function rankMatches(list: string[], q: string, limit: number, skip?: Set<string>) {
  const starts: string[] = [];
  const contains: string[] = [];
  for (const cls of list) {
    if (skip?.has(cls) || (cls.startsWith("-") && !q.startsWith("-"))) continue;
    if (cls.startsWith(q)) starts.push(cls);
    else if (contains.length < limit && cls.includes(q)) contains.push(cls);
  }
  return [...starts, ...contains].slice(0, limit);
}

// shared start of every class in a group, up to a dash ("p-0", "p-px" → "p-"); a group
// without one (display: block, flex…) gets no custom-value input
function groupStem(classes: string[]) {
  let stem = classes[0] ?? "";
  for (const c of classes) while (!c.startsWith(stem)) stem = stem.slice(0, -1);
  return stem.slice(0, stem.lastIndexOf("-") + 1);
}

// values the user typed into a group, keyed by stem; per-browser convenience only
const CUSTOM_KEY = "uf-custom-classes";
function readCustom(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeCustom(v: Record<string, string[]>) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(v));
  } catch {}
}

// a class is real only if Tailwind emits a rule for it (p-34, p-[13px] yes; p-fdf no)
async function isValidClass(cls: string) {
  try {
    const res = await fetch("/api/tw-css", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classes: [cls] }),
    });
    const data = await res.json();
    return !!data.ok && (data.css as string).includes("." + CSS.escape(cls));
  } catch {
    return false;
  }
}

function GroupAdd({
  stem,
  blocked,
  onAdd,
}: {
  stem: string;
  blocked: string | null;
  onAdd: (cls: string) => void;
}) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const tx = useEditorT();
  const submit = async () => {
    if (blocked) {
      notify(blocked, "info");
      return;
    }
    const value = v.trim().replace(/^-+/, "");
    if (!value || busy) return;
    const cls = stem + value;
    setBusy(true);
    const ok = await isValidClass(cls);
    setBusy(false);
    if (!ok) {
      notify(tx.picker.notTailwind(cls), "error");
      return;
    }
    onAdd(cls);
    setV("");
  };
  return (
    <span className={styles.groupAdd}>
      <span className={styles.groupAddStem}>{stem}</span>
      <input
        className={styles.groupAddInput}
        value={v}
        placeholder={tx.picker.value}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submit())}
        onMouseDown={() => blocked && notify(blocked, "info")}
        readOnly={!!blocked}
        spellCheck={false}
        aria-label={tx.picker.addValue(stem)}
      />
      <button
        type="button"
        className={styles.customAdd}
        onClick={submit}
        disabled={!v.trim() || busy}
        aria-label={tx.common.add}
      >
        <Plus size={13} />
      </button>
    </span>
  );
}

const CURATED = new Set(
  TAILWIND_CATEGORIES.flatMap((c) => c.groups.flatMap((g) => g.classes))
);

function swatchColor(token: string): string | null {
  const cls = token.replace(/^(?:[\w-]+:)+/, "");
  const dir = cls.match(/^bg-gradient-to-(\w+)$/);
  if (dir) return `linear-gradient(to ${GRADIENT_DIR[dir[1]]}, transparent 15%, var(--accent) 85%)`;
  const arb = cls.match(/^(?:bg|text|border|from|via|to)-\[(.+)\]$/);
  if (arb) return arb[1];
  const m = cls.match(/^(?:bg|text|border|from|via|to)-(.+)$/);
  if (!m) return null;
  const c = m[1];
  if (c === "transparent") return "transparent";
  return TAILWIND_COLOR_VALUES[c] ?? null;
}

function Chip({
  cls,
  on,
  inherited,
  onClick,
  onHover,
}: {
  cls: string;
  on: boolean;
  inherited: boolean;
  onClick: () => void;
  onHover?: (over: boolean) => void;
}) {
  const sw = swatchColor(cls);
  const tx = useEditorT();
  return (
    <button
      type="button"
      className={`${styles.chip} ${on ? styles.chipOn : inherited ? styles.chipInherited : ""}`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      title={inherited ? tx.picker.inheritedTip : undefined}
    >
      {sw && (
        <span
          className={`${styles.swatch} ${sw === "transparent" ? styles.swatchTransparent : ""}`}
          style={sw === "transparent" ? undefined : { background: sw }}
          aria-hidden
        />
      )}
      {cls}
    </button>
  );
}

export function SelectedClasses({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  style?: CSSProperties;
}) {
  const tx = useEditorT();
  const tokens = useMemo(() => value.split(/\s+/).filter(Boolean), [value]);
  const remove = (t: string) => onChange(tokens.filter((x) => x !== t).join(" "));

  // drag-to-scroll the row (scrollbar is hidden); suppress the chip click if dragged
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const dragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 5) return;
      d.moved = true;
      el.setPointerCapture(e.pointerId); // capture only once a real drag starts
    }
    el.scrollLeft = d.left - dx;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const el = ref.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragged.current = !!drag.current?.moved;
    drag.current = null;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  return (
    <div
      ref={ref}
      className={styles.selected}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClickCapture={onClickCapture}
    >
      {tokens.length === 0 ? (
        <span className={styles.empty}>{tx.picker.noneSelected}</span>
      ) : (
        tokens.map((t) => {
          const sw = swatchColor(t);
          return (
            <button
              key={t}
              type="button"
              className={styles.selectedChip}
              onClick={() => remove(t)}
              aria-label={tx.picker.remove(t)}
            >
              {sw && (
                <span
                  className={`${styles.swatch} ${sw === "transparent" ? styles.swatchTransparent : ""}`}
                  style={sw === "transparent" ? undefined : { background: sw }}
                  aria-hidden
                />
              )}
              {t}
              <X size={12} />
            </button>
          );
        })
      )}
    </div>
  );
}

export function ClassPicker({
  value,
  onChange,
  prefix = "",
  showSearch = false,
  showCustom = false,
  onCloseSearch,
  onCloseCustom,
  onlySelected = false,
  context,
  onPreview,
}: {
  value: string;
  onChange: (next: string) => void;
  // hovering a chip: the class string it would produce; null when the pointer leaves
  onPreview?: (next: string | null) => void;
  prefix?: string;
  showSearch?: boolean;
  showCustom?: boolean;
  onlySelected?: boolean;
  // the selected element's layout facts; without it (layout editor) every group is enabled
  context?: ElementContext;
  onCloseSearch?: () => void;
  onCloseCustom?: () => void;
}) {
  const [cat, setCat] = useState(TAILWIND_CATEGORIES[0].id);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [fullList, setFullList] = useState<string[]>([]);
  // the picker only mounts client-side, after user interaction — no SSR to mismatch
  const [customMap, setCustomMap] = useState(readCustom);
  const confirm = useConfirm();
  const notify = useNotify();
  const tx = useEditorT();
  const updateCustom = (stem: string, fn: (list: string[]) => string[]) =>
    setCustomMap((prev) => {
      const next = { ...prev, [stem]: fn(prev[stem] ?? []) };
      writeCustom(next);
      return next;
    });

  useEffect(() => {
    if (!showSearch && !showCustom) return;
    let live = true;
    loadFullList().then((list) => live && setFullList(list));
    return () => {
      live = false;
    };
  }, [showSearch, showCustom]);

  useEffect(() => {
    if (!showSearch) setQuery("");
  }, [showSearch]);
  useEffect(() => {
    if (!showCustom) setCustom("");
  }, [showCustom]);

  const tokens = useMemo(() => value.split(/\s+/).filter(Boolean), [value]);
  const active = useMemo(() => new Set(tokens), [tokens]);
  const inherited = useMemo(() => inheritedClasses(tokens, prefix), [tokens, prefix]);

  const toggled = (cls: string) => {
    const t = prefix + cls;
    return (active.has(t) ? tokens.filter((x) => x !== t) : addClasses(tokens, [t])).join(" ");
  };
  const toggle = (cls: string) => {
    onPreview?.(null);
    onChange(toggled(cls));
  };

  const addGroupValue = (stem: string, cls: string) => {
    if (!CURATED.has(cls)) updateCustom(stem, (l) => (l.includes(cls) ? l : [...l, cls]));
    if (!active.has(prefix + cls)) toggle(cls);
  };

  const removeGroupValue = async (stem: string, cls: string) => {
    const ok = await confirm({
      title: tx.picker.removeFromListQ(cls),
      message: tx.picker.removeFromListMsg,
      confirmText: tx.common.delete,
      danger: true,
    });
    if (!ok) return;
    updateCustom(stem, (l) => l.filter((c) => c !== cls));
  };

  const addCustom = (text = custom) => {
    const add = text
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => prefix + c);
    if (!add.length) return;
    onChange(addClasses(tokens, add).join(" "));
    setCustom("");
  };

  // autocomplete the word being typed (the last one), keeping what's before it
  const typing = custom.endsWith(" ") ? "" : (custom.split(/\s+/).pop() ?? "").toLowerCase();
  const suggestions = useMemo(
    () => (typing ? rankMatches(fullList, typing, SUGGEST_LIMIT) : []),
    [fullList, typing]
  );
  const pickSuggestion = (cls: string) =>
    addCustom(custom.slice(0, custom.length - typing.length) + cls);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return TAILWIND_CATEGORIES.flatMap((c) =>
      c.groups
        .map((g) => ({
          label: `${c.label} · ${g.label}`,
          classes: g.classes.filter((cls) => cls.toLowerCase().includes(q)),
          needs: g.needs,
        }))
        .filter((g) => g.classes.length > 0)
    );
  }, [q]);
  const moreResults = useMemo(
    () => (q ? rankMatches(fullList, q, MORE_LIMIT, CURATED) : []),
    [fullList, q]
  );

  // "selected only": hide the tabs that hold none of the applied classes; the tabs
  // that remain show in full so a value can still be swapped (w-full → w-1/2)
  const used = (c: ClassCategory) =>
    c.groups.some((g) => g.classes.some((cls) => active.has(prefix + cls)));
  const tabs = onlySelected ? TAILWIND_CATEGORIES.filter(used) : TAILWIND_CATEGORIES;
  const category = tabs.find((c) => c.id === cat) ?? tabs[0];
  const searchShown = usePresence(showSearch, REVEAL_MS);
  const customShown = usePresence(showCustom, REVEAL_MS);
  const tabsShown = usePresence(!showSearch && tabs.length > 0, REVEAL_MS);
  const groups = results
    ? [
        ...results,
        ...(moreResults.length
          ? [{ label: tx.picker.more(moreResults.length), classes: moreResults }]
          : []),
      ]
    : showSearch
      ? []
      : category?.groups ?? [];

  const reveal = (leaving: boolean) => `${styles.reveal} ${leaving ? styles.revealOut : ""}`;

  return (
    <div className={styles.picker}>
      {(searchShown.mounted || customShown.mounted) && (
        <div className={reveal(!showSearch && !showCustom)}>
        <div className={styles.controls}>
          {searchShown.mounted && (
            <div className={reveal(searchShown.leaving)}>
            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                value={query}
                placeholder={tx.picker.searchPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
                autoFocus
              />
              <button
                type="button"
                className={styles.searchClear}
                onClick={onCloseSearch}
                aria-label={tx.picker.cancelSearch}
              >
                <X size={13} />
              </button>
            </div>
            </div>
          )}
          {customShown.mounted && (
            <div className={reveal(customShown.leaving)}>
            <div className={styles.customBox}>
              <input
                className={styles.searchInput}
                value={custom}
                placeholder={tx.picker.customPlaceholder}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  } else if (e.key === "Tab" && suggestions[0]) {
                    e.preventDefault();
                    setCustom(custom.slice(0, custom.length - typing.length) + suggestions[0]);
                  }
                }}
                spellCheck={false}
                autoFocus
              />
              <button
                type="button"
                className={styles.customAdd}
                onClick={() => addCustom()}
                disabled={!custom.trim()}
                aria-label={tx.common.add}
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                className={styles.searchClear}
                onClick={onCloseCustom}
                aria-label={tx.picker.cancelCustom}
              >
                <X size={13} />
              </button>
            </div>
            </div>
          )}
          {showCustom && suggestions.length > 0 && (
            <div className={styles.suggest}>
              {suggestions.map((cls) => (
                <Chip
                  key={cls}
                  cls={cls}
                  on={active.has(prefix + cls)}
                  inherited={false}
                  onClick={() => pickSuggestion(cls)}
                />
              ))}
              <span className={styles.suggestHint}>{tx.picker.tabHint}</span>
            </div>
          )}
        </div>
        </div>
      )}

      <OverlayScroll viewportClassName={styles.scrollBody} jumpButtons>
        {tabsShown.mounted && (
          <div className={reveal(tabsShown.leaving)}>
          <div className={styles.tabs}>
            {tabs.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.tab} ${c.id === category?.id ? styles.tabOn : ""} ${
                  c.groups.every((g) => blockedReason(g.needs, context)) ? styles.tabBlocked : ""
                }`}
                onClick={() => setCat(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          </div>
        )}

        <div key={showSearch ? "search" : category?.id} className={`${styles.groups} ${styles.swapIn}`}>
          {groups.length === 0 ? (
            <div className={styles.noResult}>
              {q
                ? tx.picker.noMatch(query)
                : showSearch
                  ? tx.picker.typeToSearch
                  : tx.picker.noneApplied}
            </div>
          ) : (
            groups.map((g) => {
              const stem = g === groups[groups.length - 1] && moreResults === g.classes ? "" : groupStem(g.classes);
              const extra = stem
                ? (customMap[stem] ?? []).filter((c) => !g.classes.includes(c) && (!q || c.includes(q)))
                : [];
              const reason = "needs" in g ? blockedReason(g.needs, context) : null;
              const blocked = reason && context
                ? (tx.applicability[reason] as (tag: string) => string)(`<${context.tag}>`)
                : null;
              // blocked: adding is refused with the reason; an applied class can still be removed
              const pick = (cls: string) =>
                blocked && !active.has(prefix + cls) ? notify(blocked, "info") : toggle(cls);
              const hover = (cls: string) => (over: boolean) =>
                onPreview?.(over && !(blocked && !active.has(prefix + cls)) ? toggled(cls) : null);
              return (
                <div key={g.label} className={`${styles.group} ${blocked ? styles.groupBlocked : ""}`}>
                  <div className={styles.groupLabel}>
                    {g.label}
                    {blocked && <span className={styles.groupReason}>{blocked}</span>}
                  </div>
                  <div className={styles.chips}>
                    {g.classes.map((cls) => (
                      <Chip
                        key={cls}
                        cls={cls}
                        on={active.has(prefix + cls)}
                        inherited={inherited.has(cls)}
                        onClick={() => pick(cls)}
                        onHover={hover(cls)}
                      />
                    ))}
                    {extra.map((cls) => (
                      <span key={cls} className={styles.chipCustom}>
                        <Chip
                          cls={cls}
                          on={active.has(prefix + cls)}
                          inherited={inherited.has(cls)}
                          onClick={() => pick(cls)}
                          onHover={hover(cls)}
                        />
                        <button
                          type="button"
                          className={styles.chipRemove}
                          onClick={() => removeGroupValue(stem, cls)}
                          aria-label={tx.picker.removeFromList(cls)}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {stem && (
                      <GroupAdd stem={stem} blocked={blocked} onAdd={(cls) => addGroupValue(stem, cls)} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </OverlayScroll>
    </div>
  );
}
