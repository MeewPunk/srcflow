"use client";

import { useEffect } from "react";

// set by reloadWithoutGuard() so the editor's own deliberate reloads aren't blocked
let bypass = false;

// while `dirty`, refreshing / closing the tab asks the browser's "leave site?" prompt
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypass) return;
      e.preventDefault();
      e.returnValue = ""; // older browsers need it set to show the prompt
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

// a reload the editor means to do (after saving, or after the user chose to discard)
export function reloadWithoutGuard() {
  bypass = true;
  window.location.reload();
}
