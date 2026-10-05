import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { readTheme, writeTheme, type ThemePatch } from "@/lib/themeFs";
import { apiFail } from "@/i18n/editor/server";

export async function GET() {
  try {
    assertDev();
    return NextResponse.json({ ok: true, theme: await readTheme() });
  } catch (e) {
    return apiFail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = (await req.json()) as ThemePatch;
    return NextResponse.json({ ok: true, theme: await writeTheme(body) });
  } catch (e) {
    return apiFail(e);
  }
}
