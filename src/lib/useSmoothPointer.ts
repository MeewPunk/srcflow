"use client";

import { useEffect, useRef, useState } from "react";

const SMOOTH = 0.25;
const MAX_STEP = 70;

type Pt = { x: number; y: number };

// iOS-style lagged pointer: eases a smoothed position toward the raw pointer.
// Shared by the /drag demo (reads `pos`) and the Element Inspector (reads `onFrame`).
export function useSmoothPointer(onFrame?: (p: Pt) => void) {
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const rawRef = useRef<Pt>({ x: 0, y: 0 });
  const animRef = useRef<Pt>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      (["x", "y"] as const).forEach((k) => {
        let d = (rawRef.current[k] - animRef.current[k]) * SMOOTH;
        if (d > MAX_STEP) d = MAX_STEP;
        else if (d < -MAX_STEP) d = -MAX_STEP;
        animRef.current[k] += d;
        if (Math.abs(rawRef.current[k] - animRef.current[k]) < 0.2)
          animRef.current[k] = rawRef.current[k];
      });
      frameRef.current?.({ ...animRef.current });
      setPos({ ...animRef.current });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  const start = (x: number, y: number) => {
    rawRef.current = { x, y };
    animRef.current = { x, y };
    setPos({ x, y });
    setActive(true);
  };
  const move = (x: number, y: number) => {
    rawRef.current = { x, y };
  };
  const stop = () => setActive(false);

  return { pos, active, start, move, stop };
}
