"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

type Side = "top" | "bottom" | "left" | "right";
const DELAY_MS = 500;
const GAP = 10;
const EDGE_MARGIN = 8;
const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function computePos(r: DOMRect, side: Side) {
  switch (side) {
    case "bottom":
      return { top: r.bottom + GAP, left: r.left + r.width / 2, transform: "translate(-50%, 0)" };
    case "left":
      return { top: r.top + r.height / 2, left: r.left - GAP, transform: "translate(-100%, -50%)" };
    case "right":
      return { top: r.top + r.height / 2, left: r.right + GAP, transform: "translate(0, -50%)" };
    default:
      return { top: r.top - GAP, left: r.left + r.width / 2, transform: "translate(-50%, -100%)" };
  }
}

function fitsSide(r: DOMRect, side: Side, tipW: number, tipH: number) {
  switch (side) {
    case "top":
      return r.top - GAP - tipH >= EDGE_MARGIN;
    case "bottom":
      return r.bottom + GAP + tipH <= window.innerHeight - EDGE_MARGIN;
    case "left":
      return r.left - GAP - tipW >= EDGE_MARGIN;
    case "right":
      return r.right + GAP + tipW <= window.innerWidth - EDGE_MARGIN;
  }
}

// px the box must shift along its centered axis to stay on-screen (0 = fits already)
function clampCross(side: Side, tip: DOMRect) {
  if (side === "top" || side === "bottom") {
    if (tip.left < EDGE_MARGIN) return EDGE_MARGIN - tip.left;
    const max = window.innerWidth - EDGE_MARGIN;
    if (tip.right > max) return max - tip.right;
    return 0;
  }
  if (tip.top < EDGE_MARGIN) return EDGE_MARGIN - tip.top;
  const max = window.innerHeight - EDGE_MARGIN;
  if (tip.bottom > max) return max - tip.bottom;
  return 0;
}

export function Tooltip({ label, side = "top" }: { label: string; side?: Side }) {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRect = useRef<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; transform: string } | null>(
    null
  );
  const [resolvedSide, setResolvedSide] = useState<Side>(side);
  const [arrowShift, setArrowShift] = useState(0);

  useEffect(() => {
    const anchor = ref.current?.parentElement;
    const trigger = (ref.current?.closest("button") ?? anchor) as HTMLElement | null;
    if (!trigger) return;
    const on = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        triggerRect.current = trigger.getBoundingClientRect();
        setResolvedSide(side);
        setArrowShift(0);
        setPos(computePos(triggerRect.current, side));
      }, DELAY_MS);
    };
    const off = () => {
      if (timer.current) clearTimeout(timer.current);
      setPos(null);
    };
    trigger.addEventListener("mouseenter", on);
    trigger.addEventListener("mouseleave", off);
    trigger.addEventListener("focusin", on);
    trigger.addEventListener("focusout", off);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      trigger.removeEventListener("mouseenter", on);
      trigger.removeEventListener("mouseleave", off);
      trigger.removeEventListener("focusin", on);
      trigger.removeEventListener("focusout", off);
    };
  }, [side]);

  useLayoutEffect(() => {
    if (!pos || !tipRef.current || !triggerRect.current) return;
    const r = triggerRect.current;
    const tip = tipRef.current.getBoundingClientRect();

    if (!fitsSide(r, resolvedSide, tip.width, tip.height)) {
      const flipped = OPPOSITE[resolvedSide];
      if (fitsSide(r, flipped, tip.width, tip.height)) {
        setResolvedSide(flipped);
        setArrowShift(0);
        setPos(computePos(r, flipped));
        return;
      }
    }

    const cross = clampCross(resolvedSide, tip);
    if (cross !== 0) {
      setArrowShift(-cross);
      setPos((p) =>
        p
          ? resolvedSide === "top" || resolvedSide === "bottom"
            ? { ...p, left: p.left + cross }
            : { ...p, top: p.top + cross }
          : p
      );
    }
  }, [pos, resolvedSide]);

  return (
    <>
      <span ref={ref} style={{ display: "none" }} aria-hidden />
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.anchor}
            style={{ top: pos.top, left: pos.left, transform: pos.transform }}
          >
            <span
              role="tooltip"
              ref={tipRef}
              className={`${styles.tip} ${styles[resolvedSide]}`}
              style={{ "--arrow-shift": `${arrowShift}px` } as CSSProperties}
            >
              {label}
            </span>
          </div>,
          document.body
        )}
    </>
  );
}
