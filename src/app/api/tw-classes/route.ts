import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { tailwindClassList } from "@/lib/runtimeCss";
import { apiFail } from "@/i18n/editor/server";

export async function GET() {
  try {
    assertDev();
    return NextResponse.json({ ok: true, classes: await tailwindClassList() });
  } catch (e) {
    return apiFail(e);
  }
}
