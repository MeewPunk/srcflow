import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { buildUtilitiesCss } from "@/lib/runtimeCss";
import { apiFail } from "@/i18n/editor/server";

export async function POST(req: Request) {
  try {
    assertDev();
    const body = await req.json();
    const classes = Array.isArray(body.classes) ? body.classes.map(String) : [];
    return NextResponse.json({ ok: true, css: await buildUtilitiesCss(classes) });
  } catch (e) {
    return apiFail(e);
  }
}
