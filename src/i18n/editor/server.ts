import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEFAULT_EDITOR_LANG, EDITOR_LANG_COOKIE, describeError, editorDicts, isEditorLang } from "./index";

export async function editorDict() {
  const v = (await cookies()).get(EDITOR_LANG_COOKIE)?.value;
  return editorDicts[isEditorLang(v) ? v : DEFAULT_EDITOR_LANG];
}

// API error response, worded in the editor's language
export async function apiFail(e: unknown, status = 400) {
  return NextResponse.json({ ok: false, error: describeError(e, await editorDict()) }, { status });
}
