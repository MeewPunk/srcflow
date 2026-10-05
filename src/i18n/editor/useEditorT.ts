"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_EDITOR_LANG,
  EDITOR_LANG_COOKIE,
  EDITOR_LANG_KEY,
  editorDicts,
  isEditorLang,
  type EditorLang,
} from "./index";

const CHANGE = "srcflow:editor-lang-change";

function read(): EditorLang {
  try {
    const v = localStorage.getItem(EDITOR_LANG_KEY);
    return isEditorLang(v) ? v : DEFAULT_EDITOR_LANG;
  } catch {
    return DEFAULT_EDITOR_LANG;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

// the editor's own UI language (separate from the app's /[lang]); server render is Thai
export function useEditorLang() {
  const lang = useSyncExternalStore(subscribe, read, () => DEFAULT_EDITOR_LANG);
  const setLang = useCallback((next: EditorLang) => {
    try {
      localStorage.setItem(EDITOR_LANG_KEY, next);
    } catch {}
    document.cookie = `${EDITOR_LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return [lang, setLang] as const;
}

export function useEditorT() {
  return editorDicts[useEditorLang()[0]];
}
