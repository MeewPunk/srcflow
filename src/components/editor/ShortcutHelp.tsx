"use client";

import { useEditorT } from "@/i18n/editor/useEditorT";
import type { EditorDict } from "@/i18n/editor";
import styles from "./ShortcutHelp.module.css";

// keep in sync with the key handlers in DrawerLayout and ElementInspector
const groups = (tx: EditorDict["shortcuts"]): { title: string; keys: [string[], string][] }[] => [
  {
    title: tx.general,
    keys: [
      [["←"], tx.toggleLeft],
      [["→"], tx.toggleRight],
      [["Ctrl", tx.doubleClick], tx.enterSelect],
    ],
  },
  {
    title: tx.selectMode,
    keys: [
      [[tx.click], tx.lock],
      [[tx.doubleClick], tx.pickToEdit],
      [["Enter"], tx.pickLocked],
      [["↑", "↓"], tx.outerInner],
      [["Ctrl", tx.drag], tx.move],
      [["Ctrl", "Z"], tx.undo],
      [["Esc"], tx.exit],
    ],
  },
  {
    title: tx.onTarget,
    keys: [
      [["Ctrl", "C"], tx.copyEl],
      [["Ctrl", "V"], tx.pasteEl],
      [["Ctrl", "B"], tx.copyClass],
      [["Ctrl", "Shift", "V"], tx.pasteClass],
      [["Ctrl", "↑ / ↓"], tx.reorder],
      [["Ctrl", "Delete"], tx.deleteEl],
      [["F"], tx.searchClasses],
    ],
  },
];

export function ShortcutHelp() {
  const tx = useEditorT().shortcuts;
  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>{tx.title}</span>
        <span className={styles.note}>{tx.macNote}</span>
      </div>
      {groups(tx).map((g) => (
        <div key={g.title} className={styles.group}>
          <span className={styles.groupTitle}>{g.title}</span>
          <dl className={styles.list}>
            {g.keys.map(([keys, desc]) => (
              <div key={desc} className={styles.row}>
                <dt className={styles.keys}>
                  {keys.map((k) => (
                    <kbd key={k} className={styles.kbd}>
                      {k}
                    </kbd>
                  ))}
                </dt>
                <dd className={styles.desc}>{desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
