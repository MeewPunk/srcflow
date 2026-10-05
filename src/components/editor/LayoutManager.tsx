"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Code2, Globe, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useNotify } from "@/components/editor/Notify";
import { useConfirm } from "@/components/editor/Confirm";
import { useEditorT } from "@/i18n/editor/useEditorT";
import { OverlayScroll } from "@/components/editor/OverlayScroll";
import { ClassPicker } from "@/components/editor/ClassPicker";
import { Button } from "@/app/ui/components/base/button/Button";
import { locales, type Locale } from "@/i18n/config";
import type { SiteMeta, SiteMetaByLocale } from "@/lib/siteMetaFs";
import { Tooltip } from "@/components/editor/Tooltip";
import { useUnsavedGuard } from "@/components/editor/useUnsavedGuard";
import styles from "./LayoutManager.module.css";

type StyleRow = { k: string; v: string };
type Draft = {
  htmlClass: string;
  bodyClass: string;
  htmlStyle: StyleRow[];
  bodyStyle: StyleRow[];
};
type Target = "html" | "body";
type Tab = Target | "site";
// keywords are edited as one comma-separated line, stored as a list
type MetaForm = Omit<SiteMeta, "keywords"> & { keywords: string };
type MetaDraft = Record<Locale, MetaForm>;

const toForm = (m: SiteMetaByLocale): MetaDraft =>
  Object.fromEntries(
    locales.map((l) => [l, { ...m[l], keywords: m[l].keywords.join(", ") }])
  ) as MetaDraft;
const fromForm = (d: MetaDraft): SiteMetaByLocale =>
  Object.fromEntries(
    locales.map((l) => [
      l,
      { ...d[l], keywords: d[l].keywords.split(",").map((k) => k.trim()).filter(Boolean) },
    ])
  ) as SiteMetaByLocale;

const toRows = (o: Record<string, string>): StyleRow[] =>
  Object.entries(o).map(([k, v]) => ({ k, v }));
const toObject = (rows: StyleRow[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const { k, v } of rows) {
    const key = k.trim();
    if (key && v.trim()) out[key] = v.trim();
  }
  return out;
};

// the "html & body" button shown in the theme manager; the modal itself is LayoutManager
export function LayoutTrigger({ dirty, onClick }: { dirty: boolean; onClick: () => void }) {
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.trigger} onClick={onClick}>
        <Code2 size={16} />
        <span>html &amp; body</span>
        {dirty && <span className={styles.dot} aria-hidden />}
      </button>
    </div>
  );
}

// controlled by ThemeManager, which closes its own modal when this one opens (and owns
// the drawer/overlay state for both)
export function LayoutManager({
  open,
  onClose,
  onDirtyChange,
}: {
  open: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const notify = useNotify();
  const confirm = useConfirm();
  const tx = useEditorT();
  const loadedRef = useRef(false);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | true | null>(null);
  const [tab, setTab] = useState<Tab>("html");
  // site-wide default title/description per language (dictionaries/{lang}.json)
  const [savedMeta, setSavedMeta] = useState<MetaDraft | null>(null);
  const [meta, setMeta] = useState<MetaDraft | null>(null);
  const [metaLang, setMetaLang] = useState<Locale>(locales[0]);

  const layoutDirty = !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft);
  const metaDirty = !!savedMeta && !!meta && JSON.stringify(savedMeta) !== JSON.stringify(meta);
  const dirty = layoutDirty || metaDirty;
  useUnsavedGuard(dirty);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    fetch("/api/layout")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        const d: Draft = {
          htmlClass: data.layout.htmlClass,
          bodyClass: data.layout.bodyClass,
          htmlStyle: toRows(data.layout.htmlStyle),
          bodyStyle: toRows(data.layout.bodyStyle),
        };
        setSaved(d);
        setDraft(d);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : true)
      );
    fetch("/api/site-meta")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        setSavedMeta(toForm(data.meta));
        setMeta(toForm(data.meta));
      })
      .catch((e) => setError(e instanceof Error ? e.message : true));
  }, [open]);

  const setMetaField = (field: keyof MetaForm, value: string) =>
    setMeta((m) => (m ? { ...m, [metaLang]: { ...m[metaLang], [field]: value } } : m));

  const setClass = (t: Target, value: string) =>
    setDraft((d) => (d ? { ...d, [`${t}Class`]: value } : d));

  const setRow = (t: Target, i: number, patch: Partial<StyleRow>) =>
    setDraft((d) => {
      if (!d) return d;
      const key = `${t}Style` as const;
      const rows = d[key].map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      return { ...d, [key]: rows };
    });

  const addRow = (t: Target) =>
    setDraft((d) =>
      d ? { ...d, [`${t}Style`]: [...d[`${t}Style`], { k: "", v: "" }] } : d
    );

  const removeRow = (t: Target, i: number) =>
    setDraft((d) =>
      d ? { ...d, [`${t}Style`]: d[`${t}Style`].filter((_, idx) => idx !== i) } : d
    );

  const reset = useCallback(() => {
    setDraft(saved);
    setMeta(savedMeta);
  }, [saved, savedMeta]);

  const save = useCallback(async () => {
    if (!draft || !meta) return;
    const ok = await confirm({
      title: tx.common.saveToFileQ,
      message: [layoutDirty && tx.layout.saveMessage, metaDirty && tx.layout.saveMetaMessage]
        .filter(Boolean)
        .join(" · "),
      confirmText: tx.common.save,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      if (metaDirty) {
        const res = await fetch("/api/site-meta", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fromForm(meta)),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setSavedMeta(toForm(data.meta));
        setMeta(toForm(data.meta));
      }
      if (!layoutDirty) {
        notify(tx.layout.saved, "success");
        return;
      }
      const res = await fetch("/api/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlClass: draft.htmlClass,
          bodyClass: draft.bodyClass,
          htmlStyle: toObject(draft.htmlStyle),
          bodyStyle: toObject(draft.bodyStyle),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const d: Draft = {
        htmlClass: data.layout.htmlClass,
        bodyClass: data.layout.bodyClass,
        htmlStyle: toRows(data.layout.htmlStyle),
        bodyStyle: toRows(data.layout.bodyStyle),
      };
      setSaved(d);
      setDraft(d);
      notify(tx.layout.saved, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : tx.common.saveFailed;
      setError(msg);
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }, [draft, meta, layoutDirty, metaDirty, notify, confirm, tx]);

  const renderTarget = (t: Target, rows: StyleRow[], cls: string) => (
    <div className={styles.group}>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>className (Tailwind)</span>
        <ClassPicker value={cls} onChange={(v) => setClass(t, v)} />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>inline style</span>
        <div className={styles.styleRows}>
          {rows.map((r, i) => (
            <div className={styles.styleRow} key={i}>
              <input
                className={styles.input}
                value={r.k}
                placeholder="backgroundColor"
                onChange={(e) => setRow(t, i, { k: e.target.value })}
                spellCheck={false}
              />
              <input
                className={styles.input}
                value={r.v}
                placeholder="#fff"
                onChange={(e) => setRow(t, i, { v: e.target.value })}
                spellCheck={false}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                tone="danger"
                onClick={() => removeRow(t, i)}
                aria-label={tx.layout.removeProp}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="soft"
            tone="accent"
            iconStart={<Plus size={14} />}
            onClick={() => addRow(t)}
          >
            {tx.layout.addProp}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    open &&
    typeof document !== "undefined" &&
    createPortal(
          <div className={styles.overlay} onClick={onClose}>
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label={tx.layout.title}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHead}>
                <strong className={styles.modalTitle}>
                  <Code2 size={18} /> {tx.layout.title}
                </strong>
                <Button
                  size="icon"
                  variant="ghost"
                  tone="neutral"
                  onClick={onClose}
                  aria-label={tx.common.close}
                >
                  <X size={16} />
                </Button>
              </div>

              <OverlayScroll viewportClassName={styles.body}>
                {error && (
                  <div className={styles.error}>{error === true ? tx.layout.loadFailed : error}</div>
                )}
                {!draft || !meta ? (
                  <div className={styles.loading}>{tx.common.loading}</div>
                ) : (
                  <>
                    <div className={styles.targetTabs}>
                      {(["html", "body"] as const).map((t) => (
                        <Button
                          key={t}
                          type="button"
                          size="sm"
                          variant={tab === t ? "solid" : "ghost"}
                          tone={tab === t ? "accent" : "neutral"}
                          onClick={() => setTab(t)}
                        >
                          {`<${t}>`}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant={tab === "site" ? "solid" : "ghost"}
                        tone={tab === "site" ? "accent" : "neutral"}
                        iconStart={<Globe size={14} />}
                        onClick={() => setTab("site")}
                      >
                        {tx.layout.siteTab}
                      </Button>
                    </div>

                    {tab === "site" ? (
                      <div className={styles.group}>
                        <p className={styles.hint}>{tx.layout.siteHint}</p>
                        <div className={styles.field}>
                          <span className={styles.fieldLabel}>{tx.layout.siteLang}</span>
                          <div className={styles.segmented}>
                            {locales.map((l) => (
                              <button
                                key={l}
                                type="button"
                                className={`${styles.segBtn} ${metaLang === l ? styles.segBtnOn : ""}`}
                                onClick={() => setMetaLang(l)}
                                aria-pressed={metaLang === l}
                              >
                                {l.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(
                          [
                            ["title", tx.layout.site.title, tx.layout.site.titleTip, false],
                            ["description", tx.layout.site.description, tx.layout.site.descriptionTip, true],
                            ["keywords", tx.layout.site.keywords, tx.layout.site.keywordsTip, false],
                            ["siteName", tx.layout.site.siteName, tx.layout.site.siteNameTip, false],
                            ["ogTitle", tx.layout.site.ogTitle, tx.layout.site.ogTitleTip, false],
                            ["ogDescription", tx.layout.site.ogDescription, tx.layout.site.ogDescriptionTip, true],
                          ] as const
                        ).map(([field, label, tip, multiline]) => (
                          <label key={field} className={styles.field}>
                            <span className={styles.fieldLabel}>{label}</span>
                            {multiline ? (
                              <textarea
                                className={styles.textArea}
                                value={meta[metaLang][field]}
                                rows={2}
                                placeholder={tx.layout.site.optional}
                                onChange={(e) => setMetaField(field, e.target.value)}
                              />
                            ) : (
                              <input
                                className={styles.textInput}
                                value={meta[metaLang][field]}
                                placeholder={field === "title" ? undefined : tx.layout.site.optional}
                                onChange={(e) => setMetaField(field, e.target.value)}
                              />
                            )}
                            <Tooltip side="top" label={tip} />
                          </label>
                        ))}
                      </div>
                    ) : tab === "html" ? (
                      renderTarget("html", draft.htmlStyle, draft.htmlClass)
                    ) : (
                      renderTarget("body", draft.bodyStyle, draft.bodyClass)
                    )}

                    <div className={styles.actions}>
                      <Button
                        type="button"
                        variant="ghost"
                        tone="neutral"
                        iconStart={<RotateCcw size={14} />}
                        onClick={reset}
                        disabled={busy || !dirty}
                      >
                        {tx.common.reset}
                      </Button>
                      <Button
                        type="button"
                        variant="solid"
                        tone="accent"
                        iconStart={<Save size={14} />}
                        onClick={save}
                        disabled={busy || !dirty}
                      >
                        {tx.common.saveToFile}
                      </Button>
                    </div>
                  </>
                )}
              </OverlayScroll>
            </div>
          </div>,
          document.body
        )
  );
}
