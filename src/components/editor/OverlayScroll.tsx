"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { useEditorT } from "@/i18n/editor/useEditorT";
import { usePresence } from "@/lib/usePresence";
import styles from "./OverlayScroll.module.css";

type Inset = { top: number; right: number; bottom: number };
const DEFAULT_INSET: Inset = { top: 4, right: 3, bottom: 4 };

export function OverlayScroll({
  children,
  viewportClassName,
  viewportRef,
  inset = DEFAULT_INSET,
  jumpButtons = false,
}: {
  children: ReactNode;
  viewportClassName?: string;
  viewportRef?: RefObject<HTMLDivElement | null>;
  inset?: Inset;
  jumpButtons?: boolean;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const scrollRef = viewportRef ?? innerRef;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [thumb, setThumb] = useState({ height: 0, top: 0 });
  const [hovering, setHovering] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [edges, setEdges] = useState({ atTop: true, atBottom: true });
  const upShown = usePresence(!edges.atTop, 200);
  const downShown = usePresence(!edges.atBottom, 200);
  const tx = useEditorT();
  const sbShow = hovering || flashing;

  const { top, right, bottom } = inset;

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollHeight, clientHeight, scrollTop } = el;
    setEdges({ atTop: scrollTop <= 1, atBottom: scrollTop + clientHeight >= scrollHeight - 1 });
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ height: 0, top: 0 });
      return;
    }
    const trackH = clientHeight - (top + bottom);
    const h = Math.max(28, (clientHeight / scrollHeight) * trackH);
    const t = (scrollTop / (scrollHeight - clientHeight)) * (trackH - h);
    setThumb({ height: h, top: t });
  }, [scrollRef, top, bottom]);

  const flash = useCallback(() => {
    setFlashing(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setFlashing(false), 1000);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateThumb();
    const onScroll = () => {
      updateThumb();
      flash();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    const mo = new MutationObserver(updateThumb);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
    };
  }, [updateThumb, flash, scrollRef]);

  return (
    <div
      className={styles.host}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className={`${styles.viewport} ${viewportClassName ?? ""}`}
        ref={scrollRef}
      >
        {children}
      </div>
      <div
        className={`${styles.scrollbar} ${sbShow ? styles.scrollbarOn : ""}`}
        style={{ top, right, bottom }}
        aria-hidden
      >
        {thumb.height > 0 && (
          <div
            className={styles.thumb}
            style={{
              height: thumb.height,
              transform: `translateY(${thumb.top}px)`,
            }}
          />
        )}
      </div>
      {jumpButtons && (
        <div className={`${styles.jump} ${hovering ? styles.jumpOn : ""}`}>
          {upShown.mounted && (
            <button
              type="button"
              className={`${styles.jumpBtn} ${upShown.leaving ? styles.jumpBtnOut : ""}`}
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={tx.scroll.top}
            >
              <ChevronsUp size={15} />
            </button>
          )}
          {downShown.mounted && (
            <button
              type="button"
              className={`${styles.jumpBtn} ${downShown.leaving ? styles.jumpBtnOut : ""}`}
              onClick={() => {
                const el = scrollRef.current;
                el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              }}
              aria-label={tx.scroll.bottom}
            >
              <ChevronsDown size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
