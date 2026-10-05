"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useEditorT } from "@/i18n/editor/useEditorT";
import styles from "./Notify.module.css";

type NotifyType = "success" | "error" | "info";
type NotifyIcon = ComponentType<{ size?: number; className?: string }>;
type Toast = {
  id: number;
  type: NotifyType;
  message: string;
  icon?: NotifyIcon;
};

const NotifyContext = createContext<
  (message: string, type?: NotifyType, icon?: NotifyIcon) => void
>(() => {});

export const useNotify = () => useContext(NotifyContext);

const ICON: Record<NotifyType, NotifyIcon> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tx = useEditorT();
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: NotifyType = "success", icon?: NotifyIcon) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, type, message, icon }]);
      setTimeout(() => remove(id), 3200);
    },
    [remove]
  );

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.icon ?? ICON[t.type];
          return (
            <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
              <Icon size={18} className={styles.icon} />
              <span className={styles.msg}>{t.message}</span>
              <button
                className={styles.close}
                onClick={() => remove(t.id)}
                aria-label={tx.common.close}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </NotifyContext.Provider>
  );
}
