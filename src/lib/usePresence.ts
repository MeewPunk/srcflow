"use client";

import { useEffect, useState } from "react";

// keeps something mounted for `ms` after `show` turns false, so it can play an exit
// animation (`leaving`) instead of vanishing
export function usePresence(show: boolean, ms: number) {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [show, ms]);
  return { mounted: show || mounted, leaving: !show && mounted };
}
