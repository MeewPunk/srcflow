"use client";

import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useEditorT } from "@/i18n/editor/useEditorT";
import styles from "./Loading.module.css";

export function Loading({
  open,
  label,
}: {
  open: boolean;
  label?: string;
}) {
  const tx = useEditorT();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={styles.box}>
        <Loader2 className={styles.spinner} />
        <span className={styles.label}>{label ?? tx.common.loadingDots}</span>
      </div>
    </div>,
    document.body
  );
}
