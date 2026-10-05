import { NextResponse } from "next/server";
import { assertDev } from "@/lib/routeFs";
import { readLayout, writeLayout, type LayoutState } from "@/lib/layoutFs";
import { apiFail } from "@/i18n/editor/server";

export async function GET() {
  try {
    assertDev();
    return NextResponse.json({ ok: true, layout: await readLayout() });
  } catch (e) {
    return apiFail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertDev();
    const body = (await req.json()) as LayoutState;
    return NextResponse.json({ ok: true, layout: await writeLayout(body) });
  } catch (e) {
    return apiFail(e);
  }
}
