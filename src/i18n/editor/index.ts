import th, { type EditorDict } from "./th";
import en from "./en";

export type { EditorDict };
export type EditorLang = "th" | "en";
export const editorDicts: Record<EditorLang, EditorDict> = { th, en };
export const DEFAULT_EDITOR_LANG: EditorLang = "en";
// localStorage for the UI, cookie so API routes answer errors in the same language
export const EDITOR_LANG_KEY = "srcflow:editor-lang";
export const EDITOR_LANG_COOKIE = "srcflow-editor-lang";

export const isEditorLang = (v: unknown): v is EditorLang => v === "th" || v === "en";

type Errors = EditorDict["errors"];
export type ErrorCode = keyof Errors;

// a failure the editor shows to the user: carries a code + params, worded per language
export class EditorError<K extends ErrorCode = ErrorCode> extends Error {
  readonly code: K;
  readonly args: Parameters<Errors[K]>;
  constructor(code: K, ...args: Parameters<Errors[K]>) {
    super(errorText(th, code, args));
    this.code = code;
    this.args = args;
  }
}

export function errorText<K extends ErrorCode>(dict: EditorDict, code: K, args: Parameters<Errors[K]>) {
  return (dict.errors[code] as (...a: Parameters<Errors[K]>) => string)(...args);
}

export const describeError = (e: unknown, dict: EditorDict) =>
  e instanceof EditorError ? errorText(dict, e.code, e.args) : e instanceof Error ? e.message : dict.errors.generic();
