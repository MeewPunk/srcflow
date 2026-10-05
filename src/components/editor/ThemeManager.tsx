"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Moon, Palette, RotateCcw, Save, Sun, X } from "lucide-react";
import {
  COLOR_TOKEN_KEYS,
  FONT_MONO_OPTIONS,
  FONT_SANS_OPTIONS,
  type ColorTokens,
  type FontMonoId,
  type FontSansId,
  type ThemeState,
} from "@/lib/theme";
import { useDrawerControl } from "@/components/editor/DrawerLayout";
import { useThemeMode } from "@/components/editor/ThemeMode";
import { useNotify } from "@/components/editor/Notify";
import { OverlayScroll } from "@/components/editor/OverlayScroll";
import { LayoutManager, LayoutTrigger } from "@/components/editor/LayoutManager";
import { useUnsavedGuard } from "@/components/editor/useUnsavedGuard";
import { useEditorT } from "@/i18n/editor/useEditorT";
import styles from "./ThemeManager.module.css";

function applyColors(tokens: ColorTokens) {
  const root = document.documentElement.style;
  for (const key of COLOR_TOKEN_KEYS) root.setProperty(`--${key}`, tokens[key]);
}
function clearColors() {
  const root = document.documentElement.style;
  for (const key of COLOR_TOKEN_KEYS) root.removeProperty(`--${key}`);
}
function applyRadius(px: number) {
  const root = document.documentElement.style;
  root.setProperty("--radius", `${px}px`);
  root.setProperty("--radius-xl", `${px + 6}px`);
  root.setProperty("--radius-lg", `${px}px`);
  root.setProperty("--radius-md", `${Math.max(0, px - 2)}px`);
}
function clearRadius() {
  const root = document.documentElement.style;
  for (const p of ["--radius", "--radius-xl", "--radius-lg", "--radius-md"]) {
    root.removeProperty(p);
  }
}

export function ThemeManager() {
  const notify = useNotify();
  const tx = useEditorT();
  const { hideLeft, showLeft, animMs, setOverlay } = useDrawerControl();
  const { mode: previewMode, setMode: setPreviewMode } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [theme, setTheme] = useState<ThemeState | null>(null);
  const [draft, setDraft] = useState<ThemeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | true | null>(null);

  const dirty = theme && draft && JSON.stringify(theme) !== JSON.stringify(draft);
  useUnsavedGuard(!!dirty);

  useEffect(() => {
    setOverlay(open || layoutOpen);
  }, [open, layoutOpen, setOverlay]);

  const openModal = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    hideLeft();
    setTimeout(() => setOpen(true), animMs);
  }, [hideLeft, animMs]);

  const closeModal = useCallback(() => {
    setOpen(false);
    showLeft();
  }, [showLeft]);

  // html & body replaces this modal (the left drawer stays hidden until it closes)
  const openLayout = useCallback(() => {
    setOpen(false);
    setLayoutOpen(true);
  }, []);
  const closeLayout = useCallback(() => {
    setLayoutOpen(false);
    showLeft();
  }, [showLeft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  useEffect(() => {
    if (!draft) return;
    if (previewMode === "light" || previewMode === "dark") {
      applyColors(draft[previewMode]);
    } else {
      clearColors();
    }
  }, [draft, previewMode]);

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        setTheme(data.theme);
        setDraft(data.theme);
      })
      .catch((e) => setError(e instanceof Error ? e.message : true));
  }, []);

  const radius = draft?.radius;
  const fontSans = draft?.fontSans;
  const fontMono = draft?.fontMono;

  useEffect(() => {
    if (radius != null) applyRadius(radius);
    return () => clearRadius();
  }, [radius]);

  useEffect(() => {
    if (!fontSans || !fontMono) return;
    document.documentElement.style.setProperty(
      "--font-sans",
      FONT_SANS_OPTIONS.find((f) => f.id === fontSans)?.value ?? ""
    );
    document.documentElement.style.setProperty(
      "--font-mono",
      FONT_MONO_OPTIONS.find((f) => f.id === fontMono)?.value ?? ""
    );
  }, [fontSans, fontMono]);

  const setColor = useCallback(
    (mode: "light" | "dark", key: keyof ColorTokens, value: string) => {
      setDraft((d) => (d ? { ...d, [mode]: { ...d[mode], [key]: value } } : d));
    },
    []
  );

  const reset = useCallback(() => setDraft(theme), [theme]);

  const save = useCallback(async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          light: draft.light,
          dark: draft.dark,
          pageGradient: draft.pageGradient,
          radius: draft.radius,
          fontSans: draft.fontSans,
          fontMono: draft.fontMono,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setTheme(data.theme);
      setDraft(data.theme);
      clearColors();
      clearRadius();
      if (previewMode === "light" || previewMode === "dark") {
        applyColors(data.theme[previewMode]);
      }
      notify(tx.theme.saved, "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : tx.common.saveFailed;
      setError(msg);
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }, [draft, previewMode, notify, tx]);

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.trigger} onClick={openModal}>
        <Palette size={16} />
        <span>{tx.theme.title}</span>
        {dirty && <span className={styles.dot} aria-hidden />}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.overlay} onClick={closeModal}>
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label={tx.theme.title}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHead}>
                <strong className={styles.modalTitle}>
                  <Palette size={18} /> {tx.theme.title}
                </strong>
                <button
                  className={styles.closeBtn}
                  onClick={closeModal}
                  aria-label={tx.common.close}
                >
                  <X size={16} />
                </button>
              </div>

              <OverlayScroll viewportClassName={styles.body}>
                {error && (
                  <div className={styles.error}>{error === true ? tx.theme.loadFailed : error}</div>
                )}
                {!draft ? (
                  <div className={styles.loading}>{tx.common.loading}</div>
                ) : (
                  <>
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{tx.theme.previewMode}</span>
                      <div className={styles.segmented}>
                        {(["system", "light", "dark"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`${styles.segBtn} ${
                              previewMode === m ? styles.segBtnOn : ""
                            }`}
                            onClick={() => setPreviewMode(m)}
                          >
                            {m === "system" ? <Monitor size={14} /> : m === "light" ? <Sun size={14} /> : <Moon size={14} />}
                            {tx.drawer.modes[m]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(["light", "dark"] as const).map((mode) => (
                      <div className={styles.field} key={mode}>
                        <span className={styles.fieldLabel}>
                          {tx.theme.colors(mode === "light")}
                        </span>
                        <div className={styles.colorGrid}>
                          {COLOR_TOKEN_KEYS.map((key) => (
                            <label key={key} className={styles.colorRow}>
                              <input
                                type="color"
                                className={styles.colorInput}
                                value={draft[mode][key]}
                                onChange={(e) => setColor(mode, key, e.target.value)}
                              />
                              <span className={styles.colorName}>
                                {tx.theme.tokens[key]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{tx.theme.radius}</span>
                      <input
                        type="range"
                        min={0}
                        max={28}
                        value={draft.radius}
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, radius: Number(e.target.value) } : d
                          )
                        }
                      />
                      <span className={styles.rangeValue}>{draft.radius}px</span>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{tx.theme.fontSans}</span>
                      <select
                        className={styles.select}
                        value={draft.fontSans}
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, fontSans: e.target.value as FontSansId } : d
                          )
                        }
                      >
                        {FONT_SANS_OPTIONS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>{tx.theme.fontMono}</span>
                      <select
                        className={styles.select}
                        value={draft.fontMono}
                        onChange={(e) =>
                          setDraft((d) =>
                            d ? { ...d, fontMono: e.target.value as FontMonoId } : d
                          )
                        }
                      >
                        {FONT_MONO_OPTIONS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={reset}
                        disabled={busy || !dirty}
                      >
                        <RotateCcw size={14} /> {tx.common.reset}
                      </button>
                      <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={save}
                        disabled={busy || !dirty}
                      >
                        <Save size={14} /> {tx.common.saveToFile}
                      </button>
                    </div>

                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>{tx.theme.other}</span>
                      <LayoutTrigger dirty={layoutDirty} onClick={openLayout} />
                    </div>
                  </>
                )}
              </OverlayScroll>
            </div>
          </div>,
          document.body
        )}
      <LayoutManager open={layoutOpen} onClose={closeLayout} onDirtyChange={setLayoutDirty} />
    </div>
  );
}
