"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const COLLAPSE_MS = 800;
const COLLAPSE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const [render, setRender] = useState(open);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 0 : COLLAPSE_MS;

  useEffect(() => {
    if (open) {
      setRender(true);
      return;
    }
    const t = setTimeout(() => setRender(false), duration);
    return () => clearTimeout(t);
  }, [open, duration]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (first.current) {
      first.current = false;
      el.style.height = open ? "auto" : "0px";
      return;
    }

    if (open && render) {
      const target = el.scrollHeight;
      el.style.height = "0px";
      void el.offsetHeight;
      el.style.height = target + "px";
      const t = setTimeout(() => {
        el.style.height = "auto";
      }, duration);
      return () => clearTimeout(t);
    }

    if (!open) {
      el.style.height = el.scrollHeight + "px";
      void el.offsetHeight;
      el.style.height = "0px";
    }
  }, [open, render, duration]);

  return (
    <div
      ref={ref}
      style={{
        overflow: "hidden",
        transition: `height ${duration}ms ${COLLAPSE_EASE}`,
      }}
    >
      {render ? children : null}
    </div>
  );
}
