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
import { Check, X } from "lucide-react";
import { useDrawerControl } from "./DrawerLayout";
import { Button } from "@/app/ui/components/base/button/Button";
import { useEditorT } from "@/i18n/editor/useEditorT";
import styles from "./Confirm.module.css";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  async () => false
);
const ConfirmActiveContext = createContext<boolean>(false);

export const useConfirm = () => useContext(ConfirmContext);
export const useConfirmActive = () => useContext(ConfirmActiveContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [active, setActive] = useState(false);
  const tx = useEditorT();
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const reopenRef = useRef(false);
  const { hideLeft, showLeft, leftOpen, animMs, setOverlay } =
    useDrawerControl();

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setActive(true);
        setOverlay(true);
        if (leftOpen) {
          reopenRef.current = true;
          hideLeft();
          setTimeout(() => setOpts(o), animMs);
        } else {
          reopenRef.current = false;
          setOpts(o);
        }
      }),
    [leftOpen, hideLeft, animMs, setOverlay]
  );

  const settle = useCallback(
    (v: boolean) => {
      resolver.current?.(v);
      resolver.current = null;
      setOpts(null);
      setActive(false);
      setOverlay(false);
      if (reopenRef.current) {
        reopenRef.current = false;
        showLeft();
      }
    },
    [showLeft, setOverlay]
  );

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
    <ConfirmActiveContext.Provider value={active}>
      {children}
      {opts && (
        <div
          className={styles.overlay}
          style={{
            backdropFilter: "blur(8px) saturate(140%)",
            WebkitBackdropFilter: "blur(8px) saturate(140%)",
          }}
          onClick={() => settle(false)}
        >
          <div
            className={styles.card}
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {opts.title && <h2 className={styles.title}>{opts.title}</h2>}
            <p className={styles.message}>{opts.message}</p>
            <div className={styles.actions}>
              <Button
                variant="ghost"
                tone="neutral"
                iconStart={<X size={16} />}
                onClick={() => settle(false)}
              >
                {opts.cancelText ?? tx.common.cancel}
              </Button>
              <Button
                variant="solid"
                tone={opts.danger ? "danger" : "accent"}
                iconStart={<Check size={16} />}
                onClick={() => settle(true)}
                autoFocus
              >
                {opts.confirmText ?? tx.common.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmActiveContext.Provider>
    </ConfirmContext.Provider>
  );
}
