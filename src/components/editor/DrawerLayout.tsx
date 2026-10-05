"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Blocks,
} from "lucide-react";
import { Tooltip } from "@/components/editor/Tooltip";
import { localeOf, withLocale } from "@/i18n/config";
import { EDITOR_LANG_COOKIE } from "@/i18n/editor";
import { useEditorLang, useEditorT } from "@/i18n/editor/useEditorT";
import { RouteManager } from "@/components/editor/RouteManager";
import { ThemeManager } from "@/components/editor/ThemeManager";
import { ElementInspector } from "@/components/editor/ElementInspector";
import { PageInfo } from "@/components/editor/PageInfo";
import { ShortcutHelp } from "@/components/editor/ShortcutHelp";
import { OverlayScroll } from "@/components/editor/OverlayScroll";
import { ThemeModeProvider, useThemeMode, type ThemeMode } from "@/components/editor/ThemeMode";
import { ConfirmProvider } from "@/components/editor/Confirm";
import { NotifyProvider } from "@/components/editor/Notify";
import pkg from "../../../package.json";
import styles from "./DrawerLayout.module.css";

const LABELS = ["MENU", "LEFT"];
const RLABELS = ["INFO", "RIGHT"];
const ANIM_MS = 800;
const CLOSE_MS = 600;


type DrawerControl = {
  hideLeft: () => void;
  showLeft: () => void;
  hideRight: () => void;
  showRight: () => void;
  setChromeHidden: (hidden: boolean) => void;
  leftOpen: boolean;
  animMs: number;
  setOverlay: (active: boolean) => void;
};
const DrawerControlContext = createContext<DrawerControl>({
  hideLeft: () => {},
  showLeft: () => {},
  hideRight: () => {},
  showRight: () => {},
  setChromeHidden: () => {},
  leftOpen: false,
  animMs: ANIM_MS,
  setOverlay: () => {},
});
export const useDrawerControl = () => useContext(DrawerControlContext);

const MODE_ICON: Record<ThemeMode, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const MODE_NEXT: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system",
};

async function hardReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } finally {
    window.location.reload();
  }
}

function HardReloadButton() {
  const tx = useEditorT();
  return (
    <button
      type="button"
      className={styles.lockBtn}
      onClick={hardReload}
      aria-label={tx.drawer.hardReload}
    >
      <RefreshCw size={16} />
      <Tooltip side="bottom" label={tx.drawer.hardReloadTip} />
    </button>
  );
}

function ThemeToggleButton() {
  const { mode, cycle } = useThemeMode();
  const Icon = MODE_ICON[mode];
  const { modes, themeAria, themeTip } = useEditorT().drawer;
  return (
    <button
      type="button"
      className={styles.lockBtn}
      onClick={cycle}
      aria-label={themeAria(modes[mode])}
    >
      <Icon size={16} />
      <Tooltip
        side="bottom"
        label={themeTip(modes[mode], modes[MODE_NEXT[mode]])}
      />
    </button>
  );
}

// the editor's own UI language (th ⇄ en) — the app's language is the /[lang] URL
function EditorLangButton() {
  const [lang, setLang] = useEditorLang();
  const tx = useEditorT();
  // keep the cookie (read by the API for error messages) in step with the stored choice
  useEffect(() => {
    document.cookie = `${EDITOR_LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  }, [lang]);
  return (
    <button
      type="button"
      className={`${styles.lockBtn} ${styles.langBtn}`}
      onClick={() => setLang(lang === "th" ? "en" : "th")}
      aria-label={`${tx.lang.label}: ${lang.toUpperCase()} — ${tx.lang.switchTo}`}
    >
      {lang.toUpperCase()}
      <Tooltip side="bottom" label={`${tx.lang.label} — ${tx.lang.switchTo}`} />
    </button>
  );
}

export function DrawerLayout({ children }: { children: ReactNode }) {
  const locale = localeOf(usePathname());
  const tx = useEditorT();
  const [openLeft, setOpenLeft] = useState(false);
  const [openRight, setOpenRight] = useState(false);
  const [lockedLeft, setLockedLeft] = useState(false);
  const [lockedRight, setLockedRight] = useState(false);
  const [labelIdx, setLabelIdx] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [inspectRequest, setInspectRequest] = useState<HTMLElement | null>(null);

  const animLeft = useRef(false);
  const animRight = useRef(false);

  const toggleLeft = useCallback(() => {
    if (animLeft.current) return;
    animLeft.current = true;
    setOpenLeft((o) => !o);
    setTimeout(() => {
      animLeft.current = false;
    }, ANIM_MS);
  }, []);

  const toggleRight = useCallback(() => {
    if (animRight.current) return;
    animRight.current = true;
    setOpenRight((o) => !o);
    setTimeout(() => {
      animRight.current = false;
    }, ANIM_MS);
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setLabelIdx((i) => (i + 1) % LABELS.length),
      2600
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        toggleLeft();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        toggleRight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleLeft, toggleRight]);

  const anyOpen = openLeft || openRight;

  useEffect(() => {
    if (!anyOpen && !overlayOpen) return;
    const el = document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, [anyOpen, overlayOpen]);

  const hideLeft = useCallback(() => setOpenLeft(false), []);
  const showLeft = useCallback(() => setOpenLeft(true), []);
  const hideRight = useCallback(() => setOpenRight(false), []);
  const showRight = useCallback(() => setOpenRight(true), []);
  const [chromeHidden, setChromeHidden] = useState(false);

  const closeUnlocked = () => {
    if (openLeft && !lockedLeft) toggleLeft();
    if (openRight && !lockedRight) toggleRight();
  };

  return (
    <ThemeModeProvider>
    <NotifyProvider>
    <DrawerControlContext.Provider
      value={{
        hideLeft,
        showLeft,
        hideRight,
        showRight,
        setChromeHidden,
        leftOpen: openLeft,
        animMs: CLOSE_MS,
        setOverlay: setOverlayOpen,
      }}
    >
    <ConfirmProvider>
    <div className={`${styles.page} ${chromeHidden ? styles.chromeHidden : ""}`}>
      <div
        data-page-content
        className={`${styles.content} ${
          anyOpen || overlayOpen ? styles.contentBlurred : ""
        }`}
      >
        {children}
      </div>

      <div
        className={`${styles.backdrop} ${anyOpen ? styles.backdropOpen : ""}`}
        onClick={closeUnlocked}
        aria-hidden={!anyOpen}
      />

      <button
        type="button"
        className={`${styles.handle} ${openLeft ? styles.handleOpen : ""}`}
        onClick={toggleLeft}
        aria-label={openLeft ? "Close left menu" : "Open left menu"}
        aria-expanded={openLeft}
        aria-controls="drawer-left"
      >
        <span key={labelIdx} className={styles.handleLabel}>
          {LABELS[labelIdx]}
        </span>
        <span className={styles.handleIcon}>
          {openLeft ? (
            <ChevronLeft size={22} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={22} strokeWidth={2.5} />
          )}
          <Tooltip
            side="right"
            label={openLeft ? tx.drawer.menuClose : tx.drawer.menuOpen}
          />
        </span>
      </button>
      <div className={openRight ? styles.followRight : styles.follow}>
        <ElementInspector
          request={inspectRequest}
          onRequestDone={() => setInspectRequest(null)}
        />
      </div>

      <aside
        id="drawer-left"
        className={`${styles.drawer} ${openLeft ? styles.drawerOpen : ""}`}
        role="dialog"
        aria-modal={openLeft && !lockedLeft}
        aria-label="Left menu"
        aria-hidden={!openLeft}
      >
        <div className={styles.brand}>
          <span className={styles.brandLogo} role="img" aria-label="Next.js" />
          <span className={styles.brandVer}>v{pkg.dependencies.next.replace(/^[\^~]/, "")}</span>
        </div>
        <header className={styles.drawerHead}>
          <span className={styles.drawerTitle}>{tx.drawer.title}</span>
          <button
            type="button"
            className={`${styles.lockBtn} ${lockedLeft ? styles.locked : ""}`}
            onClick={() => setLockedLeft((v) => !v)}
            aria-pressed={lockedLeft}
            aria-label={lockedLeft ? "Unlock left drawer" : "Lock left drawer"}
          >
            {lockedLeft ? <Lock size={16} /> : <Unlock size={16} />}
            <Tooltip
              side="bottom"
              label={
                lockedLeft
                  ? tx.drawer.unlock
                  : tx.drawer.lock
              }
            />
          </button>
        </header>
        <nav className={styles.nav}>
          <a href={withLocale("/ui/components", locale)} className={styles.navItem}>
            <span className={styles.navDot} aria-hidden>
              <Blocks size={15} />
            </span>
            UI Components
          </a>
        </nav>
        <RouteManager />
        <ThemeManager />
      </aside>

      <button
        type="button"
        className={`${styles.handle} ${styles.handleRight} ${
          openRight ? styles.handleRightOpen : ""
        }`}
        onClick={toggleRight}
        aria-label={openRight ? "Close info" : "Open info"}
        aria-expanded={openRight}
        aria-controls="drawer-right"
      >
        <span key={labelIdx} className={styles.handleLabel}>
          {RLABELS[labelIdx]}
        </span>
        <span className={`${styles.handleIcon} ${styles.handleIconRight}`}>
          {openRight ? (
            <ChevronRight size={22} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={22} strokeWidth={2.5} />
          )}
          <Tooltip
            side="left"
            label={openRight ? tx.drawer.infoClose : tx.drawer.infoOpen}
          />
        </span>
      </button>

      <aside
        id="drawer-right"
        className={`${styles.drawer} ${styles.drawerRight} ${
          openRight ? styles.drawerRightOpen : ""
        }`}
        role="dialog"
        aria-modal={openRight && !lockedRight}
        aria-label="Info"
        aria-hidden={!openRight}
      >
        <header className={styles.drawerHead}>
          <span className={styles.drawerTitle}>Info</span>
          <div className={styles.headBtns}>
            <HardReloadButton />
            <ThemeToggleButton />
            <EditorLangButton />
            <button
              type="button"
              className={`${styles.lockBtn} ${lockedRight ? styles.locked : ""}`}
              onClick={() => setLockedRight((v) => !v)}
              aria-pressed={lockedRight}
              aria-label={lockedRight ? "Unlock right drawer" : "Lock right drawer"}
            >
              {lockedRight ? <Lock size={16} /> : <Unlock size={16} />}
              <Tooltip
                side="bottom"
                label={
                  lockedRight
                    ? tx.drawer.unlock
                    : tx.drawer.lock
                }
              />
            </button>
          </div>
        </header>
        <OverlayScroll viewportClassName={styles.infoBody}>
          <PageInfo open={openRight} onPick={setInspectRequest} />
          <ShortcutHelp />
        </OverlayScroll>
      </aside>
    </div>
    </ConfirmProvider>
    </DrawerControlContext.Provider>
    </NotifyProvider>
    </ThemeModeProvider>
  );
}
